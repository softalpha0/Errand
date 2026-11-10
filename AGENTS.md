# AGENTS.md

Read this first, every session. Update **Progress** after every phase.

## Project

**Errand**: give an agent an errand and a budget. It researches, tops up phones and buys eSIMs, paying sellers through Kite Agent Passport within the limit the user approves. SERV Reasoning checks every payment before it happens. Reppo grades every finished run, and those grades decide what changes in the guard.

- Event: SERV Hackathon 02 (OpenServ), Track 02 Kite. Submissions close **15 Nov 2026 23:59 UTC**. Internal deadline 14 Nov 18:00 Lagos.
- Judged on creativity, user readiness, revenue potential. SERV Reasoning must be part of the build.
- Submit: public repo, demo video (< 3:00), write-up (what it does, how it uses SERV, which track), public X post tagging @openservai, form at openserv.typeform.com/submissions02 (track: Kite; "data collection enabled": yes).

## Problem

Spending limits stop an agent overspending in total. They don't stop waste inside the limit, or an agent obeying text in a paid response.

## User

Someone on a phone or laptop who wants an agent to buy airtime or data for family, a travel eSIM, or a researched answer, without handing over a wallet. Often in Nigeria; often buying for someone in another country.

## Done statement

A user on the live site runs one real errand that pays at least two real sellers through a Kite Passport session, sees one purchase suggested by seller text get blocked, and leaves with an answer and a receipt that links every payment on-chain. Within 20 minutes the receipt shows a settled Reppo verdict, and the Results page shows Reppo scores for at least two guard versions.

## Must-haves

1. Composer → SERV plan (Kronos, strict JSON) → plan checks against limits.
2. Kite Passport session per errand (`kpass session create --separate`), passkey approval, payments with `kpass session execute`.
3. Guard on every payment: rules R1–R11 (packages/core) then the SERV guard graph (fallback Shadow Agent). SERV can only make a decision stricter.
4. PromptGuard reader on every paid response; seller-suggested purchases blocked (R1).
5. Research steps (StableEnrich), buy steps (Bitrefill top-up / eSIM), research-then-act conditions, email (StableEmail).
6. "Ask me" pauses (approve / ask / block).
7. Live errand page (SSE), receipt page, Results page by guard version.
8. Reppo trace evaluation of every finished errand, one at a time.
9. Demo mode that simulates payments and says so everywhere.

10. Scope: valid for (session TTL), planner-extracted constraints, R12 ask-above.
11. Reppo second opinion on judgement calls (Reppo Eval API, taskType action, route ship/review/block, Errand's own credits) and `reppo.opinion` errands; receipts show score, route and reasoning.
12. Errand Guard (kite-service/errand-guard): Kite's x402 template wrapping `/check`, manifest ready to PR to gokite-ai/kite-x402-services.
13. MCP server (apps/mcp). Dolphin writes email wording only.
14. Each person's own Kite Passport (`/connect`, one login folder each). Standing errands on the Kite allowance (`/repeat`). Amazon through `kpass shop:*` with an order summary the person confirms and rule R13. Private errands. Telegram bot. Kite agent directory steps (docs/kite-directory.md).

Should: phone call booking (StablePhone, +1 only), evidence export, guard test page used in the video. Could: Errand as a seller in Kite's agent directory (needs the owner's KYC). Won't: Errand accounts and passwords (Kite's login is the account), mobile app.

## Tools

pnpm monorepo, TypeScript strict. `packages/core` (pure, Vitest), `apps/agent` (Hono, Node 22, kpass CLI, Docker → Render), `apps/web` (Next.js 15, Tailwind 4, Geist → Vercel). Postgres via `DATABASE_URL` or in-memory.

Source of truth for each vendor: `docs/sellers.md`, `docs/kite-integration.md`, `docs/serv-guard-graph.md`, `docs/reppo-loop.md`. If a vendor's docs disagree with this repo, the vendor wins: fix the code and note it here.

## Design

