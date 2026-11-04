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
| R3 (extended) | A Reppo payment is only allowed from a step that asked for a second opinion |

Public guard service rules (`packages/core/src/external.ts`, behind `POST /check` and Errand Guard on Kite): E1 https only · E2 price present · E3 per-payment cap · E4 budget left · E5 steered by earlier seller text · E6 recipient (approved list, or mentioned in the task; otherwise ask).

```mermaid
sequenceDiagram
  participant A as Errand agent
  participant G as SERV guard graph (Jev)
  participant R as Reppo lite (independent evaluators)
  participant K as Kite Passport
  A->>G: predictable checks (plan, price, recipient, constraints)
  G-->>A: approve
  A->>K: pay $0.22 (x402, routed to Base)
  K->>R: lite evaluation of the choice
  R-->>A: accept / revise / reject + critiques
  alt accept
    A->>K: pay the purchase
  else revise or reject
    A->>A: ask the user, quoting the evaluators
  end
```
