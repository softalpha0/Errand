/**
 * Deterministic payment rules. They run before SERV is asked anything, and a
 * block here is final: SERV can make a decision stricter, never looser.
 *
 * Order matters: the cheapest, most certain checks come first.
 */
import { ENDPOINT_BY_ID, SHOP_FEE_USD, endpointForUrl, requiredEndpoints } from "./catalog";
import { round6, sumUsd } from "./money";
import { normalizePhone } from "./phone";
import { stepInput, type DecisionOutcome, type PaymentCandidate, type PaymentRecord, type Plan } from "./types";

export interface GuardLimits {
  totalMaxUsd: number;
  maxPerPaymentUsd: number;
  /** Hard cap on paid calls in one errand. */
  maxCalls: number;
  /** Invoice price may exceed the planned product price by this share before we ask. */
  askAboveShare: number;
  /** ...and by this share before we block outright. */
  blockAboveShare: number;
  /** User's own rule: always ask before a single payment above this. */
  askAboveUsd?: number | null;
}

export const DEFAULT_LIMITS: Omit<GuardLimits, "totalMaxUsd" | "maxPerPaymentUsd"> = {
  maxCalls: 20,
  askAboveShare: 0.03,
  blockAboveShare: 0.15,
};

export interface GuardContext {
  plan: Plan;
  payments: PaymentRecord[];
  limits: GuardLimits;
  /** E.164 numbers and lower-cased emails the user approved in the plan. */
  approvedRecipients: string[];
  defaultCountry: string;
}

export interface RuleResult {
  outcome: DecisionOutcome;
  rule: string;
  reason: string;
}

const PASS: RuleResult = { outcome: "approve", rule: "rules.pass", reason: "All rule checks passed." };

