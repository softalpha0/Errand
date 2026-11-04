#!/usr/bin/env -S npx tsx
/**
 * Errand as an MCP server: run errands from the assistant you already use
 * (Claude Desktop, Claude Code, ChatGPT desktop, Cursor...), the same way Kite
 * Passport installs into any agent. It talks to an Errand agent over HTTP;
 * every plan and payment check still happens there, on SERV Reasoning, and
 * live payments still need your passkey approval in Kite Passport.
 *
 * Env: ERRAND_AGENT_URL (default http://localhost:8787), ERRAND_ACCESS_CODE (live sites),
 *      ERRAND_WEB_URL (for receipt links, default http://localhost:3000).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const AGENT = (process.env.ERRAND_AGENT_URL ?? "http://localhost:8787").replace(/\/$/, "");
const WEB = (process.env.ERRAND_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CODE = process.env.ERRAND_ACCESS_CODE ?? "";

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${AGENT}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(CODE ? { "x-access-code": CODE } : {}), ...(init?.headers ?? {}) },
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
    lines.push(e.kite.approvalUrl ? `Approve the Kite Passport session here: ${e.kite.approvalUrl}` : "Waiting for approval (demo: call approve_demo).");
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
      "Give Errand a task and a budget. It plans every paid step with SERV Reasoning, then waits for the user to approve a Kite Passport session. It can research (web, Reddit, news, Maps), top up phones, buy eSIMs and gift cards, email results, phone US businesses, and get independent second opinions from Reppo. Nothing is paid until the user approves.",
    inputSchema: {
      task: z.string().min(8).describe("What to do, in the user's words: who it's for, how much, any condition."),
      budgetUsd: z.number().positive().max(50).describe("Most the errand may spend in total, in USD."),
      maxPerPaymentUsd: z.number().min(0.01).max(50).describe("Most any single payment may be, in USD."),
      validFor: z.enum(["1h", "24h", "7d"]).optional().describe("How long the spending session stays valid."),
      askAboveUsd: z.number().positive().optional().describe("Always ask the user before a single payment above this."),
    },
  },
  async (args) => {
    const { id } = (await call("/errands", { method: "POST", body: JSON.stringify(args) })) as { id: string };
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
  "approve_demo",
  { title: "Approve (demo mode only)", description: "In demo mode, approve the simulated spending session. Live errands are approved by the user in Kite Passport with a passkey.", inputSchema: { id: z.string() } },
  async ({ id }) => {
    await call(`/errands/${encodeURIComponent(id)}/demo-approve`, { method: "POST" });
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