Feel: calm, precise, trustworthy, like a bank statement that explains itself. Warm paper background, one accent (green = approved), red only for blocked, amber only for "needs you". Geist Sans + Geist Mono with tabular numbers. Phone first. Patterns borrowed (ideas, not designs) from Beautiful UI (thinking traces, approval card, task rows), EasyUI (dependency-free SVG bar chart), 21st.dev (stepper/timeline). Avoid: gradients, glow, glass, emoji icons, vague headlines, rows of identical cards, "AI-powered" badges. Every screen has loading, empty and error states.

## Rules

- Benjamin is on Windows / PowerShell. Every command printed for him must work in PowerShell 5 (no `&&`, no `export`; use `$env:VAR="..."`). package.json scripts must be cross-platform.
- One feature per commit, conventional commit messages, push after each phase. `main` always deploys.
- Never commit secrets or `.kite-passport/`. Never send secrets, raw kpass output, full phone numbers or emails to Reppo (evaluations are public).
- Never claim a feature in the README, video or X post that has not run for real. Demo-mode runs are labelled as simulated.
- Stuck 30 minutes: write the blocker here, try something simpler, or move it to Won't.
- Public copy: plain and specific. No "revolutionize", "seamless", "leverage", "unlock".
- HUMAN steps: stop, print exactly what Benjamin must do, wait.

## Progress

- [x] 3 Nov: research, Kite account + $2 USDC on Base, catalog search, seller schemas.
- [x] 4 Nov: monorepo scaffolded; core rules + tests; agent with demo mode end to end; web app built and screenshotted.
- [x] SERV key connected; guard graph v1 then v2 created; demo runs on real SERV decisions.
- [x] 4 Nov evening: partner-feedback features built (scope, R12, Reppo second opinion + opinion errands, Errand Guard x402 service, MCP server, Dolphin emails, plain-money receipts). 52 unit tests.
- [x] 5 Nov: own Passport, standing errands (allowance), Amazon via Kite shopping + R13, private errands, Telegram bot, directory steps. 67 tests.
- [x] 5 Nov: attack benchmark (27 cases, three setups), Results page section, landing proof band. 75 tests.
- [x] 5 Nov: Telegram linked to each person's own Kite Passport (one-time code / deep link, /unlink, only the payer can approve). 6 tests + mock Telegram run.
- [ ] HUMAN: `pnpm benchmark` with SERV_API_KEY → commit evidence/benchmark.md and apps/web/src/data/benchmark.json.
- [ ] HUMAN: connect your own Passport once in live mode; confirm the login lands in PASSPORTS_DIR.
- [ ] HUMAN: turn on a small Kite allowance (e.g. $1/week) and run one standing errand live.
- [ ] HUMAN: create the Telegram bot with @BotFather → TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USERS.
- [ ] HUMAN: Kite identity check → `kpass agent create` (docs/kite-directory.md).
- [ ] HUMAN: data collection ON in console.openserv.ai/settings/organization (screenshot).
- [ ] HUMAN: Dolphin API key (app.dphn.ai) → DOLPHIN_API_KEY (optional).
- [ ] Deploy Errand Guard with KITE_NETWORK=testnet; `kpass sandbox on` + faucet; pay once; then mainnet; PR to gokite-ai/kite-x402-services.
- [x] 10 Nov: Reppo rebuilt on its new Eval API (old eval-requests and x402 lite endpoints return 404). Second opinions and grading now use REPPO_API_KEY credits; 8 tests against a mock.
- [ ] HUMAN: `pnpm spike:reppo` once with the real key; confirm the trace shape in evidence/raw/reppo-sample-verdict.json.
- [x] 5 Nov: `pnpm spike:kite` live: session approved with passkey, two real Bitrefill payments on Base (tx 0x60a8…ea4f). Findings in docs/kite-integration.md.
- [ ] HUMAN: Reppo API key → `pnpm spike:reppo`.
- [ ] HUMAN: create guard graph v1 from docs/serv-guard-graph.md → `SERV_GUARD_GRAPH_ID`.
- [ ] First live errands (research, trap page, top-up to own number, email).
- [ ] Deploy agent (Render) + web (Vercel); demo site + live site.
- [ ] Reppo batch: guard-v1 vs guard-v2 → evidence/reppo.md.
- [ ] 12 Nov feature freeze. Polish, README status table, evidence, screenshots.
- [ ] 13 Nov video. 14 Nov X post + form.

## Blockers and decisions

- (none yet)
