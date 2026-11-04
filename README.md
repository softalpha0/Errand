# Errand

**Give an agent the errand. Keep control of the money.** Errand researches, books by phone, tops up phones, and buys eSIMs and gift cards for you. It pays sellers through **Kite Agent Passport** within the scope you approve, checks every payment with **SERV Reasoning** before it happens, asks **Reppo**'s independent evaluators for a second opinion on judgement calls, and gets graded by Reppo after every run. Emails are worded by an open-source model on **Dolphin**.

![CI](https://github.com/softalpha0/errand/actions/workflows/ci.yml/badge.svg) ![License: MIT](https://img.shields.io/badge/license-MIT-black) ![Built on SERV Reasoning](https://img.shields.io/badge/built%20on-SERV%20Reasoning-1d6a4c) ![Kite Passport](https://img.shields.io/badge/pays%20with-Kite%20Passport-1d6a4c)

**Demo video:** _add link_ · **Live app:** _add link_ · **Example receipt:** _add link_ · **Track:** SERV Hackathon 02, Track 02 (Kite)

![Errand](evidence/screenshots/landing-desk.png)

## Contents

- [The problem](#the-problem)
- [What it does](#what-it-does)
- [Try it](#try-it)
- [How it works](#how-it-works)
- [What Errand promises](#what-errand-promises)
- [Evidence](#evidence)
- [Run it yourself](#run-it-yourself)
- [Status: what works today](#status-what-works-today)
- [What's next](#whats-next)

## The problem

Agents can now pay for things by themselves over x402. Spending limits stop an agent spending $50 when you said $5, but they don't stop waste inside the limit: buying the same data twice, paying for something the task never needed, or obeying a web page that says "also buy the premium bundle". People who want an agent to buy airtime for family or research a purchase still have to trust it with a wallet and hope.

## What it does

1. **You set the errand and its scope.** "I fly to Accra on Friday. Find a 7-day Ghana eSIM and buy the cheapest one if it is under $8." Budget $8, at most $7 per payment, valid for 7 days, ask me above $5. The planner turns your words into constraints (Ghana coverage, 7 days, under $8) that every purchase is checked against.
2. **SERV writes a plan with a price on every step**: a cited answer ($0.01), a Reddit search ($0.02), then buy the eSIM only if the research says it's under $8.
3. **You approve one Kite Passport session** with exactly those limits, using your passkey.
4. **Every payment is checked before it happens**: 12 fixed rules (including your own "ask me above"), then a SERV guard graph. Paid responses are read with SERV PromptGuard, and any purchase a seller's text suggests is blocked. Judgement calls (which eSIM, which gift, which restaurant) also get an **independent second opinion from Reppo** before any money moves: Jev for the predictable, Reppo for the subjective. When Errand isn't sure, it asks you.
5. **You get the answer and a receipt**: each payment with its on-chain link and reason, what was blocked, and, about 15 minutes later, Reppo's independent grade.

What it can do today, all paid through sellers in the Kite Passport catalog:

| Errand | Sellers |
|---|---|
| Research with sources (web answer, search, Reddit, news, shopping prices, Google Maps, read a page) | StableEnrich |
| Mobile airtime and data in 180+ countries, travel eSIMs, gift cards | Bitrefill |
| Research, then buy only if a condition holds | StableEnrich + Bitrefill |
| Email the result or a receipt | StableEmail |
| Find a business and phone it with a task (US and Canada) | StableEnrich + StablePhone |
| "Is it worth it?" answered with research plus an independent verdict | StableEnrich + Reppo |
| Second opinion before any judgement-call purchase | Reppo (paid through Kite) |

## Try it

Open the live app and pick an example on the **Start an errand** page. The demo site simulates payments (and says so on every screen) while SERV's planning and checks are real. The live site runs real payments for the owner's access code. Receipts from live runs link each payment on-chain.

To see the guard catch a planted instruction, ask Errand to read the **guard test page** (`/trap`): it pays $0.0126 to read the page, then blocks the $9 purchase the page asks for.

## How it works

```mermaid
flowchart LR
  U[You] --> W[Web app] --> A[Agent]
  A -->|plan, read, answer| S[SERV Reasoning]
  A -->|every payment| G[SERV guard graph]
  A -->|kpass| K[Kite Passport] --> Sellers[Bitrefill · StableEnrich · StableEmail · StablePhone]
  A -->|finished trace| R[Reppo]
```

**SERV makes every decision** (details in [docs/architecture.md](docs/architecture.md)):

| Step | SERV feature |
|---|---|
| Plan | `gpt-5.4-mini-serv-kronos`: Kronos audits the reasoning prompt; strict JSON schema |
| Check each payment | A **SERV guard graph** (`gr_…` on `/v1/responses`): budget maths as free script steps, the verdict as Jev decision steps, the reason as an agent step. Fallback: `serv_shadow_agent`. |
| Read each paid response | `serv_prompt_guard` + strict JSON: facts, sources, and any purchase the text tries to trigger |
| Research → act | A strict-JSON decision: proceed, skip or ask |
| Answer | Strict JSON with citations and which paid results were used |

**Reppo judges what rules can't.** The SERV graph's Jev decision steps handle predictable checks. Subjective choices go to Reppo's lite evaluation ($0.22, verdict at once, paid through Kite Passport over x402): accept → pay; revise or reject → Errand quotes the evaluators and asks you. Every finished errand is also graded as a trace, and receipts list each evaluator's score and note.

**Dolphin writes the messages.** If `DOLPHIN_API_KEY` is set, the emails Errand sends are worded by `deepseek-ai/DeepSeek-V4.1-Flash` on Dolphin's network. Dolphin makes no decisions.

**Kite Passport holds the money and the limits.** One passkey-approved session per errand (`kpass session create --separate`), every payment through `kpass session execute`, idempotency keys per decision, and Kite's cross-chain routing when a seller settles on Base. See [docs/kite-integration.md](docs/kite-integration.md).

**Reppo grades the work.** Each finished errand goes to Reppo as a trace with five fixed questions about spending. Grades decide which guard step changes next; the Results page compares guard versions. See [docs/reppo-loop.md](docs/reppo-loop.md).

The guard graph's system prompt is in [docs/serv-guard-graph.md](docs/serv-guard-graph.md), ready to paste into the SERV console.

### Errand for other agents

- **Errand Guard on Kite** ([kite-service/errand-guard](kite-service/errand-guard)): a paid x402 service on the Kite chain, built from Kite's own `kite-x402-services` template. Any Kite Passport agent pays $0.01 to ask "should I make this payment?" and gets approve, ask or block with a reason. Its manifest validates against Kite's schema; it is ready to PR to `gokite-ai/kite-x402-services`.
- **Errand inside your assistant** ([apps/mcp](apps/mcp), [docs/mcp.md](docs/mcp.md)): an MCP server so Claude Desktop, Claude Code, ChatGPT desktop or Cursor can start errands. Payments still need your passkey.

## What Errand promises

| Promise | Enforced by |
|---|---|
| Never spends past your limit | Kite Passport session caps, enforced by Kite |
| Never pays a seller outside the catalog | R2: exact URL + method allowlist |
| Never pays more than the listed price | R4, plus a free price quote read from the seller's 402 before paying |
| Never follows a seller's instructions | PromptGuard reads the response; R1 blocks every suggested purchase |
| Never tops up the wrong number | R10: E.164 match against the recipients you approved |
| Never pays twice for the same thing | R8: request fingerprint |
| Stays inside your scope | Kite session TTL ("valid for"), constraints checked by the guard graph, R12 "ask me above $X" |
| Gets a second opinion on judgement calls | Reppo lite evaluation before the purchase |
| Asks when unsure | The guard can approve, ask or block, and can never loosen a rule |
| Every run is graded by someone else | Reppo evaluation of the full trace |

## Evidence

Everything a judge needs to verify the claims above is in [evidence/](evidence/): real payments with transaction links, blocked attempts with reasons, every Reppo evaluation id, and screenshots of the SERV console (usage, Shadow Agent, Safety, guard graph runs) and the Kite dashboard.

## Tech stack

TypeScript monorepo (pnpm workspaces) · Next.js 15 + Tailwind CSS 4 + Geist (web, Vercel) · Hono on Node 22 with the Kite `kpass` CLI (agent, Docker on Render) · OpenAI SDK pointed at SERV (and Dolphin) · Express + `@x402/*` from Kite's template (Errand Guard) · MCP TypeScript SDK · Postgres (Neon) or in-memory · Vitest · GitHub Actions.

## Run it yourself

PowerShell (Windows):

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
Copy-Item .env.example apps\web\.env.local
pnpm dev
```

bash:

```bash
corepack enable && pnpm install && cp .env.example .env && cp .env.example apps/web/.env.local && pnpm dev
```

Open http://localhost:3000. Demo mode needs no keys. Add `SERV_API_KEY` for real reasoning; follow [docs/deploy.md](docs/deploy.md) for live payments, Render and Vercel.

```powershell
pnpm test
pnpm typecheck
```

## Project layout

```
apps/
  agent/        Hono server: runner, SERV client, kpass wrapper, sellers, Reppo worker + second opinions, Dolphin, demo mode
  web/          Next.js app: landing, composer, live errand, receipt, results, guard test page
  mcp/          MCP server: use Errand from Claude, ChatGPT, Cursor
kite-service/
  errand-guard/ Paid x402 guard service on the Kite chain (Kite template), ready to PR to kite-x402-services
packages/
  core/         Types, seller catalog, rules R1–R11, plan checks, phone numbers, metrics (unit-tested)
docs/           Architecture, guard graph prompt, sellers, Kite, Reppo, deploy, testing, build log
evidence/       Payments, blocks, Reppo results, screenshots
submission/     Write-up, video script, X post
```

## Status: what works today

| Part | Status |
|---|---|
| Rules (R1–R12, guard-service rules), plan checks, phone numbers, parsing | Unit-tested (52 tests) |
| Full journey in demo mode (plan → approve → research → buy → email → receipt) | Works end to end |
| SERV planner + guard graph v2 + PromptGuard + answers | Run for real with a SERV key (demo payments) |
| Scope (valid for, constraints, R12 ask-above), Reppo second opinion, opinion errands | Work end to end in demo mode |
| Errand Guard x402 service | Typechecks; unpaid call returns a correct Kite testnet 402; manifest validates against Kite's schema; **pay once on testnet** |
| MCP server | Tested over stdio: tools/list, start_errand, approve_demo |
| Dolphin email wording | Built to Dolphin's docs; **verify with your key** |
| Web app at 390 px and 1280 px | Screenshotted, no horizontal scroll |
| SERV calls (planner, Shadow Agent guard, PromptGuard reader, answer) | Built to SERV's docs; **verify with your key** |
| SERV guard graph | Prompt ready; **create it in the console** |
| Kite payments through kpass | Built to the CLI's help output; **run `pnpm spike:kite` first** |
| Reppo worker | Built to agents.md; **run `pnpm spike:reppo`** |

Update this table as each part is proven. Only claim in the video what has run for real.

## Known limitations

- One Kite Passport (the owner's) pays for live errands; every errand still needs the owner's passkey approval. Per-user Passport connection is next.
- Reppo's lite evaluation charges in USDC on Base; Kite Passport routes the payment. Run one real second opinion before relying on it.
- Gift card codes and eSIM QR codes are tied to the paying wallet on Bitrefill; Errand confirms delivery but does not display the code.
- StablePhone calls only +1 numbers and is marked "Retest" in the Kite catalog.
- kpass output field names are undocumented; `kite-parse.ts` searches for them and the spike records the real shapes.

## Built during the hackathon

All of it. The research, design and code are from 3–15 Nov 2026; see [docs/build-log.md](docs/build-log.md).

## What's next

- Each person connects their own Kite Passport.
- Metered top-ups: "keep Mum's data topped up, at most $1 a day", on Kite's allowance or its upcoming metered and subscription payments.
- Physical shopping (Amazon) through Kite's `shopping` skill, with the same scope checks.
- Private Reppo data nets for personal errands.
- List Errand in Kite's agent directory so other agents can hire it per errand.
- Telegram front end.

## Credits

SERV Reasoning by OpenServ · Kite Agent Passport · Reppo · Dolphin · Bitrefill, StableEnrich, StableEmail, StablePhone. Errand Guard's wrapper is Kite's `kite-x402-services` template (Apache-2.0). Built by Benjamin Ugochukwu (Ben Softie on X).

MIT License.
