# AGENTS.md: Errand on Celo

Read this first, every session. Then read, in this order: `PRD.md` → `docs/celo/RULES.md` → `docs/celo/SPONSORS.md` → `docs/celo/BUILD-PLAN.md`. Update **Progress** and **Decisions** at the end of every phase.

> This file is for the `celo` branch (Agents Open for Business hackathon). The SERV Hackathon 02 version of this file lives on `main` and at tag `pre-celo-hackathon`. Don't merge `celo` into `main`.

## Project

**Errand** runs a person's errands in Naira from their own wallet. The person holds USD₮ in a non-custodial **Altana** wallet and grants Errand a session (spend cap + contract allowlist + expiry, revocable in one tx). Errand plans each errand, checks every payment with its guard, converts USD₮→cNGN on **Textile FX**, pays cNGN to the named recipient, pays for its own tools on **buy**, and gives a receipt with a Celoscan link for every tx. **Errand Guard** is an x402 service on Celo where **Self Agent ID** decides which agents get served and at what limit.

- Event: Agents Open for Business (Celo · Loops House). **Submissions close Mon 7 Dec 2026, 09:00 GMT (10:00 Lagos).** Internal deadline Sun 6 Dec, 18:00 Lagos.
- Tracks: Altana Agent Wallets · Stablecoin Corridors · Self Agent ID (Agent Vault = stretch only).
- Builder: Benjamin Ugochukwu, solo.

## Constants (don't retype these from memory; import from `packages/celo`)

| Name | Value |
|---|---|
| Attribution tag | `celo_511bb691f2f0` (`packages/celo/src/attribution.ts`) |
| Chain | Celo mainnet 42220 (`eip155:42220`) |
| USD₮ | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` (6 decimals; never the 18-decimal adapter `0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72`) |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` (6 decimals) |
| Textile LimitOrderReactor | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Self Agent ID registry | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| x402 facilitator | `https://api.x402.celo.org` |
| Textile API | `https://api.textilecredit.com/v2` |

Full verified list with sources: `docs/celo/SPONSORS.md`.

## Done statement

A named user outside the team, with a wallet they funded themselves, runs one real errand on the live Celo site: Errand converts USD₮→cNGN on Textile FX and pays cNGN to a recipient outside the team, from the user's Altana wallet under a session the user granted. Every tx shows `celo_511bb691f2f0` in `verifyTx`. The user revokes the session in one tx and the next attempt is refused. Another agent with a Self Agent ID pays Errand Guard over x402 and gets served; one without is limited, on video.

## Must-haves (detail in PRD §7)

1. `packages/celo`: tokens + decimals check, attribution (done), Textile client, Altana helpers, ERC-8004/Self scripts.
2. Agent key from Self Agent ID (`wallet-free`, mainnet) → ERC-8004 registration (tagged) → Loops agent wallet + PayTo.
3. Web: Altana passkey wallet, grant session (cap + allowlist + expiry), status, revoke.
4. Agent: Celo rail with `fx.convert`, `pay.local`, `tool.buy`; guard rules R14–R17; x402 spend counted in R5/R6.
5. Receipts with Celoscan links + `verifyTx` result.
6. `apps/guard-celo`: x402 on Celo + Self Agent ID gating.
7. Demo mode still works, labelled.
8. Separate Celo deployments. Evidence in `evidence/celo/`. README in the cadence structure.

## Source-of-truth order

1. The vendor's live docs (links in SPONSORS.md).
2. `docs/celo/SPONSORS.md` and `docs/celo/RULES.md`.
3. This repo's code.

If a vendor's docs disagree with this repo, the vendor wins: fix the code, fix SPONSORS.md, add a line to **Decisions**. **Never invent** an address, decimals value, endpoint, field name, price or rule. If it isn't in SPONSORS.md or the vendor's docs, stop and ask Benjamin, or write a spike to find out.

## Rules

