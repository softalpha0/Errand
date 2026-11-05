import type { Errand } from "@errand/core";

/**
 * The example receipt on the landing page. It is labelled "Example" wherever
 * it is shown, and mirrors what a demo-mode run of the eSIM errand produces.
 */
export const SAMPLE_ERRAND: Errand = {
  id: "e_example",
  createdAt: "2026-11-04T09:12:00.000Z",
  updatedAt: "2026-11-04T09:13:10.000Z",
  mode: "demo",
  task: "I fly to Accra on Friday. Find a 7-day Ghana eSIM and buy the cheapest one if it is under $8.",
  budgetUsd: 8,
  maxPerPaymentUsd: 7,
  validFor: "7d",
  askAboveUsd: 5,
  funding: "session",
  passportId: null,
  privacy: "public",
  standingId: null,
  status: "done",
  plan: null,
  guardVersion: "guard-v2",
  kite: { requestId: null, sessionId: null, approvalUrl: null, approvedAt: null },
  steps: [],
  questions: [],
  answer: null,
  evaluation: null,
  events: [],
  error: null,
  decisions: [
    { id: "d1", at: "", candidate: { stepId: "s1", endpointId: "exa.answer", url: "https://stableenrich.dev/api/exa/answer", method: "POST", priceUsd: 0.01, origin: "plan", note: "Cited answer: Ghana eSIM prices" }, decision: "approve", rule: "serv.graph", reason: "Needed to compare prices.", source: "serv" },
    { id: "d2", at: "", candidate: { stepId: "s2", endpointId: "reddit.search", url: "https://stableenrich.dev/api/reddit/search", method: "POST", priceUsd: 0.02, origin: "plan", note: "What travellers say" }, decision: "approve", rule: "serv.graph", reason: "Checks real experiences.", source: "serv" },
    { id: "d3", at: "", candidate: { stepId: "s2", endpointId: null, url: "https://api.bitrefill.com/x402/invoice/pay", method: "POST", priceUsd: 9, origin: "seller_content" }, decision: "block", rule: "R1.origin", reason: "A Reddit post told the agent to buy a $9 bundle. Not in your plan.", source: "rules" },
    { id: "d4", at: "", candidate: { stepId: "s3", endpointId: "bitrefill.invoice.pay", url: "https://api.bitrefill.com/x402/invoice/pay", method: "POST", priceUsd: 5.4, origin: "plan", note: "Ghana eSIM, 3 GB / 7 days" }, decision: "approve", rule: "serv.graph", reason: "Cheapest plan, under $8.", source: "serv" },
  ],
  payments: [
    { id: "p1", at: "", decisionId: "d1", stepId: "s1", endpointId: "exa.answer", url: "https://stableenrich.dev/api/exa/answer", method: "POST", amountUsd: 0.01, requestHash: "a", txHash: null, explorerUrl: null, chain: null, simulated: true, used: true },
    { id: "p2", at: "", decisionId: "d2", stepId: "s2", endpointId: "reddit.search", url: "https://stableenrich.dev/api/reddit/search", method: "POST", amountUsd: 0.02, requestHash: "b", txHash: null, explorerUrl: null, chain: null, simulated: true, used: true },
    { id: "p3", at: "", decisionId: "d4", stepId: "s3", endpointId: "bitrefill.invoice.pay", url: "https://api.bitrefill.com/x402/invoice/pay", method: "POST", amountUsd: 5.4, requestHash: "c", txHash: null, explorerUrl: null, chain: null, simulated: true, used: true },
  ],
};
