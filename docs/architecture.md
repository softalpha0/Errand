# Architecture

```mermaid
flowchart LR
  U[Person] -->|task + budget| W[Web app<br/>Next.js on Vercel]
  W -->|REST + SSE| A[Agent<br/>Hono on Render]
  A -->|plan, guard, read, decide, answer| S[SERV Reasoning<br/>inference-api.openserv.ai]
  A -->|guard graph gr_| G[SERV guard graph]
  A -->|kpass CLI| K[Kite Passport<br/>session + x402 payments]
  K --> B[Bitrefill]
  K --> E[StableEnrich]
  K --> M[StableEmail]
  K --> P[StablePhone]
  K --> Z[Amazon via Kite shopping]
  T[Telegram bot] --> A
  X[MCP apps] --> A
  A -->|finished trace| R[Reppo Evaluation API]
  A --- D[(Postgres / memory)]
```

## Errand lifecycle

```mermaid
stateDiagram-v2
  [*] --> planning
  planning --> needs_input: planner has a question
  needs_input --> planning
  planning --> awaiting_approval: plan fits the limits
  awaiting_approval --> running: passkey approval in Kite
  running --> needs_input: guard or condition says "ask"
  needs_input --> running
  running --> done
  planning --> failed
  awaiting_approval --> failed: declined / timed out
  running --> failed
  planning --> cancelled
  running --> cancelled
  done --> [*]
```

## One payment

```mermaid
sequenceDiagram
  participant A as Agent
  participant S as Seller
  participant Rules as Rules (R1–R11)
  participant G as SERV guard graph
  participant K as Kite Passport
  A->>S: unpaid request (free)
  S-->>A: 402 + price quote
  A->>Rules: candidate payment
  Rules-->>A: approve / ask / block
  A->>G: candidate + rules result + context
  G-->>A: {decision, reason}
  Note over A: combine(): SERV can only make it stricter
  A->>K: kpass session execute (only if approved)
  K->>S: x402 payment + request
  S-->>K: response
  K-->>A: response + payment info
  A->>A: SERV PromptGuard reads the response
  A->>Rules: every purchase the response suggests (R1 blocks)
```

## Packages

| Path | What |
|---|---|
| `packages/core` | Types, seller catalog (allowlist), rules R1–R11, plan validation, phone normalisation, metrics. Pure, unit-tested. |
| `apps/agent` | Hono server, SERV client, kpass wrapper, seller adapters, runner, Reppo worker, demo mode. |
| `apps/web` | Next.js 15 App Router + Tailwind 4: landing, composer, live errand, receipt, results, guard test page. |

## How SERV is used (the write-up's core paragraph)

| Call | Model | SERV feature | Output |
|---|---|---|---|
| Plan | `gpt-5.4-mini-serv-kronos` | Kronos audits the reasoning prompt; strict JSON schema | Plan: steps, prices, conditions, recipients, questions |
| Guard (every payment) | `gr_…` guard graph on `/v1/responses` | Graph: script steps (free), Jev decision steps, agent step for the reason | `{decision, reason}` |
| Guard fallback | `gpt-5.4-mini` + `serv_shadow_agent` | Shadow Agent validation, max 2 iterations | `{decision, reason}` |
| Read paid response | `gpt-5.4-mini` + `serv_prompt_guard` | PromptGuard + strict JSON | facts, sources, suggested purchases |
| Research → act | `gpt-5.4-mini` | strict JSON | proceed / skip / ask |
| Answer | `gpt-5.4-mini` | strict JSON | answer, citations, which steps were used |

Every request has a system message, and nothing streams (Shadow Agent and graphs both require that).

## Rules (packages/core/src/guard.ts)

| Rule | Blocks |
|---|---|
| R1 origin | any purchase suggested inside a paid response |
| R2 allowlist | any URL + method not in the catalog |
| R3 in plan | a step id not in the approved plan, or an endpoint that step may not pay |
| R4 catalog price | a seller asking more than its listed price |
| R5 per payment | above the session's per-payment cap |
| R6 budget | past the errand's total budget |
| R7 step budget | past the step's planned maximum |
| R8 duplicate | the same request paid twice (status checks excepted) |
| R9 call cap | more than 20 paid calls |
| R10 recipient | money or messages to anyone not in the plan (E.164 / lower-cased email) |
| R11 invoice | ask if the invoice is >3% above plan, block if >15% |

## Added on 4 Nov (partner feedback)

| Rule | Effect |
|---|---|
| R12 ask above | Ask before any single payment above the user's own threshold |
| R13 checkout | An Amazon checkout must charge exactly the approved cap + Kite's $1 fee, and the cap can't exceed the plan's |
| R3 (extended) | A Reppo payment is only allowed from a step that asked for a second opinion |

Public guard service rules (`packages/core/src/external.ts`, behind `POST /check` and Errand Guard on Kite): E1 https only · E2 price present · E3 per-payment cap · E4 budget left · E5 steered by earlier seller text · E6 recipient (approved list, or mentioned in the task; otherwise ask).

```mermaid
sequenceDiagram
  participant A as Errand agent
  participant G as SERV guard graph (Jev)
  participant R as Reppo Eval API (evaluator panel)
  participant K as Kite Passport
  A->>G: predictable checks (plan, price, recipient, constraints)
  G-->>A: approve
  A->>R: taskType "action": the proposed purchase (Errand's credits, free to the user)
  R-->>A: score 0-100, route ship / review / block, reason (30-90 s)
  alt ship
    A->>K: pay the purchase
  else review or block
    A->>A: ask the user, quoting Reppo's reasoning
  end
```

## Added on 5 Nov: who pays, and how often

| Funding | Approved by | Used for |
|---|---|---|
| Separate Kite session (`kpass session create --separate`) | The payer's passkey, per errand | One-off errands, Amazon checkouts |
| Kite allowance (`kpass session execute --use-allowance`) | The payer's passkey, once on Kite; the plan once in Errand | Standing errands (repeat daily or weekly). Never Amazon. |

The payer is the person's own connected Passport (`/connect`, one login folder each under `PASSPORTS_DIR`) or, if they didn't connect one, Errand's own Passport (access code required in live mode).

```mermaid
sequenceDiagram
  participant P as Person
  participant E as Errand
  participant K as Kite Passport
  P->>E: "keep Mum's data topped up, at most $1 a day"
  E->>E: SERV plans the first run
  P->>E: approve the plan (allowance already approved on Kite)
  loop every day
    E->>K: allowance status (free)
    alt allowance covers the run
      E->>E: repeat the approved plan, every payment through the guard
      E->>K: session execute --use-allowance
    else
      E->>E: skip this run with Kite's message
    end
  end
```

Amazon orders: `shop:search` (free) → pick the best-rated item within the cap → optional Reppo second opinion → `shop:cart` → `shop:shipping view` → **order summary the person must confirm** → guard (R13) → `shop:checkout --confirmed --max-total <cap>`.
