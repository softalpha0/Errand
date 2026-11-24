# Phase 1 spikes: results

Each spike is a script in `packages/celo/scripts/`. Plan and pass/fail rules: `docs/celo/BUILD-PLAN.md` → Phase 1.
Times are UTC. "Test" wallets are Benjamin's own and are never counted as users.

| # | Spike | Result | Date |
|---|---|---|---|
| S0 | Textile `/v2/rfq/preview` USD₮→cNGN on 42220 at $1, $5, $20 | **PASS** | 23 Nov 2026 |
| S1 | Altana tag survival | not run yet | |
| S2 | Server-held session signer | not run yet | |
| S3 | Textile firm quote + swap from an Altana wallet | not run yet | |
| S4 | Self Agent ID `wallet-free` on mainnet | **PASS** (agentId 214) | 23 Nov 2026 |
| S5 | x402 Celo payment to Errand Guard | **PASS** (first paid check) | 24 Nov 2026 |

---

## S0: Textile FX preview, USD₮ → cNGN (PASS)

- **Script:** `packages/celo/scripts/spike-s0-textile-preview.ts` (run: `node packages/celo/scripts/spike-s0-textile-preview.ts`)
- **Endpoint:** `POST https://api.textilecredit.com/v2/rfq/preview`, no credential, no `taker`. Indicative only: nothing reserved, no transaction sent, no money spent.
- **Body:** `{ chainId: 42220, sellToken: USD₮ 0x4806…3D5e, buyToken: cNGN 0xF682…4a4f, sellAmount: "<atomic, 6 decimals>" }`
- **Run at:** 2026-11-23T09:25:56Z

| Sell | HTTP | Status | Receive (cNGN) | ₦ per USD₮ | Fee (USD₮) | Taker pays (USD₮) | Depth, `availableSellAmount` (USD₮) | request_id |
|---|---|---|---|---|---|---|---|---|
| $1 | 200 | preview | ₦1,447.58 | 1,447.58 | 0.000199 | 1.00 | 40,992.89 | req_c6191c69-d500-4dfe-83c8-3e6ee524fb52 |
| $5 | 200 | preview | ₦7,237.88 | 1,447.58 | 0.000999 | 5.00 | 40,992.89 | req_4990f38a-b204-47f4-a503-10d41834ee28 |
| $20 | 200 | preview | ₦28,951.52 | 1,447.58 | 0.003999 | 20.00 | 40,992.89 | req_df886e60-355b-4272-bd50-e861fa34155f |

**What it tells us**
- The USD₮→cNGN corridor is live at Errand's sizes. Rate was flat from $1 to $20; published depth was about $41k, far above what our users will send. (T2 answered.)
- `takerPays` equals `sellAmount`: the fee (about 2 bps) is inside the sell amount, matching the docs ("sellAmount is gross, fee-inclusive").
- `rateRay` came back as about `6.9067e23`. Divided by 1e27 that is about 0.000691 USD₮ per cNGN, i.e. it reads as sell-per-buy, not ₦ per USD₮. The docs don't define `rateRay`, so Errand will compute rates from `sellAmount`/`buyAmount` and not rely on `rateRay`.
- `routing.openMarketQuotesReceived` was 0 on a preview: preview prices from published levels, not live maker quotes. A firm quote (`/rfq/request`, spike S3) can still return `no_quote`; Errand must handle that.
- Corridors fallback (wBRL/wARS) is **not** needed.

---

## S4: Self Agent ID, wallet-free, Celo mainnet (PASS)

- **Steps (Benjamin's machine, PowerShell):** `npx -y -p @selfxyz/agent-sdk@0.3.1 self-agent register init --mode wallet-free --minimum-age 18 --network mainnet --out .self/session.json` → `register open` → scanned the QR with the Self app ("Proof Verified") → `register wait` → `register export --unsafe --out-key .self/agent.key`.
- **Result:** `stage: onchain_verified`, agent `0xc64d2153Bd39053913667A5c2eec8250d8AbC005`, **agentId 214**. Checked independently: Self API `isVerified: true`; `ownerOf(214)` on the registry = the agent address.
- **Registration tx:** `0xe46d880c3de064bc578effbc8f01cd430d0f665b231630cc3e95984a67296fb9` (sent by Self's relayer, so untagged; not an Errand transaction).
- **Learned:** the CLI writes the generated key into `.self/session.json` at `init` (before the scan) and can export it to a file with `--out-key`, so the key never has to be printed. `register status` prints only public fields. The session lasts 30 minutes from `init`. Self pays the registration gas; the agent address still holds no CELO.
- Full identity record: `evidence/celo/identity.md`.

---

## S5: x402 payment on Celo mainnet, to Errand Guard (PASS)

- **Service:** Errand Guard, https://errand-guard-celo.onrender.com (`apps/guard-celo`), `POST /check` priced 10000 units of USD₮ ($0.01), PayTo = Errand's agent wallet `0xc64d2153Bd39053913667A5c2eec8250d8AbC005`, Celo facilitator `https://api.x402.celo.org` with an API key.
- **Payer:** Benjamin's TEST wallet `0x58AcE9cB87Db8e5997288023a53f586498a36C36` (funded with 0.12 USD₮ from his own MiniPay; not a user). Script: `pnpm --filter @errand/guard-celo pay-check`.
- **Result (unverified caller):** HTTP 200, `decision: approve`, tier `unverified`, remaining today 2. Payment settled: tx [`0x4781a9ca5856fba1c683793ff5868e848430c1221da74c719999e439742ea606`](https://celoscan.io/tx/0x4781a9ca5856fba1c683793ff5868e848430c1221da74c719999e439742ea606), block 83644058.
- **Checked on chain:** status success; USD₮ Transfer of 0.01 from `0x58Ac…6C36` to the agent wallet. The tx was sent by the facilitator (`0x0d74d5cefd2e7f24e623330ebe3d8d4cb45ffb48`), which paid the gas. No attribution tag on it (x402 settlements can't carry one yet; the 402 declared `celo_511bb691f2f0` via the builder-code extension, and the PayTo is registered on Loops).
- **Learned:** `wrapFetchWithPayment` passes a `Request` object to the inner fetch. A Self-signing wrapper must unpack method, headers and the exact body string before calling `SelfAgent.fetch(url, options)`, or the request goes out as GET (first `--verified` run got 404, nothing charged). Fixed in `pay-check.ts`.
