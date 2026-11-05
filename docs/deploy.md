# Run and deploy (Windows / PowerShell first)

## 1. Run it on your computer

Needs Node 22+ and pnpm (`corepack enable` once, in an admin PowerShell).

```powershell
pnpm install
```

```powershell
Copy-Item .env.example .env
```

```powershell
Copy-Item .env.example apps\web\.env.local
```

Leave `ERRAND_MODE=demo` for now. Then start both apps:

```powershell
pnpm dev
```

Open http://localhost:3000. The agent runs at http://localhost:8787/health.

Demo mode works with no keys at all (a small scripted planner stands in for SERV). Add `SERV_API_KEY` to `.env` and planning, every payment check and the answers run on SERV for real, with payments still simulated.

## 2. Go live on your computer

1. Kite Passport is installed and you are logged in (`kpass me --output json`) with USDC on Base in the wallet.
2. In `.env`: `ERRAND_MODE=live`, `SERV_API_KEY=...`. If `kpass` is not on PATH, set `KPASS_BIN=C:\Users\<you>\.kpass\bin\kpass.exe`.
3. Run the day-one checks first:

```powershell
pnpm spike:kite
```

```powershell
pnpm spike:reppo
```

4. `pnpm dev` and start a small errand (a $0.05 budget research question). Approve the session on the Kite page that opens.

## 3. Database (Neon, free)

Create a project at neon.tech, copy the connection string into `DATABASE_URL` (it includes `sslmode=require`). The agent creates its one table on start. Without it, errands live in memory and vanish on restart.

## 4. Agent on Render

1. New → Blueprint → pick the GitHub repo. Render reads `render.yaml` and builds `apps/agent/Dockerfile` from the repo root.
2. Environment: set `WEB_ORIGIN` to your Vercel address, plus `SERV_API_KEY`, `SERV_GUARD_GRAPH_ID`, `SERV_GUARD_VERSION`, `REPPO_API_KEY`, `DATABASE_URL`, `ERRAND_ACCESS_CODE`.
3. For live mode: Secret Files → add `kite-passport-config.json` (contents of `%USERPROFILE%\.kite-passport\config.json`) and `kite-passport-agent.json` (contents of `agent.json`). Then set `ERRAND_MODE=live`.
4. The blueprint uses Render's **free plan** (no card needed). It sleeps after 15 idle minutes and takes about a minute to wake. Keep it awake for free: at cron-job.org, create a job that opens `https://<your-agent>.onrender.com/health` every 10 minutes. One always-on free service fits in Render's 750 free hours a month; let errand-guard sleep. The free plan has no disk, so connected Passports are forgotten on restart (errands and receipts stay in Neon).
5. Check `https://<your-agent>.onrender.com/health`. It should show `"mode":"live"`, a `kpass` version and `"serv":"graph"`.

To see your secret file names without printing their contents:

```powershell
Get-ChildItem "$env:USERPROFILE\.kite-passport"
```

## 5. Web on Vercel

1. vercel.com/new → import the repo → **Root Directory: `apps/web`**. Vercel detects Next.js and pnpm.
2. Environment variables: `NEXT_PUBLIC_AGENT_URL=https://<your-agent>.onrender.com`, `NEXT_PUBLIC_REPO_URL=https://github.com/<you>/errand`.
3. Deploy, then copy the short `.vercel.app` address into the agent's `WEB_ORIGIN` and redeploy the agent.
4. Test like a stranger: open the short link on your phone over mobile data and in a private window.

`NEXT_PUBLIC_*` values are baked in at build time: change them, then redeploy.

## Two sites, one codebase (recommended for judging)

- **Demo site** (`ERRAND_MODE=demo`, no access code): anyone can try the full journey with simulated payments, real SERV reasoning.
- **Live site** (`ERRAND_MODE=live`, access code set): you run the real errands for the video and the evidence. Judges see the receipts with on-chain links.

Deploy the agent twice on Render with different env vars, and the web app twice on Vercel with different `NEXT_PUBLIC_AGENT_URL`.

## When something breaks

| You see | Do |
|---|---|
| "We couldn't reach the Errand agent" | `NEXT_PUBLIC_AGENT_URL` wrong, or the agent is asleep. Open `/health` on the agent. |
| CORS error in the browser console | `WEB_ORIGIN` on the agent must match the web address exactly (no trailing slash). |
| "kpass not found" | Set `KPASS_BIN`, or the Docker build could not install kpass (read the first red line of the build log). |
| "Kite Passport login expired" | Log in again locally, re-upload the two Secret Files. |
| "SERV credits ran out" | Add credits in the SERV console. |
| Reppo shows "paused: out of credits" | Top up in the Reppo console; restart the agent. |
