# AGENTS.md: Errand on Celo

Read this first, every session. Then read, in this order: `PRD.md` → `docs/celo/RULES.md` → `docs/celo/SPONSORS.md` → `docs/celo/BUILD-PLAN.md`. Update **Progress** and **Decisions** at the end of every phase.

> This file is for the `celo` branch (Agents Open for Business hackathon). The SERV Hackathon 02 version of this file lives on `main` and at tag `pre-celo-hackathon`. Don't merge `celo` into `main`.

## Project

**Errand** sends local money to anyone from the person's own wallet: Naira first, plus rupiah, Argentine pesos and Brazilian reais (all hackathon corridors with live liquidity). The person holds USD₮ in a non-custodial **Altana** wallet and grants Errand a session (spend cap + contract allowlist + expiry, revocable in one tx). Errand plans each errand, checks every payment with its guard, converts USD₮→cNGN on **Textile FX**, pays cNGN to the named recipient, pays for its own tools on **buy**, and gives a receipt with a Celoscan link for every tx. **Errand Guard** is an x402 service on Celo where **Self Agent ID** decides which agents get served and at what limit.

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

## Design (changed 24 Nov: "bold fintech", Benjamin's pick)

Dark base (`#07090a`), large bold display type (Geist Sans, tight tracking), Geist Mono with tabular numbers for amounts. Green `#35d07f` is the primary action and "approved"; red only for blocked, amber only for "needs you". One colour per currency for tiles and avatars (NGN green, IDR red, ARS blue, BRL yellow, MXN violet, COP orange; tokens in `globals.css`). Soft glows behind heroes and gradient CTA blocks are allowed; keep them decorative, never behind body text. Phone first, no sideways scroll at 320 px. Show local amounts first, with the USD₮ they cost. Every screen has loading, empty and error states. Mock-ups and pictures are labelled; live numbers come from live sources. Still no emoji icons, no "AI-powered" badges, no hype words.

## Progress

