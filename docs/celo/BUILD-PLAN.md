# Build plan: Errand on Celo

Plan backwards from **Mon 7 Dec 09:00 GMT**. Feature freeze **Thu 3 Dec**. Submit by **Sun 6 Dec 18:00 Lagos**.
Riskiest pieces first. Every phase ends with: tests pass → commit → push → update AGENTS.md → Progress.

Legend: **HUMAN** = Benjamin must do it (the agent stops, prints exact steps, waits). **SPIKE** = a small throwaway test that decides the design.

---

## Phase 0: Setup (Mon 23 Nov) ✅ partly done

- [x] Enrolled on Loops House; tag `celo_511bb691f2f0`.
- [x] Tag `pre-celo-hackathon` pushed; branch `celo` created.
- [x] `packages/celo` with attribution helpers + 5 tests (commit `aca3958`).
- [x] Add these docs (PRD.md, AGENTS.md, CLAUDE.md, docs/celo/*) and commit (commit `a375eb4`).
- [x] HUMAN: `npx loopshouse add agents-open-for-business` inside the repo (installs the Loops skill for the coding agent; sign-in opens in the browser).
- [x] HUMAN: `npx skills add celo-org/celopedia-skills` (verified Celo contract addresses for the coding agent).
- [x] Add `.self/` and `*.key` to `.gitignore`.
- [ ] Make sure the repo is registered on Loops **before Tue 24 Nov 14:00 GMT** so AskBots review round 1 runs on it.

## Phase 1: Spikes (Mon 23 – Tue 24 Nov)

Each spike is a script in `packages/celo/scripts/` with results written to `evidence/celo/spikes.md`. Use **tiny amounts** ($1–2). No user funds.

| # | Spike | Pass = | If it fails |
|---|---|---|---|
| S0 ✅ PASS 23 Nov | Textile `/v2/rfq/preview` USD₮→cNGN on 42220 for $1, $5, $20 (no credential needed) | A price comes back for each size | Corridors falls back to wBRL/wARS (needs a LATAM recipient) |
| S1 | Altana tag survival: a test Altana wallet (private-key signer, funded by Benjamin, **not a user**) executes one USD₮ transfer of $0.01 with the tag appended to `call.data`. Run `verifyTx` on the hash | `verifyTx` returns codes containing `celo_511bb691f2f0` | Try appending to the UserOperation `callData` (needs an SDK hook or patch). Ask in Altana's channel. Last resort: FX + payouts from the agent EOA |
| S2 | Grant a session where `sessionSigner` is a key the browser doesn't hold (public-key-only signer object), then `execute` from the server with the real key | Execute `CONFIRMED` | Have the browser generate the session key and send it to the server over TLS (worse) or ask Altana |
| S3 | Textile firm quote with `taker` = the Altana test wallet: keyless `takerProof` signed via the wallet (ERC-1271), then approve → wait → swap via `execute` (tagged), then `/submit` | RFQ reaches `filled`; swap tx tagged | Get a Textile API key (`Authorization: Bearer tx_live_…`, no `takerProof`) and repeat |
| S4 | Self Agent ID `wallet-free` registration on **mainnet** (HUMAN: scan with the Self app), export key within 30 min | `agentId` returned, key saved to `.env` | Retry; check passport is supported by Self |
| S5 | x402 Celo: Errand Guard test route priced $0.01 USD₮; pay it once from the agent key with `@x402/fetch` | 200 + settlement on Celoscan | Check `extra.name` = `Tether USD`, version `1`, amount `"10000"` |

**Decision gate (end of Tue 24 Nov):** record S0–S5 results and the Telegram answer to Q1 in AGENTS.md → Decisions. Then fix the design in PRD §5 and §14.

HUMAN steps in this phase:
1. Send the scoring question in https://t.me/celoagenthackathons (Q1 in PRD §14) if not already sent.
2. Fund a **test** wallet with ~$5 USD₮ + a little CELO for S1/S3 (from your own funds; this wallet is not a user).
3. Self app: install, scan passport, complete S4 on your phone.
4. Create the x402 API key at https://x402.celo.org (connect wallet → Create API key → sign). Paste it into `.env` as `X402_API_KEY`.
5. Join the Altana livestream Tue 24 Nov 14:00 GMT (15:00 Lagos) and ask A1/A2/A3 if still open.

## Phase 2: Identity (Wed 25 Nov)

- [ ] Agent key from S4 = `ERRAND_AGENT_PRIVATE_KEY` in `.env` (never committed). Print only the address.
- [ ] Agent card JSON (ERC-8004 registration file) hosted at a stable HTTPS URL on the new web deployment (`/.well-known/errand-agent.json` or similar): `type`, `name` "Errand", `description`, `image`, `services` (web, guard endpoint, MCP), `x402Support: true`, `active: true`, `supportedTrust`.
- [ ] Script `packages/celo/scripts/register-8004.ts`: simulate → send `register(agentURI)` from the agent key with the tag → read `Registered` event → write `agentId` to `evidence/celo/identity.md` → update the file with `registrations` → `setAgentURI` if needed.
- [ ] HUMAN: fund the agent key with a little CELO for gas (or USDC via the fee-currency adapter).
- [ ] HUMAN: in the Loops playground, **ADD WALLET** = the agent key address. Register it as the **PayTo** too. Keep it for the whole event.
- [ ] Check on 8004scan.io that Errand shows up.

## Phase 3: Celo rail in the agent (Thu 26 – Sat 28 Nov)

- [ ] `packages/celo/src/tokens.ts`: table from SPONSORS.md §1 + startup check `decimals()` (USD₮/USA₮ must be 6, never the 18-decimal adapters).
- [ ] `packages/celo/src/textile.ts`: typed client for preview/request/submit/cancel/get; `no_quote` reasons; `retryAfterMs`; 75 s timeout; store `claimToken`. Unit tests with recorded fixtures.
- [ ] `packages/celo/src/altana.ts`: client with `chains: [CELO]`, `agentIdentity: false` for user wallets; `executeTagged()` that applies the tag the way S1 proved; status handling (`FAILED` doesn't throw).
- [ ] Catalog + step types `fx.convert`, `pay.local`, `tool.buy`; planner prompt updated for Naira errands.
- [ ] Guard rules R14–R17 + tests (PRD §8). x402 spend counted against R5/R6.
- [ ] Runner: FX = request quote → R15 → approve (if needed) → **wait for receipt** → recheck expiry → swap → submit → poll; then cNGN transfer; then receipt.
- [ ] Receipts: Celoscan link + `verifyTx` result per tx.
- [ ] Demo mode for every new step (simulated, labelled).

## Phase 4: Web wallet + session (Sun 29 – Mon 30 Nov)

- [ ] Wallet screen: create passkey wallet; show address + balances; exact funding instructions (USD₮ + the measured CELO amount for registration, A4).
- [ ] Session screen: cap (USD₮/day, cNGN/day), allowlist shown in plain words ("Textile FX swap contract", "cNGN token: send only"), expiry; grant; status; **Revoke** button.
- [ ] Errand composer: Naira amount + recipient address + label.
- [ ] HUMAN: create the **new** Vercel project and Render service for the `celo` branch (never the SERV ones). Set env vars there.
- [ ] Deploy. Run J1 with your own test wallet end to end.

## Phase 5: Errand Guard on Celo (Tue 1 Dec)

- [ ] `apps/guard-celo`: Hono + `@x402/hono` + `@x402/core` + `@x402/evm`; facilitator `https://api.x402.celo.org` with `X-API-Key`; route `POST /check` priced in USD₮ (`extra: { name: "Tether USD", version: "1" }`); PayTo = agent key.
- [ ] Self gating: verify `x-self-agent-*` headers with `SelfAgentVerifier` (mainnet, raw body bytes). Verified: higher daily limit. Unverified: lower limit or 403 with a clear message. Unit tests.
- [ ] Declare the builder code in 402 responses if the x402 `builder-code` extension is available in the installed `@x402/*` version (harmless now).
- [ ] A small demo client agent (with its own Self Agent ID) that pays `/check`; and one without, to show the rejection.
- [ ] Watch the Self livestream (Tue 1 Dec 14:00 GMT) for anything that changes this.

## Phase 6: Real users (Mon 30 Nov – Thu 3 Dec, in parallel)

- [ ] HUMAN: find at least 3 real people outside the team who fund their own wallet and run a real errand. Write down who they are and how you reached them (the FAQ asks for this). Get their permission to name them.
- [ ] HUMAN: confirm each cNGN recipient can receive and use cNGN.
- [ ] HUMAN: ask other hackathon teams with ERC-8004 agents to try Errand Guard.
- [ ] Log every real run in `evidence/celo/runs.md` (tx hashes, RFQ ids, `verifyTx` output). No personal data in the repo beyond what users agreed to.

## Phase 7: Freeze and polish (Thu 3 – Sat 5 Dec)

- [ ] Thu 3 Dec: feature freeze. Watch the Corridors livestream (14:00 GMT).
- [ ] Fri 4 Dec: AskBots round 2 snapshot. Fix what the round 1 issue flagged before this.
- [ ] README rewritten in the cadence structure (one-line pitch, demo video + live links up top, contents, problem, what it does, try-it, how it works, Mermaid diagrams, guarantees table, verified onchain evidence, stack, run-it-yourself, testing, layout, known limitations, build log, credits).
- [ ] Self-evaluate with the Loops skill ("Evaluate my project against the sponsor's judging criteria").
- [ ] Demo video (see docs/celo/SUBMISSION.md).

## Phase 8: Submit (Sun 6 Dec, before 18:00 Lagos)

Follow docs/celo/SUBMISSION.md line by line.

---

## Parking lot (not in this build)

- Agent Vault checkout on a Nigerian site (stretch, PRD §9).
- wFIAT corridors for LATAM recipients.
- Errand as a seller in other agent directories.