/** Stable JSON so the same request always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** FNV-1a 32-bit, hex. Enough to spot an identical repeat purchase. */
export function requestHash(method: string, url: string, body?: unknown): string {
  const input = `${method.toUpperCase()} ${url} ${stableStringify(body ?? null)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function spentUsd(payments: PaymentRecord[]): number {
  return sumUsd(payments.map((p) => p.amountUsd));
}

export function normalizeRecipient(value: string, defaultCountry: string): string | null {
  if (value.includes("@")) return value.trim().toLowerCase();
  return normalizePhone(value, defaultCountry);
}

/** Status checks may legitimately repeat; nothing else may. */
const REPEATABLE = new Set(["bitrefill.invoice.status"]);

export function checkRules(c: PaymentCandidate, ctx: GuardContext): RuleResult {
  // R1. Purchases suggested by a seller's response are never followed automatically.
  if (c.origin === "seller_content") {
    return {
      outcome: "block",
      rule: "R1.origin",
      reason: "This purchase was suggested inside a paid response, not in the plan you approved.",
    };
  }

  // R2. Only catalog endpoints, matched on exact URL and method.
  const endpoint = endpointForUrl(c.url, c.method);
  if (!endpoint || (c.endpointId && endpoint.id !== c.endpointId)) {
    return { outcome: "block", rule: "R2.allowlist", reason: `${c.method} ${c.url.split("?")[0]} is not a seller Errand is allowed to pay.` };
  }

  // R3. The endpoint must belong to a step in the approved plan.
  const step = ctx.plan.steps.find((s) => s.id === c.stepId);
  if (!step) {
    return { outcome: "block", rule: "R3.in_plan", reason: "No step in the approved plan covers this payment." };
  }
  const secondOpinion = stepInput(step, "secondOpinion") === "yes";
  if (!requiredEndpoints(step.type, secondOpinion).includes(endpoint.id)) {
    return {
      outcome: "block",
      rule: "R3.in_plan",
      reason: `Step "${step.purpose}" may not pay ${endpoint.id}.`,
    };
  }

  // R4. Fixed-price endpoints must charge what the catalog says.
  if (endpoint.priceUsd !== null && c.priceUsd > endpoint.priceUsd + 0.000001) {
    return {
      outcome: "block",
      rule: "R4.catalog_price",
      reason: `The seller asked $${c.priceUsd} but this call is listed at $${endpoint.priceUsd}.`,
    };
  }

  // R5. Per-payment cap from the Kite session.
  if (c.priceUsd > ctx.limits.maxPerPaymentUsd + 0.000001) {
    return {
      outcome: "block",
      rule: "R5.per_payment",
      reason: `$${c.priceUsd} is above your per-payment limit of $${ctx.limits.maxPerPaymentUsd}.`,
    };
  }

  // R6. Total budget.
  const spent = spentUsd(ctx.payments);
  if (round6(spent + c.priceUsd) > ctx.limits.totalMaxUsd + 0.000001) {
    return {
      outcome: "block",
      rule: "R6.budget",
      reason: `Paying $${c.priceUsd} would take the errand past its $${ctx.limits.totalMaxUsd} budget ($${spent} spent).`,
    };
  }

  // R7. Step budget.
  const stepSpent = spentUsd(ctx.payments.filter((p) => p.stepId === step.id));
  if (round6(stepSpent + c.priceUsd) > step.maxUsd + 0.000001) {
    return {
      outcome: "block",
      rule: "R7.step_budget",
      reason: `Step "${step.purpose}" is planned to cost at most $${step.maxUsd}.`,
    };
  }

  // R8. No paying twice for the same thing.
  const hash = requestHash(c.method, c.url, c.body);
  if (!REPEATABLE.has(endpoint.id) && ctx.payments.some((p) => p.requestHash === hash)) {
    return { outcome: "block", rule: "R8.duplicate", reason: "This exact request was already paid for in this errand." };
  }

  // R9. Call cap.
  if (ctx.payments.length >= ctx.limits.maxCalls) {
    return { outcome: "block", rule: "R9.call_cap", reason: `An errand may make at most ${ctx.limits.maxCalls} paid calls.` };
  }

  // R10. Money and messages only go to people named in the plan.
  if (c.recipient !== undefined) {
    const norm = normalizeRecipient(c.recipient, ctx.defaultCountry);
    if (!norm) {
      return { outcome: "block", rule: "R10.recipient", reason: `Could not read "${c.recipient}" as a phone number or email.` };
    }
    if (!ctx.approvedRecipients.includes(norm)) {
      return {
        outcome: "block",
        rule: "R10.recipient",
        reason: `${norm} is not one of the recipients in the plan you approved.`,
      };
    }
  }

  // R11. Invoice price against the planned product price.
  if (endpoint.id === "bitrefill.invoice.pay") {
    const planned = c.plannedProductUsd;
    if (planned === undefined || planned <= 0) {
      return { outcome: "block", rule: "R11.invoice", reason: "No planned product price to compare the invoice with." };
    }
    const over = (c.priceUsd - planned) / planned;
    if (over > ctx.limits.blockAboveShare) {
      return {
        outcome: "block",
        rule: "R11.invoice",
        reason: `The invoice is $${c.priceUsd}, ${Math.round(over * 100)}% above the planned $${planned}.`,
      };
    }
    if (over > ctx.limits.askAboveShare) {
      return {
        outcome: "ask",
        rule: "R11.invoice",
        reason: `The invoice is $${c.priceUsd}, ${Math.round(over * 100)}% above the planned $${planned}. Pay it?`,
      };
    }
  }

  // R13. Amazon checkout: Kite charges exactly the approved price cap + its $1 fee, never more.
  if (endpoint.id === "kite.shop.checkout") {
    const cap = c.plannedProductUsd;
    const planned = Number(stepInput(step, "maxTotalUsd"));
    if (cap === undefined || cap <= 0) {
      return { outcome: "block", rule: "R13.checkout", reason: "No price cap for this order." };
    }
    if (Number.isFinite(planned) && cap > planned + 0.000001) {
      return { outcome: "block", rule: "R13.checkout", reason: `The order cap $${cap} is above the $${planned} you approved.` };
    }
    if (c.priceUsd > round6(cap + SHOP_FEE_USD) + 0.000001) {
      return { outcome: "block", rule: "R13.checkout", reason: `Kite should charge the $${cap} cap + $${SHOP_FEE_USD} fee, but the charge is $${c.priceUsd}.` };
    }
  }

  // R12. The user's own rule: confirm any single payment above a set amount.
  const askAbove = ctx.limits.askAboveUsd;
  if (askAbove !== undefined && askAbove !== null && c.priceUsd > askAbove + 0.000001) {
    return {
      outcome: "ask",
      rule: "R12.ask_above",
      reason: `This payment is $${c.priceUsd}, above the $${askAbove} you asked to confirm first.`,
    };
  }

  return PASS;
}

/** Combine a rules result with SERV's decision. SERV can only make it stricter. */
export function combine(rules: RuleResult, serv: RuleResult | null): RuleResult {
  if (rules.outcome === "block") return rules;
  if (!serv) return rules;
  const rank: Record<DecisionOutcome, number> = { approve: 0, ask: 1, block: 2 };
  return rank[serv.outcome] >= rank[rules.outcome] ? serv : rules;
}

export function endpointPrice(endpointId: string): number | null {
  return ENDPOINT_BY_ID[endpointId]?.priceUsd ?? null;
}
