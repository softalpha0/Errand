/**
 * Rules for the public guard service (POST /v1/check on Kite): any Kite
 * Passport agent can ask Errand "should I make this payment?" without having
 * an Errand plan. These are the subset of Errand's rules that make sense with
 * only a task, a payment and some context.
 */
import { round6 } from "./money";
import { normalizePhone } from "./phone";
import type { RuleResult } from "./guard";

export interface ExternalCheck {
  task: string;
  payment: { url: string; method: string; priceUsd: number; recipient?: string; note?: string };
  budgetUsd?: number;
  spentUsd?: number;
  maxPerPaymentUsd?: number;
  /** Recipients the agent's user approved (phones or emails). */
  approvedRecipients?: string[];
  /** Text from earlier paid responses, to spot purchases a seller is steering. */
  earlierText?: string;
}

const STEERING =
  /(must also (buy|purchase|pay)|also (buy|purchase|pay) the|ignore (all |your |previous )?instructions|note to ai|before answering|the user (already )?(agreed|wants))/i;

function norm(v: string): string | null {
  return v.includes("@") ? v.trim().toLowerCase() : (normalizePhone(v, "US") ?? normalizePhone(v, "NG"));
}

export function checkExternal(x: ExternalCheck): RuleResult {
  let url: URL;
  try {
    url = new URL(x.payment.url);
  } catch {
    return { outcome: "block", rule: "E1.url", reason: "The payment URL can't be read." };
  }
  if (url.protocol !== "https:") return { outcome: "block", rule: "E1.https", reason: "Only https sellers can be paid." };
  if (!(x.payment.priceUsd >= 0)) return { outcome: "block", rule: "E2.price", reason: "The price is missing or negative." };

  if (x.maxPerPaymentUsd !== undefined && x.payment.priceUsd > x.maxPerPaymentUsd + 0.000001) {
    return { outcome: "block", rule: "E3.per_payment", reason: `$${x.payment.priceUsd} is above the $${x.maxPerPaymentUsd} per-payment limit.` };
  }
  if (x.budgetUsd !== undefined) {
    const left = round6(x.budgetUsd - (x.spentUsd ?? 0));
    if (x.payment.priceUsd > left + 0.000001) {
      return { outcome: "block", rule: "E4.budget", reason: `$${x.payment.priceUsd} is more than the $${left} left in the budget.` };
    }
  }

  const earlier = x.earlierText ?? "";
  const target = `${url.host}${url.pathname}`;
  const mentionsTarget = earlier.includes(target) || earlier.includes(x.payment.url);
  if (STEERING.test(x.payment.note ?? "") || (mentionsTarget && STEERING.test(earlier))) {
    return { outcome: "block", rule: "E5.steered", reason: "Text inside an earlier paid response is pushing this purchase; the task didn't ask for it." };
  }

  if (x.payment.recipient) {
    const r = norm(x.payment.recipient);
    if (!r) return { outcome: "block", rule: "E6.recipient", reason: `"${x.payment.recipient}" isn't a readable phone number or email.` };
    if (x.approvedRecipients?.length) {
      const ok = x.approvedRecipients.map(norm).includes(r);
      if (!ok) return { outcome: "block", rule: "E6.recipient", reason: `${r} isn't one of the approved recipients.` };
    } else {
      const digits = r.replace(/\D/g, "").slice(-7);
      const inTask = r.includes("@") ? x.task.toLowerCase().includes(r) : x.task.replace(/\D/g, "").includes(digits);
      if (!inTask) return { outcome: "ask", rule: "E6.recipient", reason: `The task doesn't mention ${r}. Confirm the recipient first.` };
    }
  }

  return { outcome: "approve", rule: "external.pass", reason: "Basic checks passed." };
}
