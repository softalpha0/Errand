# Build log

Everything in this repository was built during SERV Hackathon 02 (2–15 Nov 2026). The first commit is dated 4 Nov 2026.

## 3 Nov 2026

- Researched the hackathon, SERV docs (including the console's Graphs docs), Kite Passport docs and CLI, Reppo's agents.md.
- Created a Kite Passport account with `kpass` 6.13.1 on Windows; funded $2 USDC on Base.
- Searched the Kite catalog with `ksearch`: Bitrefill, StableEnrich, StableEmail, StablePhone. No PostalForm, AgentFax, Amazon or Resy for this account.
- Read each seller's request schema from its free 402 response.

## 4 Nov 2026

- Scaffolded the monorepo: `packages/core` (rules, catalog, validation), `apps/agent`, `apps/web`.
- 32 core unit tests + 9 agent tests passing; web builds; demo journey runs end to end; screenshots at 390 px and 1280 px with no horizontal scroll.

## 4 Nov 2026 (later)

- SERV key connected; guard graph v1 created in the console and called via its gr_ id; Reppo sandbox accepting traces.
- Fixed: steps lost their status and facts after an "ask me" pause (the errand object was swapped mid-run); graph 502s now retry, then fall back to the Shadow Agent.
- **Guard finding (v1 → v2):** v1 blocked a planned Bitrefill eSIM search as "already answered by earlier research". Step 5 was meant for duplicate research only. v2 restricts it to research step types. This is the first before/after pair for the Results page.

## 4 Nov 2026 (evening): what the partner founders asked for

From the OpenServ × Kite × Reppo space, added in one pass:

- **Errand Guard on Kite** (`kite-service/errand-guard`): Kite asked for more services integrated into Passport through `kite-x402-services`. Their template, unchanged, wraps Errand's `/check`; `service.yaml` validates against their schema; local 402 verified on testnet.
- **Scope** like Kite's own demo: valid for 1 hour / 1 day / 7 days (the session TTL), constraints extracted by the planner and checked on every purchase, and rule **R12** "ask me above $X".
- **Reppo second opinion**: "Jev for the predictable, Reppo for the subjective". Judgement-call purchases get Reppo's instant lite evaluation ($0.22, paid through Kite); a new `reppo.opinion` step answers "is it worth it?" errands. Receipts list each evaluator's score and note.
- **Plain money on receipts**: "Paid with Kite", settlement chain behind a "proof" link.
- **MCP server** (`apps/mcp`): run errands from any MCP app.
- **Dolphin** writes the email wording on an open-source model; no decisions.
- Tests: 43 core + 9 agent; end-to-end demo runs for second opinion, R12 ask, opinion errand, /check; MCP checked over stdio.

## Next entries

- Day-one spikes (Kite, Reppo) and what the raw kpass output looked like.
- First live errand: tx links.
- Guard graph v1 created (gr_ id), Simulate results.
- Reppo batch: guard-v1 vs guard-v2.

## Self-score (fill in on 12 Nov)

| Criterion | 1–5 | Weakest point | Fix |
|---|---|---|---|
| Creativity | | | |
| User readiness | | | |
| Revenue potential | | | |

## 5 Nov: everything on the "what's next" list

Source of truth for every Kite command: Kite's own Passport skills (bundle 110, skills 3.6.7, downloaded from cli.gokite.ai and checksum-verified), plus `kpass --help` from 3 Nov.

- **Your own Kite Passport** (`/connect`): email → Kite's 8-character code → a login folder of your own. Errands you start use your wallet and your passkey. Logout deletes the folder.
- **Standing errands** (`/repeat`): approve a plan once, Errand repeats it daily or weekly from your Kite **allowance** (`--use-allowance`), capped per run; `allowance status` is read before every run. Kite's allowance never pays checkouts, so Amazon is refused there.
- **Amazon through Kite** (`buy.amazon`): `kpass shop:*` exactly as Kite's shopping skill documents; the person confirms an order summary; new rule **R13** checks the charge is exactly the cap + Kite's $1 fee.
- **Private errands**: not sent to Reppo's public network; second opinions see only the choice. (Reppo has no public API for private data nets yet.)
- **Kite agent directory**: `docs/kite-directory.md` with the exact `kpass` steps (needs the owner's identity check) and `GET /agent-card`.
- **Telegram bot**: long-polling Bot API client; tested against a mock Telegram server (plan, Approve button, payments, answer, strangers refused).
- Copy no longer names specific assistant brands for the MCP server; it says "any MCP app".
- Tests: 67 (51 core, 16 agent). Demo end-to-end run: Passport connect, Amazon order placed and declined, stranger can't approve, standing errand first run + "Run now" with no approval, Amazon standing errand refused.

## 5 Nov (later): attack benchmark

After reading past winners (AgentGuard, x402-Guardrails, IntentGuard, Agent SpendGuard), spending caps alone are a crowded idea and IntentGuard won attention with measured numbers. So Errand now measures itself: `packages/core/src/benchmark.ts` holds 20 attacks and 7 real payments on one errand; `pnpm benchmark` runs them through no guard, the fixed rules, and rules + SERV, and writes `evidence/benchmark.md` and the Results page data. Rules-only results (pinned by tests): no guard pays 18/20 attacks, the rules pay 4/20 (exactly the 4 judgement-only cases), 7/7 real payments paid in both. Results page and a landing band show it; design follows EasyUI's bar chart (toggle legend, data table) and Beautiful UI's filter table.

## 6 Nov

- **Errand Guard on kite-x402-hono.** Rebuilt the guard on the Kite track's priority repo kite-x402-hono (0.3.3), the Bun/Hono wrapper, since Errand's agent is Hono too. Same env variables and `/v1/check` contract, so the Render service redeploys in place. Verified locally: `GET /`, `/healthz`, `/.well-known/x402` (USDC.e, 10000 atomic units = $0.01) and an unpaid `POST /v1/check` → 402 with a mainnet `PAYMENT-REQUIRED` challenge.
- **Kite catalog PR** [gokite-ai/kite-x402-services#8](https://github.com/gokite-ai/kite-x402-services/pull/8) opened; paid test call blocked by Kite's allowlist (`host_not_in_executable_catalog`).
- **Landing page:** the hero now shows the real mainnet receipt (e_My979K17) instead of a simulated example.
