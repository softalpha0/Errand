# Sellers

Every seller below is listed in the Kite Passport catalog (`ksearch service list`, CLI 6.13.1, 3–4 Nov 2026), and every request shape was read from the seller's own unpaid **HTTP 402** response (`payment-required` header, x402 v2 "bazaar" schema) or published OpenAPI document. Nothing was guessed. The allowlist the guard enforces lives in `packages/core/src/catalog.ts`.

All of them settle in USDC on Base (`eip155:8453`) among other chains. Kite Passport routes payments across chains when the wallet holds funds elsewhere (Kite changelog, 8 July 2026: "x402 payments can now settle on a chain other than the one holding your funds").

## Bitrefill (Kite service id `8c750b3f556a632edf42cd5c`)

Top-ups, eSIMs and gift cards in 180+ countries. Accepts Base, Arbitrum, Polygon, Solana USDC/USDT and Lightning.

| Endpoint | Method | Price | Input |
|---|---|---|---|
| `/x402/topups/search` | GET | $0.002 | `q` (carrier), `country` (ISO-2, optional) |
| `/x402/esims/search` | GET | $0.002 | `q` (country/region), `country` |
| `/x402/gift-cards/search` | GET | $0.002 | `q`, `country` |
| `/x402/products/detail` | GET | $0.001 | `slug` |
| `/x402/invoice/create` | POST | $0.002 | `{"items":[{"product_id","package_value","refill_input"?}]}` (1–15 items; `refill_input` required when `recipient_type` is not `none`) |
| `/x402/invoice/pay` | POST | invoice price (`upto` scheme) | `{"invoice_id"}` |
| `/x402/invoice/status` | GET | $0.001 | `invoice_id` |
| `/x402/checkout/info` | GET | $0.001 | none (describes the storefront) |

Search results: `{products:[{slug,name,country|region,recipient_type,in_stock}]}`. Detail: `{id,name,recipient_type,recipient_required,packages:[{package_value,package_currency}]}`. Invoice: `{invoice_id,price_usdc,price_usd,expires_in_minutes:30}`.

**Important:** "Codes and eSIMs are bound to the paying wallet; recovery and top-ups require the same wallet." Top-ups need no code (they go to the phone). Gift card codes and eSIM QR codes need Sign-In-With-X from the paying wallet (the Kite Passport wallet) on `invoice/status`. Errand does not claim to show gift card codes.

## StableEnrich (`eb46bc3541c1b380e22c5948`)

From `https://stableenrich.dev/openapi.json`. Base, Solana or Tempo.

| Errand step | Endpoint | Price | Body |
|---|---|---|---|
| `exa.answer` | POST `/api/exa/answer` | $0.01 | `{query}` |
| `exa.search` | POST `/api/exa/search` | $0.01 | `{query, numResults}` |
| `reddit.search` | POST `/api/reddit/search` | $0.02 | `{query, sort, timeframe, maxResults≤25}` |
| `news.search` | POST `/api/serper/news` | $0.04 | `{q, num}` |
| `shopping.search` | POST `/api/serper/shopping` | $0.04 | `{q, num}` |
| `maps.search` | POST `/api/google-maps/text-search/partial` | $0.02 | `{textQuery, maxResultCount≤5}` |
| `maps.details` | GET `/api/google-maps/place-details/partial` | $0.02 | `?placeId=` |
| `web.scrape` | POST `/api/firecrawl/scrape` | $0.0126 | `{url}` |

## StableEmail (`8065051cb5322e56fc65197a`)

POST `https://stableemail.dev/api/send`, $0.02, "Send an email from relay@stableemail.dev". Body: `{to: string[] (1–50), subject, text?, html?, cc?, replyTo?, attachments?}`. Catalog status: Works.

## StablePhone (`9b14d31b7a7df777b5e66bf4`)

POST `https://stablephone.dev/api/call`, $0.54. Body: `{phone_number: "^\+1\d{10}$", task (≤4000), first_sentence?, voice?, max_duration (1–30), wait_for_greeting?, record?, model: base|turbo, transfer_phone_number?, voicemail_action: hangup|leave_message|ignore, voicemail_message?, metadata?}`. Returns 403 for numbers on the Do-Not-Call list. **US and Canadian numbers only.** Catalog status: "Retest", so test it once before relying on it.

## Not used, and why

- PostalForm, AgentFax, Amazon, Resy: shown on Kite's landing page but not returned by `ksearch` for this account.
- AgentMail and Firecrawl's own listing: `tempo` payment approach, not x402.
- Kite Router "top-up merchant": tops up Kite Router (Kite's AI model router) credits, not phones.

## Reppo (the second opinion)

Reppo replaced its pay-per-request `x402/evals/lite` endpoint in Nov 2026 (it now returns 404). Errand now asks Reppo's Eval API with its own API key: `POST https://eval.reppo.xyz/api/v1/agents/evals` with `{ taskType: "action", input }`, then polls `GET /agents/evals/{id}` until the evaluator panel finishes (usually 30-90 seconds). The result has a 0-100 `score`, a `route` (ship / review / block), `confidence` (low / medium / high) and a `reason`. It costs 440 of Errand's Reppo credits and nothing for the user, so it no longer goes through Kite. Details in `docs/reppo-loop.md`.

Errand uses it two ways:

- **Second opinion before a judgement-call purchase** (a buy or call step with `secondOpinion: yes`): accept → pay; revise or reject → Errand asks you, quoting the evaluators.
- **`reppo.opinion` step**: an assessment errand ("is this worth it?") answered with research plus the evaluators' verdict.

Reppo is not listed in the Kite catalog; it is an x402 service Kite Passport can pay like any other. Errand's allowlist includes it explicitly.

## Dolphin (not a seller)

`https://lighthouse.dphn.ai/run/text-v/v1`, OpenAI-compatible, `deepseek-ai/DeepSeek-V4.1-Flash` ($0.01 / $0.07 per million tokens), paid from Dolphin API credits, not per call. Errand uses it only to word the emails it sends.
