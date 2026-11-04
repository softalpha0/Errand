/**
 * Checks a SERV plan against the catalog and the user's limits before anyone
 * is asked to approve it. A plan that fails here is sent back to SERV once,
 * then the errand fails with these messages.
 */
import { BUY_OVERHEAD_USD, SECOND_OPINION_USD, fixedStepCost, ENDPOINT_BY_ID, requiredEndpoints } from "./catalog";
import { round6 } from "./money";
import { isNorthAmerican, normalizePhone } from "./phone";
import { stepInput, type Plan } from "./types";
import { normalizeRecipient } from "./guard";

export interface PlanCheck {
  ok: boolean;
  issues: string[];
  totalMaxUsd: number;
  approvedRecipients: string[];
}

export function checkPlan(
  plan: Plan,
  opts: { budgetUsd: number; maxPerPaymentUsd: number; defaultCountry: string },
): PlanCheck {
  const issues: string[] = [];
  const ids = new Set<string>();

  const approvedRecipients: string[] = [];
  for (const r of plan.recipients) {
    if (r.phone) {
      const n = normalizePhone(r.phone, opts.defaultCountry);
      if (!n) issues.push(`Recipient "${r.label}" has a phone number that can't be read: ${r.phone}.`);
      else approvedRecipients.push(n);
    }
    if (r.email) approvedRecipients.push(r.email.trim().toLowerCase());
  }

  for (const step of plan.steps) {
    if (ids.has(step.id)) issues.push(`Step id ${step.id} is used twice.`);
    ids.add(step.id);

    const secondOpinion = stepInput(step, "secondOpinion") === "yes";
    const fixed = fixedStepCost(step.type, secondOpinion);
    if (fixed !== null && step.maxUsd + 0.000001 < fixed) {
      issues.push(`Step ${step.id} (${step.type}) costs $${fixed} but is budgeted at $${step.maxUsd}.`);
    }
    for (const epId of requiredEndpoints(step.type, secondOpinion)) {
      const price = ENDPOINT_BY_ID[epId]?.priceUsd;
      if (price !== null && price !== undefined && price > opts.maxPerPaymentUsd + 0.000001) {
        issues.push(`Step ${step.id} needs a $${price} payment, above the $${opts.maxPerPaymentUsd} per-payment limit.`);
      }
    }

    if (step.type.startsWith("buy.")) {
      const amount = Number(stepInput(step, "amountUsd"));
      if (!Number.isFinite(amount) || amount <= 0) {
        issues.push(`Step ${step.id} must say how much to spend on the product (amountUsd).`);
      } else {
        if (amount > opts.maxPerPaymentUsd + 0.000001) {
          issues.push(`Step ${step.id} buys a $${amount} product, above the $${opts.maxPerPaymentUsd} per-payment limit.`);
        }
        const needed = round6(amount + BUY_OVERHEAD_USD + (secondOpinion ? SECOND_OPINION_USD : 0));
        if (needed > step.maxUsd + 0.000001) {
          issues.push(`Step ${step.id} needs at least $${needed} (product + fees${secondOpinion ? " + second opinion" : ""}).`);
        }
      }
      if (!stepInput(step, "query")) issues.push(`Step ${step.id} needs a product search query.`);
    }

    if (step.type === "buy.topup") {
      const to = stepInput(step, "recipient");
      const n = to ? normalizePhone(to, opts.defaultCountry) : null;
      if (!n) issues.push(`Step ${step.id} needs the phone number to top up.`);
      else if (!approvedRecipients.includes(n)) issues.push(`Step ${step.id} tops up ${n}, who is not listed as a recipient.`);
    }

    if (step.type === "email.send") {
      const to = stepInput(step, "to");
      const n = to ? normalizeRecipient(to, opts.defaultCountry) : null;
      if (!n || !n.includes("@")) issues.push(`Step ${step.id} needs an email address to send to.`);
      else if (!approvedRecipients.includes(n)) issues.push(`Step ${step.id} emails ${n}, who is not listed as a recipient.`);
    }

    if (step.type === "reppo.opinion" && !stepInput(step, "question")) {
      issues.push(`Step ${step.id} needs the question to get a second opinion on.`);
    }

    if (step.type === "phone.call") {
      const to = stepInput(step, "phone");
      const n = to ? normalizePhone(to, "US") : null;
      if (!n || !isNorthAmerican(n)) issues.push(`Step ${step.id}: StablePhone can only call US and Canadian (+1) numbers.`);
      if (!stepInput(step, "task")) issues.push(`Step ${step.id} needs a task for the call.`);
    }
  }

  const totalMaxUsd = round6(plan.steps.reduce((a, s) => a + s.maxUsd, 0));
  if (totalMaxUsd > opts.budgetUsd + 0.000001) {
    issues.push(`The plan could spend $${totalMaxUsd}, more than your $${opts.budgetUsd} budget.`);
  }

  return { ok: issues.length === 0, issues, totalMaxUsd, approvedRecipients };
}
