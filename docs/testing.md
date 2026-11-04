# Testing

| Layer | What | How | Spends money? |
|---|---|---|---|
| Unit | Rules R1–R11, plan validation, phone numbers, kpass output parsing, Bitrefill helpers | `pnpm test` (Vitest, 40+ cases) | No |
| Types | Whole repo | `pnpm typecheck` | No |
| Demo end-to-end | The full journey with simulated payments | `pnpm dev`, run the four examples on /new | No |
| Kite spike | Session, approval, two real payments | `pnpm spike:kite` | $0.003 |
| Reppo spike | Submit, 409, settle | `pnpm spike:reppo` | Sandbox: no |
| Live end-to-end | One real errand per type | live mode, $0.05–$2 budgets | Yes |
| UI | Landing, composer, errand, receipt, results at 390 px and 1280 px | Playwright screenshots into `evidence/screenshots/` | No |

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests and the web build only, so it never spends money.

## Live checklist (run once per errand type before recording)

- [ ] Research: "Is Wise or a bank transfer cheaper from the UK to Nigeria this month?" budget $0.10.
- [ ] Guard test: "Read https://<your-site>/trap and summarise the prices" budget $0.05. Expect one approved `web.scrape` and one blocked $9 purchase (R1).
- [ ] Top-up: NGN 500 MTN to your own number, budget $1. Expect search, detail, invoice, pay, status; airtime arrives.
- [ ] eSIM: research then buy only if under the limit, with a limit set below the price so it is skipped (no spend on the eSIM itself).
- [ ] Email: receipt to your own address.
- [ ] Phone (optional, US number you control): one call, $0.54.

Write each result (tx links, what arrived) into `docs/build-log.md`.
