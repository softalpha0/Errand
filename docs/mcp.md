# Errand inside your assistant (MCP)

Kite Passport installs into any agent; Errand does too. `apps/mcp` is an MCP server, so any app that supports MCP (desktop AI assistants, ChatGPT desktop, Cursor and other code editors) can run errands. It talks to an Errand agent over HTTP, so plans and payment checks still run on SERV, and live payments still need your passkey approval in Kite Passport.

## Tools

| Tool | What it does |
|---|---|
| `start_errand` | task, budgetUsd, maxPerPaymentUsd, optional validFor (`1h`/`24h`/`7d`), askAboveUsd and private. Returns the plan, the scope and the approval link. |
| `repeat_errand` | task, every (`day`/`week`), capPerRunUsd, maxPerPaymentUsd. Plans the first run of a standing errand paid from the Kite allowance; approve its plan with `approve`. |
| `get_errand` | Status, plan, payments, blocked attempts, open questions, answer, receipt link. |
| `answer_question` | Answer Errand when it pauses (price above plan, a second opinion that disagrees, your "ask me above" rule, an Amazon order summary). |
| `approve` | Approve a plan that doesn't need a passkey: demo errands and standing errands on the allowance. |
| `stop_errand` | Stop; nothing else is paid. |

## Setup

Most MCP apps read a JSON config with an `mcpServers` section (look for "MCP", "Developer" or "Tools" in the app's settings). Add this, adjusting the path to where you unzipped Errand:

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

Restart the app, run `pnpm dev` in the project, and ask: *"Use Errand to send ₦1,000 MTN airtime to 0803 123 4567, budget $2, max $1 per payment."*

Command-line agents that add servers with a command take the same thing: the command is `npx tsx <path to apps/mcp/src/index.ts>`.

| Variable | Meaning |
|---|---|
| `ERRAND_AGENT_URL` | Your Errand agent (local, or the Render URL). |
| `ERRAND_WEB_URL` | Where receipt links point. |
| `ERRAND_ACCESS_CODE` | Live sites paying from Errand's own wallet. |
| `ERRAND_PASSPORT_TOKEN` | Pay from your own Kite Passport: connect on the site's `/connect` page, then copy the `errand.passport` value from the browser's local storage. Keep it secret. |

## Checked

The server was tested over stdio with the MCP protocol: `initialize`, `tools/list`, `start_errand` (returned the plan and scope) and `approve` (ran the errand to done in demo mode).
