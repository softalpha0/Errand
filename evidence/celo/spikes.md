# Phase 1 spikes: results

Each spike is a script in `packages/celo/scripts/`. Plan and pass/fail rules: `docs/celo/BUILD-PLAN.md` → Phase 1.
Times are UTC. "Test" wallets are Benjamin's own and are never counted as users.

| # | Spike | Result | Date |
|---|---|---|---|
| S0 | Textile `/v2/rfq/preview` USD₮→cNGN on 42220 at $1, $5, $20 | **PASS** | 23 Nov 2026 |
| S1 | Altana tag survival | not run yet | |
| S2 | Server-held session signer | not run yet | |
| S3 | Textile firm quote + swap from an Altana wallet | not run yet | |
| S4 | Self Agent ID `wallet-free` on mainnet | not run yet | |
| S5 | x402 Celo payment to an Errand Guard test route | not run yet | |

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