### Working with Benjamin
- Benjamin is a beginner with Claude Code. Do setup **one step at a time**: explain each step in plain language, give the exact command, wait for him to confirm it worked, then continue.
- He is on **Windows / PowerShell**. Every command printed for him must work in PowerShell (no `&&`, no `export`; use `$env:VAR="..."`). package.json scripts must be cross-platform.
- **HUMAN steps:** stop, print exactly what Benjamin must do (and why), and wait. Examples: funding a wallet, scanning a passport in the Self app, creating API keys, clicking ADD WALLET on Loops, creating Vercel/Render projects, any real-money action.
- When giving him files, give **complete files**, not fragments.

### Money and chain safety
- **Mainnet only counts, and testnet doesn't.** Test with tiny real amounts ($1–2). Textile has no Celo testnet.
- **Never send an untagged tx.** Build viem wallet clients once with `.extend(errandAttribution())`. Use `tagCalldata()` for raw calldata (Textile `transactions.swap.data`). Run `assertTagged()` on the first tx of every new code path and save the output in `evidence/celo/`.
- **Never fund a user's wallet.** Users must fund their own (independent-user rule). Benjamin's own test wallets are labelled "test" in evidence and never counted as users.
- No arbitrage, no self-trading, never act as a Textile maker.
- Altana: always set `permissions.calls` (omitted = unrestricted). `execute` returns `FAILED` instead of throwing: check `status`. Session caps don't bound x402 payments, so Errand's rules must.
- Textile: approve → **wait for the receipt** → recheck `expiresAt` → swap → `/submit`. 75 s client timeout. Store `claimToken` (returned once).
- x402 on Celo: use `@x402/*` v2 only; explicit `price: { amount, asset, extra }`; `extra.name` is the EIP-712 domain name (USD₮ = `Tether USD`, v`1`); cNGN routes use `assetTransferMethod: "permit2"` and **no** `eip2612GasSponsoring`.

### Repo hygiene (Benjamin's standing rules)
- Commit + push after setup, after each feature, after important fixes, before big changes, and at the end of every session. Descriptive conventional commit messages. Verify the push worked.
- Never commit secrets: `.env`, `.self/`, private keys, API keys. Only `.env.example` with empty values (the attribution tag is not a secret and is allowed).
- **Never touch `main`**, `errand-pearl.vercel.app`, or the existing Render services (SERV judging; the organiser asked not to interfere with the submission build). Celo deploys go to **new** Vercel/Render projects.
- One README, kept updated. No extra doc files beyond the ones in this pack unless Benjamin asks.
- Never claim a feature in the README, video or posts that hasn't run on mainnet. Demo-mode runs are labelled simulated.
- No personal data about users in the repo unless they agreed. Never put private keys, full phone numbers or emails in evidence.
- Stuck 30 minutes: write the blocker here, try something simpler, or move it to Won't in PRD.md.
- Public copy: plain and specific. No "revolutionize", "seamless", "leverage", "unlock", "AI-powered".

## Tools

pnpm monorepo, TypeScript strict, Node ≥ 22. `packages/core` (pure rules, Vitest), `packages/celo` (Celo, Vitest), `apps/agent` (Hono, Render), `apps/web` (Next.js 15, Tailwind 4, Vercel), `apps/mcp`, `apps/guard-celo` (new). Postgres via `DATABASE_URL` or in-memory.

Key packages (check versions with `npm view <pkg> version` before installing): `@celo/attribution-tags` 0.5.0 · `viem` · `@altananetwork/sdk` · `@selfxyz/agent-sdk` · `@x402/hono` `@x402/core` `@x402/evm` `@x402/fetch` · `@celo/buy` (CLI, global).

Coding-agent helpers Benjamin installs (HUMAN): `npx loopshouse add agents-open-for-business` (Loops skill: sponsor docs, submission, self-evaluation) and `npx skills add celo-org/celopedia-skills`.

## Design (unchanged from the SERV build)

Calm, precise, trustworthy, like a bank statement that explains itself. Warm paper background, one accent (green = approved), red only for blocked, amber only for "needs you". Geist Sans + Geist Mono with tabular numbers. Phone first. Show Naira amounts first, with the USD₮ they cost. Every screen has loading, empty and error states. No gradients, glow, glass, emoji icons or "AI-powered" badges.

