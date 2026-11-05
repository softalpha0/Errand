import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, checkRules, type GuardContext } from "./guard";
import { checkPlan } from "./validate";
import { SHOP_CHECKOUT_URL, SHOP_FEE_USD, allowanceCanPay, defaultShopCap } from "./catalog";
import type { PaymentCandidate, Plan } from "./types";

const amazon: Plan = {
  summary: "Order a USB-C cable",
  constraints: ["under $12 including tax and shipping"],
  recipients: [],
  questions: [],
  steps: [
    {
      id: "s1",
      type: "buy.amazon",
      purpose: "Order a USB-C cable from Amazon",
      inputs: [
        { key: "query", value: "usb-c cable 6 ft" },
        { key: "maxTotalUsd", value: "12" },
      ],
      maxUsd: 13,
      condition: "",
    },
  ],
};

const opts = { budgetUsd: 13.5, maxPerPaymentUsd: 13.5, defaultCountry: "US" };

// Extra step headroom so R13 itself is what stops a bad charge (R7 would also stop it at 13).
const roomy: Plan = { ...amazon, steps: [{ ...amazon.steps[0]!, maxUsd: 20 }] };

function ctx(): GuardContext {
  return { plan: roomy, payments: [], limits: { ...DEFAULT_LIMITS, totalMaxUsd: 20, maxPerPaymentUsd: 20 }, approvedRecipients: [], defaultCountry: "US" };
}

const checkout = (priceUsd: number, cap: number): PaymentCandidate => ({
  stepId: "s1",
  endpointId: "kite.shop.checkout",
  url: SHOP_CHECKOUT_URL,
  method: "POST",
  body: { maxTotalUsd: cap },
  priceUsd,
  origin: "plan",
  plannedProductUsd: cap,
});

describe("Amazon through Kite's shopping checkout", () => {
  it("accepts a plan whose cap + Kite's $1 fee fits the limits", () => {
    expect(checkPlan(amazon, opts).ok).toBe(true);
  });

  it("refuses a plan whose single checkout charge is above the per-payment limit", () => {
    const r = checkPlan(amazon, { ...opts, maxPerPaymentUsd: 12 });
    expect(r.ok).toBe(false);
    expect(r.issues.join(" ")).toMatch(/\$1 fee \(\$13\) in one payment/);
  });

  it("refuses a step budgeted below cap + fee", () => {
    const short: Plan = { ...amazon, steps: [{ ...amazon.steps[0]!, maxUsd: 12 }] };
    expect(checkPlan(short, opts).issues.join(" ")).toMatch(/needs at least \$13/);
  });

  it("never lets the Kite allowance pay a checkout", () => {
    expect(allowanceCanPay("buy.amazon")).toBe(false);
    expect(allowanceCanPay("buy.topup")).toBe(true);
    expect(checkPlan(amazon, { ...opts, funding: "allowance" }).issues.join(" ")).toMatch(/allowance never pays shopping checkouts/);
  });

  it("R13 approves exactly cap + fee", () => {
    expect(checkRules(checkout(12 + SHOP_FEE_USD, 12), ctx()).outcome).toBe("approve");
  });

  it("R13 blocks a charge above cap + fee", () => {
    const r = checkRules(checkout(13.5, 12), ctx());
    expect(r.outcome).toBe("block");
    expect(r.rule).toBe("R13.checkout");
  });

  it("R13 blocks a cap above the one approved in the plan", () => {
    const r = checkRules(checkout(13.4, 12.4), ctx());
    expect(r.outcome).toBe("block");
    expect(r.reason).toMatch(/above the \$12 you approved/);
  });

  it("matches Kite's default cap: subtotal + max(20%, $5)", () => {
    expect(defaultShopCap(10)).toBe(15);
    expect(defaultShopCap(40)).toBe(48);
  });
});

describe("plan checks against the user's own words", () => {
  const gift = (country: string, email: string): Plan => ({
    summary: "Gift card",
    constraints: [],
    recipients: [{ label: "Me", phone: "", email }],
    questions: [],
    steps: [
      {
        id: "s1",
        type: "buy.giftcard",
        purpose: "Buy a $5 Amazon US gift card",
        inputs: [
          { key: "query", value: "Amazon US" },
          { key: "country", value: country },
          { key: "amountUsd", value: "5" },
        ],
        maxUsd: 5.01,
        condition: "",
      },
    ],
  });
  const task = "Buy a $5 Amazon US gift card for my friend's birthday, and email me the details at me@example.com.";
  const o = { budgetUsd: 6, maxPerPaymentUsd: 5.5, defaultCountry: "NG", sourceText: task };

  it("accepts the store's country and a contact from the task", () => {
    expect(checkPlan(gift("US", "me@example.com"), o).ok).toBe(true);
  });

  it("sends back a US gift card planned for the user's home country", () => {
    expect(checkPlan(gift("NG", "me@example.com"), o).issues.join(" ")).toMatch(/US gift card but sets country NG/);
  });

  it("sends back a contact the user never gave", () => {
    expect(checkPlan(gift("US", "someone.else@gmail.com"), o).issues.join(" ")).toMatch(/not in the user's task/);
  });

  it("matches a phone written locally in the task", () => {
    const p: Plan = { ...gift("US", "me@example.com"), recipients: [{ label: "Mum", phone: "+2348031234567", email: "" }] };
    expect(checkPlan(p, { ...o, sourceText: "top up my mum on 0803 123 4567" }).issues.join(" ")).not.toMatch(/not in the user's task/);
  });
});
