import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./env";
import { applyResult, buildTraceInput, evaluateAction, parseEval, readEvaluators } from "./reppo";
import type { Errand, Evaluation } from "@errand/core";

// A completed evaluation in the shape of Reppo's Eval API docs (eval.reppo.xyz/agents.md, Nov 2026).
const completed = {
  id: "ev_1",
  taskType: "action",
  status: "COMPLETED",
  score: 82,
  route: "ship",
  completedAt: "2026-11-10T10:00:58.000Z",
  result: {
    score: 82,
    decision: "accept",
    confidence: "high",
    route: "ship",
    reason: "The eSIM fits the 7-day Ghana trip and the price is normal.",
    rubric_scores: { task_fit: 88, price: 76 },
  },
  trace: { evaluators: [{ evaluator: "eval-a", model: "m1", score: 85, reasoning: "Fits the task." }, { evaluator: "eval-b", score: 79, reasoning: "Fair price." }] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  env.reppo.apiKey = "";
});

describe("reading Reppo's answer", () => {
  it("reads score, route, confidence, reason, rubric and evaluators", () => {
    const r = parseEval(completed);
    expect(r).toMatchObject({ id: "ev_1", status: "COMPLETED", score: 82, route: "ship", decision: "accept", confidence: "high" });
    expect(r.reason).toMatch(/7-day Ghana/);
    expect(r.rubric).toEqual([
      { criterion: "task fit", score: 88 },
      { criterion: "price", score: 76 },
    ]);
    expect(r.evaluators.map((a) => a.agentName)).toEqual(["eval-a", "eval-b"]);
  });

  it("stays empty until the panel finishes", () => {
    const r = parseEval({ id: "ev_2", status: "PROCESSING", score: null, route: null, result: null });
    expect(r).toMatchObject({ status: "PROCESSING", score: null, route: null, reason: null });
  });

  it("does not trip over an evaluator trace in an unknown shape", () => {
    expect(readEvaluators(null)).toEqual([]);
    expect(readEvaluators({ note: "x" })).toEqual([]);
    expect(readEvaluators([{ name: "p", score: 50 }])[0]).toMatchObject({ agentName: "p", score: 50 });
  });

  it("fills a receipt's grade from the result", () => {
    const ev: Evaluation = { evalId: "ev_1", status: "PENDING", submittedAt: null, minSettleAt: null, settledAt: null, score: null, decision: null, confidence: null, verdicts: [], assessments: [], sandbox: false };
    const out = applyResult(ev, parseEval(completed));
    expect(out).toMatchObject({ status: "SETTLED", score: 82, route: "ship", confidenceLabel: "high", decision: "accept" });
    expect(out.verdicts).toHaveLength(2);
    expect(out.assessments).toHaveLength(2);
  });
});

describe("asking Reppo about an agent action", () => {
  it("submits taskType action, polls until COMPLETED and returns the route", async () => {
    env.reppo.apiKey = "test-key";
    const calls: { method: string; url: string; body?: unknown }[] = [];
    let polls = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? "GET", url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      if (init.method === "POST") return new Response(JSON.stringify({ id: "ev_1", status: "QUEUED" }), { status: 201 });
      polls += 1;
      return new Response(JSON.stringify(polls < 2 ? { id: "ev_1", status: "PROCESSING" } : completed), { status: 200 });
    });
    const res = await evaluateAction("User asked: buy a Ghana eSIM. Action: buy the 5 GB plan for $5.40.", 5_000, 5);
    expect(res.ok && res.result.route).toBe("ship");
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://eval.reppo.xyz/api/v1/agents/evals", body: { taskType: "action" } });
    expect(calls.slice(1).every((c) => c.url.endsWith("/agents/evals/ev_1"))).toBe(true);
  });

  it("says why when Reppo is out of credits", async () => {
    env.reppo.apiKey = "test-key";
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 }));
    const res = await evaluateAction("x", 1_000, 5);
    expect(res).toEqual({ ok: false, reason: "Errand's Reppo credits have run out" });
  });

  it("is off without an API key", async () => {
    expect(await evaluateAction("x", 1_000, 5)).toEqual({ ok: false, reason: "Reppo isn't set up on this site" });
  });
});

describe("the grading input", () => {
  it("includes what the user asked and hides phone numbers and emails", () => {
    const e = {
      task: "Send ₦100 MTN airtime to +2347067600352 and email me at me@example.com",
      budgetUsd: 2,
      maxPerPaymentUsd: 1,
      mode: "live",
      plan: null,
      steps: [],
      decisions: [],
      payments: [],
      answer: null,
    } as unknown as Errand;
    const input = buildTraceInput(e);
    expect(input).toMatch(/What the user asked the agent/);
    expect(input).not.toMatch(/7067600352/);
    expect(input).not.toMatch(/me@example\.com/);
    expect(input).toMatch(/Was every paid call necessary/);
  });
});
