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
- **MCP server** (`apps/mcp`): run errands from Claude, ChatGPT or Cursor.
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
