# Errand inside your assistant (MCP)

Kite Passport installs into any agent; Errand does too. `apps/mcp` is an MCP server that lets Claude Desktop, Claude Code, ChatGPT desktop, Cursor or any MCP client run errands. It talks to an Errand agent over HTTP, so plans and payment checks still run on SERV, and live payments still need your passkey approval in Kite Passport.

## Tools

| Tool | What it does |
|---|---|
| `start_errand` | task, budgetUsd, maxPerPaymentUsd, optional validFor (`1h`/`24h`/`7d`) and askAboveUsd. Returns the plan, the scope and the approval link. |
| `get_errand` | Status, plan, payments, blocked attempts, open questions, answer, receipt link. |
| `answer_question` | Answer Errand when it pauses (price above plan, a second opinion that disagrees, your "ask me above" rule). |
| `approve_demo` | Demo mode only: approve the simulated session. |
| `stop_errand` | Stop; nothing else is paid. |

## Claude Desktop (Windows)

Settings → Developer → Edit Config, then add (adjust the path to where you unzipped Errand):

```json
{
  "mcpServers": {
    "errand": {
      "command": "npx",
      "args": ["tsx", "C:\\Users\\softapha\\projects\\errand\\apps\\mcp\\src\\index.ts"],
      "env": {
        "ERRAND_AGENT_URL": "http://localhost:8787",
        "ERRAND_WEB_URL": "http://localhost:3000"
      }
    }
  }
}
```

Restart Claude Desktop, run `pnpm dev` in the project, and ask: *"Use Errand to send ₦1,000 MTN airtime to 0803 123 4567, budget $2, max $1 per payment."*

For a live site, point `ERRAND_AGENT_URL` at your Render agent and add `ERRAND_ACCESS_CODE`.

## Claude Code

```powershell
claude mcp add errand -- npx tsx C:\Users\softapha\projects\errand\apps\mcp\src\index.ts
```

## Checked

The server was tested over stdio with the MCP protocol: `initialize`, `tools/list` (5 tools), `start_errand` (returned the plan and scope) and `approve_demo` (ran the errand to done in demo mode).