- [x] 20 Nov: enrolled on Loops House (solo); tag `celo_511bb691f2f0`.
- [x] 20 Nov: tag `pre-celo-hackathon` pushed; branch `celo` created.
- [x] 20 Nov: `packages/celo` attribution helpers + 5 tests (commit `aca3958`).
- [x] 23 Nov: docs pack committed (PRD.md, AGENTS.md, CLAUDE.md, docs/celo/*) (commit `a375eb4`).
- [x] 23 Nov: `.self/` and `*.key` added to `.gitignore`.
- [x] 23 Nov: Loops skill (`.claude/skills`, `.agents/skills`) + Celopedia skills (`.agents/skills`) installed in the repo.
- [ ] Phase 1 spikes S0–S5 (BUILD-PLAN) + decision gate. S0 PASS, S4 PASS (Self agentId 214) 23 Nov, S3 PASS (Textile swap, EOA taker), S5 PASS (first x402 payment to Errand Guard) 24 Nov (evidence/celo/spikes.md).
- [x] 23 Nov: Loops agent wallet on file = `0xc64d2153Bd39053913667A5c2eec8250d8AbC005` (Celo checklist on the Loops playground).
- [x] 23 Nov: Phase 2 (pulled forward): ERC-8004 **agentId 10107** registered from the agent wallet, tagged (tx `0x8b60…2b7c`, `verifyTx` shows `celo_511bb691f2f0`). Evidence: `evidence/celo/identity.md`, `evidence/celo/erc8004-register.json`.
- [x] 23 Nov: Loops Celo checklist shows **ALL SET** (agent wallet on file, tag seen on-chain, ERC-8004 registered).
- [ ] Phase 2 identity: Self Agent ID, ERC-8004, Loops agent wallet + PayTo.
- [ ] Phase 3 Celo rail in the agent. (Started 24 Nov.)
  - [x] `packages/celo/src/textile.ts`: Textile RFQ v2 client (preview, request with keyless TakerControl v1 proof on 401, get/submit/cancel with X-Rfq-Claim, TextileError with code/reason), `validateFirmQuote` (rule R15), 11 tests. **Proof format confirmed live**: Textile accepted our signature and answered `insufficient_funds` for an empty wallet; `builderCodes: ["celo_511bb691f2f0"]` accepted.
  - [x] `packages/celo/src/rules.ts`: R14 corridor, R16 allowlist, R17 tag, errand checks (₦1,500–₦50,000, recipient sanity), tagged cNGN payout; 8 tests. Textile client: API-key mode + `requestWithProof` (relay a browser-signed proof); 2 tests.
  - [x] `pnpm --filter @errand/celo textile-swap [-- --send] [--usd N]`: firm quote → R15 → (dry run: release) / (send: reset+approve → wait → expiry recheck → tagged swap → /submit → poll → verifyTx → evidence JSON). Taker = test wallet.
  - [x] 24 Nov: **first tagged Textile FX conversion on mainnet**: 1 USD₮ → ₦1,445.12 cNGN, rfq `rfq_VaBvtTmO22gNGDPw`, approve `0xea7a…4d71` + swap `0x9731…528b`, both `verifyTx` = `celo_511bb691f2f0`, Textile `filled`. Taker = test wallet (not a user). Spike S3 PASS (EOA variant).
  - [x] Conversion inside an errand in the product: built (4.4).
  - [x] 25 Nov 22:27 UTC: **first real errand through the live site**, inside MiniPay, by an independent user (own wallet, own USD₮; name pending consent) to a recipient outside the team: exactly ₦2,000 cNGN for 1.3874 USD₮; approve `0xed7c…1b5b`, swap `0x1a26…004e`, payout `0xbc98…e4e7`, all success + tagged `celo_511bb691f2f0`, network fees in USD₮; buy check paid `0xa0ac…1304`. Evidence: `evidence/celo/first-errand.md`.
  - [x] 24 Nov: **multi-currency**: `packages/celo/src/currencies.ts` (cNGN, IDRX, wARS, wBRL, wMXN, wCOP with their decimals 6/2/18), limits in dollars ($1.10–$35 per errand, enforced on the preview and again on the firm quote server-side), currency picker with live availability (`/api/textile/currencies`: $5 preview each, greyed out when no makers or <$35 depth, cached 60 s), one-currency sessions (allowlist = transfer() on that token only, per-currency daily cap), copy now "Send local money to anyone" with Nigeria first. E2E: NGN/BRL/IDR live previews, MXN shown unavailable, $35 cap message.
  - [x] 25 Nov: cNGN payout to a recipient outside the team (Corridors requirement 2): payout `0xbc98…e4e7`.
- [ ] Phase 4 web wallet + session; new deployments. (Started 23 Nov, ahead of Phase 3 at Benjamin's request; S1/S2 run inside it.)
  - [x] 4.1 Celo home page (`apps/web`): pitch, how it works, verified on-chain facts, honest build status. Old Kite/SERV pages no longer linked.
  - [x] 4.1 HUMAN: new Vercel project `errand-thgw`, production branch `celo` → **https://errand-thgw.vercel.app** (live 23 Nov). SERV project untouched.
  - [x] 4.2 Wallet screen `/wallet` (23 Nov): Altana passkey wallet (`agentIdentity: false`), address + copy + Celoscan, live USD₮/cNGN/CELO balances, KeyStore set-up status, live setup fee, funding steps, backup file, restore (passkey or file). E2E-tested in headless Chromium with a virtual passkey against the real Altana relay + Celo mainnet (no tx). `packages/celo/src/tokens.ts` + 6 tests.
  - [x] 4.3 Session screen `/session` built (23 Nov): daily caps (₦ and USD₮), allowlist (USD₮ approve, Textile reactor, cNGN transfer), expiry 1/7/30 days, live Altana quote, grant (session key = agent public key only), status, revoke. `packages/celo/src/session.ts` + 9 tests. Quote path E2E-tested. **Grant button locked** (`NEXT_PUBLIC_GRANTS_OPEN` unset) until Altana answers on tagging; revoke never locked.
  - [x] 4.4 Errand composer `/errand` (24 Nov): exact-output Naira (`buyAmount`), live Textile preview, connect any EIP-1193 wallet (switches to Celo), checks E1/E2 + R14, firm quote via server relay (browser signs TakerControl when keyless; `TEXTILE_API_KEY` makes it keyed), R15 (+2% max over preview), R16/R17 on every built call, reset+approve → wait → expiry recheck (re-quote once) → swap → submit → poll → cNGN payout → verifyTx; receipts in localStorage. Relay routes `/api/textile/{config,preview,quote,submit,status}`. E2E with a fake wallet: preview, connect, balance refusal, relayed proof accepted by Textile. **Not yet run with real money.**
  - [x] 24 Nov: **site redesign ("bold fintech")**: dark theme tokens, new home (hero "Money errands, done for you.", live Textile rates as currency tiles, what Errand does, how it works, Errand Guard for agents, on-chain proof, build status, CTA), step progress hero on Wallet/Session/Errand, new header/footer. No sideways scroll at 320 px.
  - [x] 25 Nov: **MiniPay support** in the composer: zero-click connect (`isMiniPay`), no address shown, keyed Textile only (no signing), legacy `eth_sendTransaction` with `feeCurrency` = USD₮ adapter (`USDT_FEE_CURRENCY` in tokens.ts, fee field only), pre-flight check USD₮ ≥ conversion + network-fee reserve (4 tx × 400k gas × `eth_gasPrice(adapter)` / 1e12, min $0.01), low balance → MiniPay Deposit deeplink. Simulated in headless Chromium (fake MiniPay provider, 360×640): no connect button, pre-flight + Deposit link shown. First run inside the real MiniPay app (26 Nov, ~11:09 Lagos) stopped at the approval with "Cannot read properties of undefined (reading '_request')": `send()` called MiniPay's `request` detached from the provider. Fixed (call it on `window.ethereum`); simulation now uses a `this`-dependent fake provider and shows the tagged approval reaching the wallet with `feeCurrency` = adapter. No money moved in the failed run. Also removed CSS blur filters (MiniPay's WebView clipped text next to them) and the unverified "turn it into bank money" hint (cNGN redemption to a bank is documented for businesses only, docs.cngn.co).
  - [x] 25 Nov: **shareable receipts** `/receipt#d=…`: receipt facts in the URL fragment (no database), re-checked on Celo when opened (each tx succeeded, carries the tag, payout = exact amount to the recipient in the right token), share button. Checked live against the S3 txs.
  - [x] 25 Nov: **`tool.buy`**: after each errand Errand pays $0.01 USD₮ on buy for one Chainstack Celo RPC batch (`POST https://gateway.usebuy.ai/chainstack/celo`, PAY.md) and reads every tx back from that independent node; result + payment tx on the receipt. Server route `/api/receipt/verify` pays from Errand's **tools wallet** (`TOOLS_PAYER_KEY`, Vercel only; `pnpm --filter @errand/celo tools-wallet`). Guards: ≤4 hashes, only Errand's own successful tagged txs (free forno pre-check), cached per receipt, ≤40 paid checks/day. Checked live with an unfunded key: buy accepted the payment format and refused only for balance. First paid call 25 Nov: `0xa0ac…1304` (0.01 USD₮ tools wallet → buy), Chainstack confirmed all 3 errand txs.
- [ ] Phase 5 Errand Guard on Celo. (Started 24 Nov.)
  - [x] `apps/guard-celo` built: Hono + `@x402/hono` 2.32 + Celo facilitator (X-API-Key), `POST /check` $0.01 USD₮, PayTo = agent wallet, builder-code extension `a: celo_511bb691f2f0` in the 402, Self Agent ID gate (`SelfAgentVerifier`, mainnet, sybilLimit 1, raw body) → verified 100/day per human, unverified 3/day per IP, refusals (400/429) before payment. Rules G1–G8. 20 tests. Ran locally: real 402 challenge checked; a real Self-signed unregistered key verified against the mainnet registry → unverified.
  - [x] 24 Nov: x402 API key created; new Render web service `errand-guard-celo` (Node, branch `celo`, free) → **https://errand-guard-celo.onrender.com** live; `/health` shows facilitator configured; live 402 challenge checked. SERV services untouched.
  - [x] 24 Nov: **first paid check on mainnet** (unverified caller): $0.01 USD₮ test wallet → agent wallet, tx `0x4781…a606`, decision approve. Spike S5 PASS. Home page marks Errand Guard live.
  - [x] 24 Nov: paid check as a **Self-verified caller** (agent 214): tier verified, 99 left, tx `0x2108…1c03`, 0.01 USD₮ test wallet → agent wallet (checked on chain).
  - [x] Agent card: Guard endpoint added, `x402Support: true`; home page shows Errand Guard ("Ready to try" until the first paid check).
  - [x] `pnpm --filter @errand/guard-celo pay-check [-- --verified]`: pays one check from a test wallet (`.self/test-payer.key`), optional Self signing as agent 214, records to `evidence/celo/guard-checks.jsonl`.
- [ ] Phase 6 real users (≥ 3 independent). **1 of 3** (25 Nov, MiniPay; Benjamin confirmed he did not fund the payer; recipient confirmed receipt; names pending consent).
- [ ] Phase 7 freeze (Thu 3 Dec), README, video. Then complete the Loops submit form (needs live URL, video, named user; other answers ready: agentId 10107, Self 214, tag, PayTo = agent wallet).
- [ ] Phase 8 submit (Sun 6 Dec, before 18:00 Lagos).

## Open questions (resolve, then move the answer to Decisions)

- Q1: Do tagged txs from users' Altana wallets, signed by Errand's agent key as session signer, count toward the entry? (asked in Telegram)
- A1/A2: Does the attribution tag survive Altana's relay, and is the relay a standard EntryPoint `handleOps`? (spike S1)
- A3: Can a session be granted in the browser to a server-held key? **Yes by code reading** (SDK 1.1.0 grantSession reads only the session signer's `publicKey` and `address`); confirm with the first real grant.
- T1: Textile `takerProof` from an Altana smart wallet, or use an API key? Textile docs: smart accounts verify via EIP-1271 (counterfactual via ERC-6492); EOA proof confirmed live 24 Nov. Altana variant still to test (blocked on Q2).

## Decisions

- 20 Nov: Enter with existing project Errand (organisers confirmed existing projects are fine with new code written during the event).
- 20 Nov: Build on branch `celo`; `main` stays as the SERV submission.
- 23 Nov: Celo team (Susanne, Telegram) confirmed again: "We accept existing projects with activity (GitHub commits, new features, onchain traction, etc) during the hackathon period"; switching a project to Celo or making it multi-chain is welcome. Keep Errand; no new project.
- 24 Nov: Organiser email moved dates: Self livestream Mon 24 Nov 14:00 GMT, Altana livestream Tue 25 Nov 14:00 GMT, **AskBots round 1 on Thu 26 Nov** (register before), office hours Thursdays 12:00 GMT. Faucets (CELO 0.25, USD₮ 0.10 per claim) added to RULES.md; builder test wallets only. RULES.md and BUILD-PLAN.md updated.
- 24 Nov: Self livestream takeaways (RULES.md → Self livestream notes): Errand Guard matches Self's own "know your agent gateway" idea; agents' requests are signed and checkable with no API key; Nigerian passports now work; a **public X post tagging @selfxyz and @Celo with demo clip + repo** is expected (added to SUBMISSION.md); buy calls count as real use. Agent Vault quick checkout lists US + 7 Americas countries, so Agent Vault stays stretch-only.
- 24 Nov: AskBots round 1 reviews **submitted** projects (said on the stream). Plan: register by Thu 26 Nov with an honest 60–90 s video of what runs today and a truthful "no independent users yet" in the named-user field; edit later.
- 20 Nov: Tag `celo_511bb691f2f0` lives in `packages/celo`; `ATTRIBUTION_CODE` env may override it.
- 23 Nov: Agent wallet model (PRD §5): one Errand agent key from Self Agent ID `wallet-free` = session signer + ERC-8004 owner + PayTo + Loops agent wallet. User wallets created with `agentIdentity: false`. Pending Q1.
- 23 Nov: Celopedia skill reviewed before commit: Markdown only, no scripts. The installer's "Critical Risk" scan flags code examples (curl, env private keys), not executable code. `docs-watch` (Celopedia maintainers' tool) installed too; not used by Errand.
- 23 Nov: T2 answered by spike S0: Textile previews USD₮→cNGN on 42220 at $1/$5/$20 (≈₦1,447.58 per USD₮, ≈$41k depth, fee ≈2 bps inside sellAmount). Stay on the cNGN corridor; no wFIAT fallback. Compute rates from sellAmount/buyAmount, not the undocumented `rateRay`.
- 23 Nov: **Errand agent wallet = `0xc64d2153Bd39053913667A5c2eec8250d8AbC005`** (Self Agent ID agentId 214, wallet-free, mainnet; evidence/celo/identity.md). Use this one address for the whole event: Loops agent wallet, ERC-8004 owner, PayTo, session signer. Key in `.self/agent.key` on Benjamin's machine only.
- 23 Nov: A4 measured: Altana KeyStore registration fee on Celo = `KeyStoreController.getRegistrationFeeInWei()` = 9.1047 CELO = **$0.50** (oracle-priced from a fixed $0.50 at CELO/USD 0.0549, Chainlink feed 0x0568…Ab7e). The SDK sends fee + 10% and the controller refunds the excess. Paid once per new wallet, in native CELO, from the wallet's own balance. Tell users: hold about 11 CELO (≈$0.60) before the first action.
- 23 Nov: ERC-8004 agent card hosted at `https://raw.githubusercontent.com/softalpha0/Errand/celo/apps/web/public/.well-known/errand-agent.json` (stable HTTPS, same file the Celo web deployment will serve later). Lists only what exists today (`web` = repo, `x402Support: false`); edit the file (HTTPS URI, so no `setAgentURI` needed) when Errand Guard and the live site run.
- 23 Nov: Registered on both ERC-8004 registries, as planned: Self Agent ID registry (agentId 214, proof of human) and the canonical Identity Registry (agentId **10107**, the one the Loops checklist and 8004scan read). Open question on which registry counts is closed.
- 23 Nov: Loops submit form requires a live site, demo video and a named user. No placeholders or invented content (see 24 Nov plan below). On-chain entry requirements are already ALL SET.
- 23 Nov: Phase 4 before Phase 3 (Benjamin's call) so a live Celo site exists early. Vercel auto-deploys the `celo` branch; each step ships as it lands.
- 23 Nov: Celo live site = **https://errand-thgw.vercel.app** (Vercel project `errand-thgw`, Root Directory `apps/web`, production branch `celo`). Agent card `web` service now points there. Use this URL in the Loops form, README and video.
- 23 Nov: **Passkeys are bound to the site's domain** (WebAuthn rpId = host). Wallets created on `errand-thgw.vercel.app` only open there. Don't change the production domain once real users have wallets; Vercel preview URLs won't open them. If a custom domain is wanted, add it before Phase 6.
- 23 Nov: Altana `recoverFromPasskey` only works after a wallet's first transaction (it reads the admin key from KeyStore). Until then the browser's localStorage holds the only copy of the passkey's public key, so the wallet page offers a public-data backup file and a restore-from-file option.
- 23 Nov: **First session grant costs about 19.1 CELO (≈$1.05) per user wallet**: it registers two keys in Altana's KeyStore (the user's passkey + Errand's session key), each the $0.50 fee + 10% margin (excess refunded). Confirmed by the relay's own quote. Keeping `register: true` so the session is visible on the public KeyStore (core of the Altana track). Wallet funding steps ask for 2 × fee × 1.1.
- 23 Nov: Errand's agent public key (`0x0460…6ac7`) recovered from the signature of its ERC-8004 tx; stored in `packages/celo/src/session.ts` (`ERRAND_AGENT`), test checks it maps to `0xc64d…C005`.
- 23 Nov: **Q2 decided by Benjamin: B (wait).** Altana SDK 1.1.0 has no attribution/`dataSuffix` option and grant/revoke take no custom calldata, so those txs can't carry `celo_511bb691f2f0`. No grant is sent until Altana answers (asked in Altana's Telegram). The live site's Grant button is locked behind `NEXT_PUBLIC_GRANTS_OPEN=true`. Meanwhile build what doesn't need Altana txs (Errand Guard on x402: payments to the registered PayTo count without tags; Textile client).
- 24 Nov: Errand Guard tiers: Self Agent ID verified = 100 checks/day per human (nullifier), unverified = 3/day per IP; same $0.01 price. Over-limit and invalid requests are refused before the x402 payment, so nobody is charged for a refusal. Limits are in memory (reset on restart); noted for the README.
- 24 Nov: **Don't register a second Self Agent ID with Benjamin's passport.** Verifiers with the default `sybilLimit(1)` (including Errand Guard) reject every agent of a human who has more than one, which would break Errand's own agent 214. Demo "verified caller" = agent 214 signing; its x402 payment comes from a separate test wallet (never agent wallet → agent wallet).
- 24 Nov: Errand Guard live at **https://errand-guard-celo.onrender.com** (Render free plan: sleeps after 15 min idle, first call ~1 min). PayTo = agent wallet. Payments carry no tag (x402 can't yet); the builder-code extension declares `celo_511bb691f2f0` in every 402.
- 24 Nov: Textile attribution, keyless: `includeAttribution` is for partner keys only, so Errand appends its own ERC-8021 suffix to `transactions.swap.data` (Loops FAQ), once, via the wallet client's `errandAttribution()` extension (never also `tagCalldata`). Also sends `builderCodes: ["celo_511bb691f2f0"]` on the request (accepted; doesn't enable Textile's own tag). The approval tx is tagged too (same client).
- 24 Nov: First Textile conversion uses an EOA taker (Benjamin's test wallet) so the Corridors path is proven while Altana grant/revoke waits on Q2. Product decision on whose wallet converts for real users comes after Altana answers.
- 24 Nov: Errand composer runs from the user's own connected wallet (EIP-1193, e.g. MetaMask) until Altana answers; the user confirms each tx; the same steps will run under an Altana session later. Errands use **exact output** (`buyAmount`) so the recipient gets exactly the Naira asked. Testing limits ₦1,500–₦50,000 per errand.
- 24 Nov: **MiniPay can't sign `eth_signTypedData`/`personal_sign`** (Celopedia minipay-requirements), so keyless Textile proofs are impossible there. MiniPay support needs a **Textile API key** on the server (`TEXTILE_API_KEY`; keyed requests need no proof) plus legacy txs with the USD₮ fee-currency adapter for gas. The composer tells MiniPay users "not yet" until then.
- 24 Nov: **Errand is not Nigeria-only** (Benjamin's call). It pays out in every hackathon corridor Textile can serve at that moment: live check 24 Nov 20:10 UTC ("$5 →"): cNGN ₦7,220 (depth ~$6.5k), IDRX Rp91,659 (~$258k), wARS 8,854 (~$25k), wBRL R$29.53 (~$4.5k); wCOP ~$7 depth and wMXN no makers (shown unavailable). **Nigeria stays the launch market** for the first named users and the video; pitch: "built for any local stablecoin on Celo; first users in Nigeria". Recipients in AR/BR/MX/CO can off-ramp with Ripio (ramp.ripio.com, SPONSORS §10).

- 24 Nov: Textile live API key set as `TEXTILE_API_KEY` on Vercel (`errand-thgw`); `/api/textile/config` shows `keyed: true`; keyed quotes need no taker proof. A key allows at most 4 outstanding RFQs, so the site must not leave quotes open.
- 24 Nov: **Design direction B, "bold fintech"** (Benjamin chose it from two home-page mock-ups). Replaces the calm paper look: dark base, big type, currency colour tiles, glows and gradient CTAs allowed. Design section above rewritten. Home page now says what Errand is (an agent that runs money errands for you inside your limits, plus Errand Guard for other agents), not only "send money".
- 25 Nov: Altana livestream (RULES.md → Altana livestream notes): Altana names remittances limited by session rules as a use case it wants, so Errand's pitch fits the track as is. Q1/Q2 were not answered; re-asked in Altana's Telegram. Altana product reviews (5,000 XP each, specific + reproducible, in their bug-report channel) are worth filing for the SDK gaps we hit.
- 25 Nov: Errand's paid tool on buy = an independent receipt check on Chainstack's Celo RPC ($0.01 per errand), not LLM inference: it is useful to the user (a second node confirms the receipt) and counts as real buy use. It pays from a separate **tools wallet**, never from the agent wallet (whose key stays off servers) or the test wallet.
- 25 Nov: MiniPay support targets running Errand *inside* MiniPay for the hackathon (open the site in MiniPay), **not** a MiniPay listing: listing rules forbid free-text recipient addresses and non-MiniPay tokens (cNGN), which are Errand's core flow.

## Blockers

- 23 Nov: `loops auth login` times out: after Google sign-in the browser lands on loops.house/profile instead of the CLI callback (localhost:54321), also in an incognito window. The skill is installed; CLI sign-in is only needed for `loops project ...` commands. Retry later or ask in the Loops/Celo Telegram.
