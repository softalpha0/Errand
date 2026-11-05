# Kite Passport integration

Errand drives Kite Passport through the `kpass` CLI (tested shapes: v6.13.1 on Windows). Commands and flags come from `kpass --help` and `kpass session create --help` on that version.

| What | Command |
|---|---|
| Ask for a session | `kpass session create --separate --no-reuse --no-browser --task-summary "..." --max-amount-per-tx 0.50 --max-total-amount 2.00 --ttl 1h --output json --no-interactive` |
| Wait for the passkey | `kpass session status --request-id <id> --output json` (polled every 4 s) |
| Use it | `kpass session use --session-id <id>` |
| Pay a call | `kpass session execute --url <url> --idempotency-key <key> --method GET|POST [--headers json] [--body json] --output json` |
| Balance | `kpass wallet balance --output json` |

`--separate` matters: without it, `session create` pays from the account **allowance** with no approval. Errand always asks for a separate, passkey-approved session per errand so the limits are the errand's own.

Exit codes (from `kpass --help`): 0 success or human action needed, 1 network, 2 usage, 3 auth (login expired), 4 not found, 5 rate limited. `apps/agent/src/kite.ts` maps them to plain messages.

## What is not documented, and how Errand copes

The JSON field names printed by `session create`, `session status` and `session execute` are not in Kite's docs. `apps/agent/src/kite-parse.ts` searches the output for the values it needs (`request_id`, an approval URL, `session_id`, a status word, the seller's body, a transaction hash) instead of assuming one shape, and stores the raw output with every payment (server-side only).

**Day-one check (`pnpm spike:kite`, costs $0.003):** it creates a $0.05 session, waits for your passkey, pays Bitrefill's `checkout/info` ($0.001) and a Nigeria MTN top-up search ($0.002), and saves every raw kpass output to `evidence/raw/`. Read those files and, if a field is named differently, add the name to the key lists in `kite-parse.ts`. Write what you found below.

### Findings (first real payments, 5 Nov 2026, kpass 6.13.1 on Windows)

- Before the first session, Kite answered `Agent not registered`. One `kpass agent:register --type errand` fixes it; Errand now registers by itself on that error.
- `session create` returns `request_id`, `approval_url` (agentpassport.ai/agent-session/approve?token=…), `expires_at` (about 10 minutes), `status: human_action_required`, `user_message` and the delegation (`max_amount_per_tx`, `max_total_amount`, `ttl_seconds`). Errand read all of it.
- `session status`: Errand detected "approved" and the new session id (`agent_session_…`), and also read Kite's "Session request expired before the user approved it" correctly when a link was left unapproved.
- `session execute` paid Bitrefill `checkout/info` on **Base**: tx `0x60a88f0096b6f470ca3e67eabe8e29b75b7f1550289752e2ed7c0b37be1cea4f` (basescan.org), and returned the seller body for the top-up search.
- Bitrefill's live search lists `countries: ["NG"]` (a list), not `country`; Errand reads both. Product details is GET `?slug=` (Bitrefill's 402 bazaar: `method: GET`; POST returns 404).

## Money and chains

- Fund the Passport wallet with USDC on **Base** (the wallet has one EVM address on Base, Polygon, Avalanche, Tempo, Robinhood, Arc and Kite, plus a Solana address). Errand's sellers all accept Base USDC, so no routing is needed.
- If funds sit on another supported chain, Kite routes the payment (changelog 8 July 2026). The route shows in the Passport dashboard.
- Do not send USDC on BNB Chain, Tron or Ethereum mainnet to the Passport address: those chains are not tracked by Passport.

## Running kpass on a server

`kpass` keeps its login in `.kite-passport/` in your home folder (`config.json`, `agent.json`). To run the agent on Render:

1. Log in once on your own machine (`kpass login init` / `kpass signup ...`).
2. In Render → the service → Secret Files, add `%USERPROFILE%\.kite-passport\config.json` as `kite-passport-config.json` and `agent.json` as `kite-passport-agent.json`.
3. The Docker entrypoint copies them to `/root/.kite-passport/` with mode 600.

These files are your login. Never commit them (`.kite-passport` is in `.gitignore`). If the login expires, kpass exits with code 3 and the errand fails with "Kite Passport login expired".

Approving a session still needs your passkey on your phone or laptop, so a stranger using the live site cannot spend from your wallet: every errand waits for you. Set `ERRAND_ACCESS_CODE` as well if you don't want strangers creating approval requests.

