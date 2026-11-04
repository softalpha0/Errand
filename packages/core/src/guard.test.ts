import { describe, expect, it } from "vitest";
import { checkRules, combine, DEFAULT_LIMITS, requestHash, type GuardContext } from "./guard";
import type { PaymentCandidate, PaymentRecord, Plan } from "./types";

const plan: Plan = {
  summary: "Top up Mum and check eSIM prices",
  constraints: [],
  recipients: [{ label: "Mum", phone: "08031234567", email: "" }],
  questions: [],
  steps: [
    { id: "s1", type: "exa.answer", purpose: "Find typical Ghana eSIM prices", inputs: [{ key: "query", value: "Ghana eSIM 7 days price" }], maxUsd: 0.01, condition: "" },
    {
      id: "s2",
      type: "buy.topup",
      purpose: "Top up Mum's MTN line",
      inputs: [
        { key: "query", value: "MTN" },
        { key: "country", value: "NG" },
        { key: "recipient", value: "08031234567" },
        { key: "amountUsd", value: "1" },
      ],
      maxUsd: 1.01,
      condition: "",
    },
  ],
};

function ctx(payments: PaymentRecord[] = []): GuardContext {
  return {
    plan,
    payments,
    limits: { ...DEFAULT_LIMITS, totalMaxUsd: 1.5, maxPerPaymentUsd: 1.1 },
    approvedRecipients: ["+2348031234567"],
    defaultCountry: "NG",
  };
}

const answer: PaymentCandidate = {
  stepId: "s1",
  endpointId: "exa.answer",
  url: "https://stableenrich.dev/api/exa/answer",
  method: "POST",
  body: { query: "Ghana eSIM 7 days price" },
  priceUsd: 0.01,
  origin: "plan",
};

function paid(c: PaymentCandidate, amount = c.priceUsd): PaymentRecord {
  return {
    id: "p1",
    at: new Date().toISOString(),
    decisionId: "d1",
    stepId: c.stepId,
    endpointId: c.endpointId,
    url: c.url,
    method: c.method,
    amountUsd: amount,
    requestHash: requestHash(c.method, c.url, c.body),
    txHash: null,
    explorerUrl: null,
    chain: null,
    simulated: true,
    used: null,
  };
}

describe("checkRules", () => {
  it("approves a planned call at catalog price", () => {
    expect(checkRules(answer, ctx()).outcome).toBe("approve");
  });

  it("blocks a purchase suggested by a seller's response", () => {
    const r = checkRules({ ...answer, origin: "seller_content" }, ctx());
    expect(r).toMatchObject({ outcome: "block", rule: "R1.origin" });
  });

  it("blocks a URL that is not in the catalog", () => {
    const r = checkRules({ ...answer, url: "https://evil.example/api/premium", endpointId: null }, ctx());
    expect(r).toMatchObject({ outcome: "block", rule: "R2.allowlist" });
  });

  it("blocks a catalog URL that does not belong to the step", () => {
    const r = checkRules({ ...answer, endpointId: "reddit.search", url: "https://stableenrich.dev/api/reddit/search", priceUsd: 0.02 }, ctx());
    expect(r).toMatchObject({ outcome: "block", rule: "R3.in_plan" });
  });

  it("blocks a step id that is not in the plan", () => {
    expect(checkRules({ ...answer, stepId: "s9" }, ctx()).rule).toBe("R3.in_plan");
  });

  it("blocks a seller charging more than its listed price", () => {
    expect(checkRules({ ...answer, priceUsd: 0.05 }, ctx()).rule).toBe("R4.catalog_price");
  });

  it("blocks a repeat of an identical paid request", () => {
    const r = checkRules(answer, ctx([paid(answer)]));
    expect(r).toMatchObject({ outcome: "block" });
    expect(["R7.step_budget", "R8.duplicate"]).toContain(r.rule);
  });

  it("blocks when the total budget would be exceeded", () => {
    const big = paid({ ...answer, stepId: "s2", endpointId: "bitrefill.invoice.pay", url: "https://api.bitrefill.com/x402/invoice/pay" }, 1.495);
    expect(checkRules(answer, ctx([big])).rule).toBe("R6.budget");
  });

  const pay: PaymentCandidate = {
    stepId: "s2",
    endpointId: "bitrefill.invoice.pay",
    url: "https://api.bitrefill.com/x402/invoice/pay",
    method: "POST",
    body: { invoice_id: "inv-1" },
    priceUsd: 1,
    origin: "plan",
    recipient: "+2348031234567",
    plannedProductUsd: 1,
  };

  it("approves an invoice at the planned price for the planned number", () => {
    expect(checkRules(pay, ctx()).outcome).toBe("approve");
  });

  it("accepts the same number written locally", () => {
    expect(checkRules({ ...pay, recipient: "0803 123 4567" }, ctx()).outcome).toBe("approve");
  });

  it("blocks a top-up to a number that is not in the plan", () => {
    expect(checkRules({ ...pay, recipient: "08039999999" }, ctx())).toMatchObject({ outcome: "block", rule: "R10.recipient" });
  });

  it("asks when the invoice is a little above plan", () => {
    expect(checkRules({ ...pay, priceUsd: 1, plannedProductUsd: 0.95 }, ctx()).outcome).toBe("ask");
  });

  it("blocks when the invoice is far above plan", () => {
    expect(checkRules({ ...pay, priceUsd: 1, plannedProductUsd: 0.8 }, ctx()).rule).toBe("R11.invoice");
  });

  it("blocks an invoice above the step budget before comparing prices", () => {
    expect(checkRules({ ...pay, priceUsd: 1.08 }, ctx()).rule).toBe("R7.step_budget");
  });

  it("blocks above the per-payment cap", () => {
    const c = ctx();
    c.limits.maxPerPaymentUsd = 0.5;
    expect(checkRules(pay, c).rule).toBe("R5.per_payment");
  });
});

describe("combine", () => {
  const approve = { outcome: "approve" as const, rule: "rules.pass", reason: "" };
  it("lets SERV make a decision stricter", () => {
    expect(combine(approve, { outcome: "block", rule: "serv", reason: "no" }).outcome).toBe("block");
    expect(combine(approve, { outcome: "ask", rule: "serv", reason: "?" }).outcome).toBe("ask");
  });
  it("never lets SERV loosen a rule block", () => {
    expect(combine({ outcome: "block", rule: "R1", reason: "" }, approve).outcome).toBe("block");
  });
});
