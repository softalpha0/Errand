#!/usr/bin/env -S npx tsx
/**
 * Errand as an MCP server: run errands from the assistant you already use
 * (any MCP app: desktop AI assistants, ChatGPT desktop, Cursor...), the same way
 * Kite Passport installs into any agent. It talks to an Errand agent over HTTP;
 * every plan and payment check still happens there, on SERV Reasoning, and
 * live payments still need your passkey approval in Kite Passport.
 *
 * Env: ERRAND_AGENT_URL (default http://localhost:8787), ERRAND_ACCESS_CODE (live sites),
 *      ERRAND_WEB_URL (for receipt links, default http://localhost:3000),
 *      ERRAND_PASSPORT_TOKEN (optional: pay from your own connected Kite Passport).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const AGENT = (process.env.ERRAND_AGENT_URL ?? "http://localhost:8787").replace(/\/$/, "");
const WEB = (process.env.ERRAND_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CODE = process.env.ERRAND_ACCESS_CODE ?? "";
const PASSPORT = process.env.ERRAND_PASSPORT_TOKEN ?? "";

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${AGENT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(CODE ? { "x-access-code": CODE } : {}),
      ...(PASSPORT ? { "x-passport-token": PASSPORT } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Errand agent returned ${res.status}`);
  return body;
}

type Errand = {
  id: string;
  status: string;
  task: string;
  mode: string;
  budgetUsd: number;
  plan: { summary: string; constraints: string[]; steps: { id: string; type: string; purpose: string; maxUsd: number }[] } | null;
  kite: { approvalUrl: string | null };
  decisions: { decision: string; reason: string; candidate: { priceUsd: number; url: string } }[];
  payments: { amountUsd: number; simulated: boolean; explorerUrl: string | null }[];
  questions: { id: string; text: string; options: string[]; answer: string | null }[];
  answer: { text: string; citations: { label: string; url: string }[] } | null;
  error: string | null;
};

function summarize(e: Errand): string {
  const spent = e.payments.reduce((a, p) => a + p.amountUsd, 0);
  const lines = [
    `Errand ${e.id}: ${e.status}${e.mode === "demo" ? " (demo mode: payments simulated)" : ""}`,
    `Spent $${spent.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")} of $${e.budgetUsd}.`,
  ];
  if (e.plan) {
    lines.push(`Plan: ${e.plan.summary}`);
    if (e.plan.constraints.length) lines.push(`Scope: ${e.plan.constraints.join(" · ")}`);
    for (const s of e.plan.steps) lines.push(`  - ${s.purpose} (up to $${s.maxUsd})`);
  }
  if (e.status === "awaiting_approval") {
    lines.push(e.kite.approvalUrl ? `Approve the Kite Passport session here: ${e.kite.approvalUrl}` : "Waiting for the user's OK: call approve after they agree to the plan.");
  }
  const open = e.questions.find((q) => q.answer === null);
  if (open) lines.push(`Errand needs an answer (question ${open.id}): ${open.text}${open.options.length ? ` Options: ${open.options.join(" / ")}` : ""}`);
  const blocked = e.decisions.filter((d) => d.decision === "block");
  if (blocked.length) lines.push(`Blocked ${blocked.length}: ${blocked.map((d) => `$${d.candidate.priceUsd} (${d.reason})`).join("; ")}`);
  if (e.answer) lines.push(`Answer: ${e.answer.text}`);
  if (e.error) lines.push(`Error: ${e.error}`);
  lines.push(`Live view: ${WEB}/e/${e.id} · Receipt: ${WEB}/r/${e.id}`);
  return lines.join("\n");
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

const server = new McpServer({ name: "errand", version: "0.1.0" });

server.registerTool(
  "start_errand",
  {
    title: "Start an errand",
    description:
      "Give Errand a task and a budget. It plans every paid step with SERV Reasoning, then waits for the user to approve a Kite Passport session. It can research (web, Reddit, news, Maps), top up phones, buy eSIMs and gift cards, order from Amazon through Kite's checkout (the user confirms the order summary), email results, phone US businesses, and get independent second opinions from Reppo. Nothing is paid until the user approves.",
    inputSchema: {
      task: z.string().min(8).describe("What to do, in the user's words: who it's for, how much, any condition."),
      budgetUsd: z.number().positive().max(50).describe("Most the errand may spend in total, in USD."),
      maxPerPaymentUsd: z.number().min(0.01).max(50).describe("Most any single payment may be, in USD."),
      validFor: z.enum(["1h", "24h", "7d"]).optional().describe("How long the spending session stays valid."),
      askAboveUsd: z.number().positive().optional().describe("Always ask the user before a single payment above this."),
      private: z.boolean().optional().describe("Keep the errand off Reppo's public evaluation network."),
      country: z.string().length(2).optional().describe("The user's country as a 2-letter code (NG, GH, US...). Phone numbers without a + code are read as this country's."),
    },
  },
  async ({ private: priv, ...args }) => {
    const { id } = (await call("/errands", { method: "POST", body: JSON.stringify({ ...args, privacy: priv ? "private" : "public" }) })) as { id: string };
    // Give the planner a moment so the first reply already shows the plan.
    for (let i = 0; i < 20; i++) {
      const e = (await call(`/errands/${id}`)) as Errand;
      if (e.status !== "planning") return text(summarize(e));
      await new Promise((r) => setTimeout(r, 1500));
    }
    return text(`Errand ${id} is still planning. Call get_errand with this id in a few seconds.`);
  },
);

server.registerTool(
  "get_errand",
  { title: "Check an errand", description: "Status, plan, payments, blocked attempts, open questions and the answer for one errand.", inputSchema: { id: z.string() } },
  async ({ id }) => text(summarize((await call(`/errands/${encodeURIComponent(id)}`)) as Errand)),
);

server.registerTool(
  "answer_question",
  {
    title: "Answer Errand's question",
    description: "Errand pauses and asks when it is unsure (a price above plan, a second opinion that disagrees, a missing detail). Pass the user's answer.",
    inputSchema: { id: z.string(), questionId: z.string(), answer: z.string().min(1) },
  },
  async ({ id, questionId, answer }) => {
    await call(`/errands/${encodeURIComponent(id)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer }) });
    await new Promise((r) => setTimeout(r, 1500));
    return text(summarize((await call(`/errands/${encodeURIComponent(id)}`)) as Errand));
  },
);

server.registerTool(
  "repeat_errand",
  {
    title: "Repeat an errand on a schedule",
    description:
      "Set up a standing errand such as 'keep Mum's data topped up, at most $1 a day'. Errand plans the first run with SERV and waits for the user to approve that plan; every later run repeats it once per day or week, paid from the user's Kite allowance, with every payment still checked. Amazon orders can't repeat (Kite's allowance never pays checkouts).",
    inputSchema: {
      task: z.string().min(8).describe("What to repeat, in the user's words."),
      every: z.enum(["day", "week"]).describe("How often."),
      capPerRunUsd: z.number().min(0.01).max(50).describe("Most one run may spend, in USD."),
      maxPerPaymentUsd: z.number().min(0.01).max(50).describe("Most any single payment may be, in USD."),
    },
  },
  async (args) => {
    const { errandId } = (await call("/standing", { method: "POST", body: JSON.stringify(args) })) as { errandId: string };
    for (let i = 0; i < 20; i++) {
      const e = (await call(`/errands/${errandId}`)) as Errand;
      if (e.status !== "planning") return text(summarize(e));
      await new Promise((r) => setTimeout(r, 1500));
    }
    return text(`The first run (${errandId}) is still planning. Call get_errand with this id in a few seconds.`);
  },
);

server.registerTool(
  "approve",
  {
    title: "Approve a plan",
    description: "Approve a plan that needs no passkey: demo errands and standing errands paid from the Kite allowance. Only call it after the user agreed to the plan. Live one-off errands are approved by the user in Kite Passport with a passkey.",
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    await call(`/errands/${encodeURIComponent(id)}/approve`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 2000));
    return text(summarize((await call(`/errands/${encodeURIComponent(id)}`)) as Errand));
  },
);

server.registerTool(
  "stop_errand",
  { title: "Stop an errand", description: "Stop an errand. Nothing else will be paid.", inputSchema: { id: z.string() } },
  async ({ id }) => {
    await call(`/errands/${encodeURIComponent(id)}/cancel`, { method: "POST" });
    return text(`Errand ${id} stopped. Nothing else will be paid.`);
  },
);

await server.connect(new StdioServerTransport());