**Fallback (kill switch):** if kpass will not run headless on Render by 6 Nov, run the agent on your Windows machine (`pnpm dev:agent` with `ERRAND_MODE=live`) during recording, expose it with a tunnel, and keep the hosted site in demo mode. Say so in the write-up.

## Free testing on Kite testnet

From Kite's `kite-x402-services` README: `kpass sandbox on` switches the CLI to testnet, and `kpass faucet drop --recipient <wallet> --token pieUSD` gives free pieUSD. Errand's own sellers (Bitrefill, StableEnrich…) charge on mainnet, so sandbox mode is for testing **Errand Guard** (`kite-service/errand-guard`, deployed with `KITE_NETWORK=testnet`), not for errands. Run `kpass sandbox off` before live errands.

## Errand Guard: contributing a service to Kite

`kite-service/errand-guard/` is a ready-to-PR folder for `gokite-ai/kite-x402-services` (their typescript-express template, `src/` unchanged, plus `service.yaml` validated against their schema and a README). Steps (from their CONTRIBUTING.md):

1. Deploy it (Render blueprint includes it) with `KITE_NETWORK=testnet`, `UPSTREAM_URL` = your agent, a long `UPSTREAM_AUTH_VALUE` equal to the agent's `GUARD_SERVICE_TOKEN`.
2. Confirm an unpaid request returns 402 with `accepts[0].network` = `eip155:2368` (checked locally: yes, pieUSD, payTo = your Passport wallet).
3. Pay once with a sandbox agent; set `status: testnet` and `base_url` in `service.yaml`.
4. Redeploy with `KITE_NETWORK=mainnet`, pay once with USDC, set `status: live`, `network: eip155:2366`.
5. Fork `gokite-ai/kite-x402-services`, copy the folder to `services/errand-guard/`, add a row to `services/README.md`, run `npm run validate`, open a PR titled `feat(services): add errand-guard` with the paid-call output.

## Each person's own Passport (added 5 Nov)

From Kite's `authenticate-user` skill: `kpass login init --email <email> --client agent` emails an 8-character code, and `KPASS_LOGIN_CODE=<code> kpass login verify --login-id <id>` finishes the login (the code goes in an environment variable so it never shows in the process list). Kite's skill also says: "With a local (project) install, each project keeps its own login in its `.kite-passport/` folder."

Errand uses that: each person who connects on `/connect` gets a folder under `PASSPORTS_DIR` with its own `.kite-passport/`, and every `kpass` call for their errands runs in that folder with `HOME`/`USERPROFILE` pointed there too. After the login Errand checks the login really landed in that folder; if it didn't, it logs out and refuses, so one person's login can never pay for another's errand. The browser keeps a random token for the connection; the agent stores only its SHA-256 hash. Disconnect runs `kpass logout` and deletes the folder.

**Verify once with your own email** (live mode): connect on `/connect`, then check that `PASSPORTS_DIR\pp_…\.kite-passport\` holds files and your home folder's `.kite-passport` is unchanged.

## Allowance and standing errands

From Kite's docs ("Allowance and sessions") and `kite-passport` skill: the **allowance** is one weekly, two-weekly or monthly budget (up to $100) approved once with your passkey on agentpassport.ai/overview. `kpass allowance status` is free and read-only. `kpass session execute ... --use-allowance` pays from it, and Kite requires `--idempotency-key` for allowance payments. **The allowance never pays shopping checkouts**, and it is live mode only (not in sandbox).

Standing errands use it: the first run's plan is approved in Errand, later runs repeat that plan on schedule, and Errand reads `allowance status` before each run and skips the run (with Kite's own `user_message`) if the allowance can't cover it.

## Amazon through Kite's shopping checkout

From Kite's `shopping` skill (references/commands.md): `kpass shop:search --query` (free), `shop:cart clear|add|view`, `shop:shipping view|update`, then `shop:checkout --confirmed [--max-total <usd>]`. Kite charges the price cap plus a $1 provider fee up front and the provider refunds the unused part of the cap to the wallet. Checkout needs a separate, passkey-approved session whose per-payment limit covers cap + $1. Kite's rule is never to check out without the person's explicit yes to an order summary; Errand always asks. Errand passes your limit as `--max-total`, and rule R13 blocks any charge other than that cap + $1.
