/**
 * Day-one Reppo spike.
 *
 *   pnpm spike:reppo            (sandbox: free, placeholder verdict)
 *   REPPO_SANDBOX=false pnpm spike:reppo   (real evaluation: 440 credits, settles in 10+ minutes)
 *
 * Submits a hand-written errand trace, tries a second submit to confirm the
 * 409 "one in flight" rule, then polls until the verdict settles.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Errand } from "@errand/core";
import { env } from "../src/env";
import { read, submit } from "../src/reppo";

const out = path.resolve(import.meta.dirname, "../../../evidence/raw");
mkdirSync(out, { recursive: true });

const sample: Errand = {
  id: "e_spike",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mode: "demo",
  task: "Find what a 7-day Ghana eSIM costs and buy the cheapest if under $8.",
  budgetUsd: 8,
  maxPerPaymentUsd: 7,
  status: "done",
  validFor: "1h",
  askAboveUsd: null,
  funding: "session",
  passportId: null,
  privacy: "public",
  country: "NG",
  standingId: null,
  plan: {
    summary: "Research prices, then buy if under $8.",
    constraints: ["Ghana", "7 days", "under $8"],
    recipients: [],
    questions: [],
    steps: [
      { id: "s1", type: "exa.answer", purpose: "Find prices", inputs: [{ key: "query", value: "Ghana eSIM 7 day price" }], maxUsd: 0.01, condition: "" },
      { id: "s2", type: "buy.esim", purpose: "Buy cheapest", inputs: [{ key: "query", value: "Ghana" }, { key: "amountUsd", value: "6" }], maxUsd: 6.007, condition: "only if under $8" },
    ],
  },
  guardVersion: "spike",
  kite: { requestId: null, sessionId: null, approvalUrl: null, approvedAt: null },
  steps: [
    { stepId: "s1", status: "done", note: "", facts: ["7-day Ghana eSIMs cost $5.40-$9.90."], sources: [], suggestions: ["Also buy the Premium bundle for $9."] },
    { stepId: "s2", status: "done", note: "", facts: ["Bought Ghana eSIM 5 USD for $5.40."], sources: [], suggestions: [] },
  ],
  decisions: [
    { id: "d1", at: "", candidate: { stepId: "s1", endpointId: "exa.answer", url: "https://stableenrich.dev/api/exa/answer", method: "POST", priceUsd: 0.01, origin: "plan" }, decision: "approve", rule: "serv.graph", reason: "Matches step s1.", source: "serv" },
    { id: "d2", at: "", candidate: { stepId: "s1", endpointId: null, url: "https://api.bitrefill.com/x402/invoice/pay", method: "POST", priceUsd: 9, origin: "seller_content" }, decision: "block", rule: "R1.origin", reason: "Suggested inside a paid response.", source: "rules" },
  ],
  payments: [],
  questions: [],
  answer: { text: "The cheapest 7-day Ghana eSIM is $5.40 (3 GB). Bought it. A suggested $9 bundle was refused.", citations: [] },
  evaluation: null,
  events: [],
  error: null,
};

async function main() {
  if (!env.reppo.apiKey) throw new Error("Set REPPO_API_KEY in .env first.");
  console.log(`Submitting (${env.reppo.sandbox ? "sandbox" : "REAL, uses credits"})...`);
  const first = await submit(sample);
  console.log("First submit:", first);
  if (!first.ok) return;
  const second = await submit(sample);
  console.log("Second submit while pending (expect 409 unless sandbox settles instantly):", second);

  for (let i = 0; i < 40; i++) {
    const body = await read(first.evalId);
    const status = String(body?.status ?? "?");
    console.log(new Date().toISOString(), status);
    if (body && status !== "PENDING") {
      writeFileSync(path.join(out, "reppo-sample-verdict.json"), JSON.stringify(body, null, 2));
      console.log("Saved evidence/raw/reppo-sample-verdict.json");
      return;
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
