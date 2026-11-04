import { describe, expect, it } from "vitest";
import { checkPlan } from "./validate";
import type { Plan } from "./types";

const base: Plan = {
  summary: "Top up Mum",
  constraints: [],
  recipients: [{ label: "Mum", phone: "08031234567", email: "mum@example.com" }],
  questions: [],
  steps: [
    {
      id: "s1",
      type: "buy.topup",
      purpose: "Top up Mum",
      inputs: [
        { key: "query", value: "MTN" },
        { key: "country", value: "NG" },
        { key: "recipient", value: "08031234567" },
        { key: "amountUsd", value: "1" },
      ],
      maxUsd: 1.01,
      condition: "",
    },
    { id: "s2", type: "email.send", purpose: "Tell Mum", inputs: [{ key: "to", value: "mum@example.com" }], maxUsd: 0.02, condition: "" },
  ],
};

const opts = { budgetUsd: 1.5, maxPerPaymentUsd: 1.1, defaultCountry: "NG" };

describe("checkPlan", () => {
  it("accepts a plan inside the limits", () => {
    const r = checkPlan(base, opts);
    expect(r.issues).toEqual([]);
    expect(r.approvedRecipients).toEqual(["+2348031234567", "mum@example.com"]);
  });

  it("rejects a plan over budget", () => {
    expect(checkPlan(base, { ...opts, budgetUsd: 0.5 }).ok).toBe(false);
  });

  it("rejects a top-up to someone not listed", () => {
    const plan = structuredClone(base);
    plan.steps[0]!.inputs[2]!.value = "08030000000";
    expect(checkPlan(plan, opts).issues.join(" ")).toMatch(/not listed/);
  });

  it("rejects a non +1 phone call", () => {
    const plan = structuredClone(base);
    plan.steps.push({ id: "s3", type: "phone.call", purpose: "Call", inputs: [{ key: "phone", value: "+2348031234567" }, { key: "task", value: "Book" }], maxUsd: 0.54, condition: "" });
    expect(checkPlan(plan, { ...opts, budgetUsd: 5 }).issues.join(" ")).toMatch(/\+1/);
  });

  it("rejects an under-budgeted buy step", () => {
    const plan = structuredClone(base);
    plan.steps[0]!.maxUsd = 1;
    expect(checkPlan(plan, opts).ok).toBe(false);
  });
});

describe("CreateErrandSchema", () => {
  it("rejects a per-payment limit below the cheapest paid call", async () => {
    const { CreateErrandSchema } = await import("./types");
    expect(CreateErrandSchema.safeParse({ task: "Answer a question with sources", budgetUsd: 0.2, maxPerPaymentUsd: 0.001 }).success).toBe(false);
    expect(CreateErrandSchema.safeParse({ task: "Answer a question with sources", budgetUsd: 0.2, maxPerPaymentUsd: 0.05 }).success).toBe(true);
  });
});