## Progress

- [x] 20 Nov: enrolled on Loops House (solo); tag `celo_511bb691f2f0`.
- [x] 20 Nov: tag `pre-celo-hackathon` pushed; branch `celo` created.
- [x] 20 Nov: `packages/celo` attribution helpers + 5 tests (commit `aca3958`).
- [x] 23 Nov: docs pack committed (PRD.md, AGENTS.md, CLAUDE.md, docs/celo/*) (commit `a375eb4`).
- [x] 23 Nov: `.self/` and `*.key` added to `.gitignore`.
- [x] 23 Nov: Loops skill (`.claude/skills`, `.agents/skills`) + Celopedia skills (`.agents/skills`) installed in the repo.
- [ ] Phase 1 spikes S0–S5 (BUILD-PLAN) + decision gate. S0 PASS, S4 PASS (Self agentId 214) 23 Nov (evidence/celo/spikes.md).
- [x] 23 Nov: Loops agent wallet on file = `0xc64d2153Bd39053913667A5c2eec8250d8AbC005` (Celo checklist on the Loops playground).
- [x] 23 Nov: Phase 2 (pulled forward): ERC-8004 **agentId 10107** registered from the agent wallet, tagged (tx `0x8b60…2b7c`, `verifyTx` shows `celo_511bb691f2f0`). Evidence: `evidence/celo/identity.md`, `evidence/celo/erc8004-register.json`.
- [x] 23 Nov: Loops Celo checklist shows **ALL SET** (agent wallet on file, tag seen on-chain, ERC-8004 registered).
- [ ] Phase 2 identity: Self Agent ID, ERC-8004, Loops agent wallet + PayTo.
- [ ] Phase 3 Celo rail in the agent.
- [ ] Phase 4 web wallet + session; new deployments. (Started 23 Nov, ahead of Phase 3 at Benjamin's request; S1/S2 run inside it.)
  - [x] 4.1 Celo home page (`apps/web`): pitch, how it works, verified on-chain facts, honest build status. Old Kite/SERV pages no longer linked.
  - [x] 4.1 HUMAN: new Vercel project `errand-thgw`, production branch `celo` → **https://errand-thgw.vercel.app** (live 23 Nov). SERV project untouched.
  - [x] 4.2 Wallet screen `/wallet` (23 Nov): Altana passkey wallet (`agentIdentity: false`), address + copy + Celoscan, live USD₮/cNGN/CELO balances, KeyStore set-up status, live setup fee, funding steps, backup file, restore (passkey or file). E2E-tested in headless Chromium with a virtual passkey against the real Altana relay + Celo mainnet (no tx). `packages/celo/src/tokens.ts` + 6 tests.
  - [ ] 4.3 Session screen (cap, allowlist, expiry, grant, status, revoke) = spike S2.
  - [ ] 4.4 Errand composer.
- [ ] Phase 5 Errand Guard on Celo.
- [ ] Phase 6 real users (≥ 3 independent).
- [ ] Phase 7 freeze (Thu 3 Dec), README, video. Then complete the Loops submit form (needs live URL, video, named user; other answers ready: agentId 10107, Self 214, tag, PayTo = agent wallet).
- [ ] Phase 8 submit (Sun 6 Dec, before 18:00 Lagos).

## Open questions (resolve, then move the answer to Decisions)

- Q1: Do tagged txs from users' Altana wallets, signed by Errand's agent key as session signer, count toward the entry? (asked in Telegram)
- A1/A2: Does the attribution tag survive Altana's relay, and is the relay a standard EntryPoint `handleOps`? (spike S1)
- A3: Can a session be granted in the browser to a server-held key? (spike S2)
- T1: Textile `takerProof` from an Altana smart wallet, or use an API key? (spike S3)

## Decisions

- 20 Nov: Enter with existing project Errand (organisers confirmed existing projects are fine with new code written during the event).
- 20 Nov: Build on branch `celo`; `main` stays as the SERV submission.
- 20 Nov: Tag `celo_511bb691f2f0` lives in `packages/celo`; `ATTRIBUTION_CODE` env may override it.
- 23 Nov: Agent wallet model (PRD §5): one Errand agent key from Self Agent ID `wallet-free` = session signer + ERC-8004 owner + PayTo + Loops agent wallet. User wallets created with `agentIdentity: false`. Pending Q1.
- 23 Nov: Celopedia skill reviewed before commit: Markdown only, no scripts. The installer's "Critical Risk" scan flags code examples (curl, env private keys), not executable code. `docs-watch` (Celopedia maintainers' tool) installed too; not used by Errand.
- 23 Nov: T2 answered by spike S0: Textile previews USD₮→cNGN on 42220 at $1/$5/$20 (≈₦1,447.58 per USD₮, ≈$41k depth, fee ≈2 bps inside sellAmount). Stay on the cNGN corridor; no wFIAT fallback. Compute rates from sellAmount/buyAmount, not the undocumented `rateRay`.
- 23 Nov: **Errand agent wallet = `0xc64d2153Bd39053913667A5c2eec8250d8AbC005`** (Self Agent ID agentId 214, wallet-free, mainnet; evidence/celo/identity.md). Use this one address for the whole event: Loops agent wallet, ERC-8004 owner, PayTo, session signer. Key in `.self/agent.key` on Benjamin's machine only.
- 23 Nov: A4 measured: Altana KeyStore registration fee on Celo = `KeyStoreController.getRegistrationFeeInWei()` = 9.1047 CELO = **$0.50** (oracle-priced from a fixed $0.50 at CELO/USD 0.0549, Chainlink feed 0x0568…Ab7e). The SDK sends fee + 10% and the controller refunds the excess. Paid once per new wallet, in native CELO, from the wallet's own balance. Tell users: hold about 11 CELO (≈$0.60) before the first action.
- 23 Nov: ERC-8004 agent card hosted at `https://raw.githubusercontent.com/softalpha0/Errand/celo/apps/web/public/.well-known/errand-agent.json` (stable HTTPS, same file the Celo web deployment will serve later). Lists only what exists today (`web` = repo, `x402Support: false`); edit the file (HTTPS URI, so no `setAgentURI` needed) when Errand Guard and the live site run.
- 23 Nov: Registered on both ERC-8004 registries, as planned: Self Agent ID registry (agentId 214, proof of human) and the canonical Identity Registry (agentId **10107**, the one the Loops checklist and 8004scan read). Open question on which registry counts is closed.
- 23 Nov: Loops submit form requires a live site, demo video and a named user. Not submitting placeholders; AskBots round 1 skipped if a full submission is required. Round 2 (Fri 4 Dec) is the target. On-chain entry requirements are already ALL SET.
- 23 Nov: Phase 4 before Phase 3 (Benjamin's call) so a live Celo site exists early. Vercel auto-deploys the `celo` branch; each step ships as it lands.
- 23 Nov: Celo live site = **https://errand-thgw.vercel.app** (Vercel project `errand-thgw`, Root Directory `apps/web`, production branch `celo`). Agent card `web` service now points there. Use this URL in the Loops form, README and video.
- 23 Nov: **Passkeys are bound to the site's domain** (WebAuthn rpId = host). Wallets created on `errand-thgw.vercel.app` only open there. Don't change the production domain once real users have wallets; Vercel preview URLs won't open them. If a custom domain is wanted, add it before Phase 6.
- 23 Nov: Altana `recoverFromPasskey` only works after a wallet's first transaction (it reads the admin key from KeyStore). Until then the browser's localStorage holds the only copy of the passkey's public key, so the wallet page offers a public-data backup file and a restore-from-file option.

## Blockers

- 23 Nov: `loops auth login` times out: after Google sign-in the browser lands on loops.house/profile instead of the CLI callback (localhost:54321), also in an incognito window. The skill is installed; CLI sign-in is only needed for `loops project ...` commands. Retry later or ask in the Loops/Celo Telegram.
