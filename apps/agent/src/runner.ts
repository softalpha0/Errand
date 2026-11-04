/**
 * The errand lifecycle:
 *   planning -> (needs_input) -> awaiting_approval -> running -> done | failed
 *
 * Every paid call goes through pay(): rules first, then SERV, then Kite.
 * Nothing reaches kpass unless the combined decision is "approve".
 */
import { randomBytes } from "node:crypto";
import {
  DEFAULT_LIMITS,
  ENDPOINT_BY_ID,
  SELLERS,
  checkPlan,
  checkRules,
  combine,
  endpointForUrl,
  formatUsd,
  isNorthAmerican,
  maskPhone,
  normalizePhone,
  requestHash,
  spentUsd,
  stepInput,
  type CreateErrandInput,
  type Errand,
  type ErrandEvent,
  type GuardContext,
  type GuardDecision,
  type PaymentCandidate,
  type PlanStep,
  type Question,
  type StepResult,
} from "@errand/core";
import { publish } from "./bus";
import * as dolphin from "./dolphin";
import { redact } from "./reppo";
import { demoExecute, scriptedCondition, scriptedGuard, scriptedPlan, scriptedRead, scriptedSummary } from "./demo";
import { env, reppoConfigured, servConfigured } from "./env";
import * as kite from "./kite";
import { log } from "./log";
import { emailBody } from "./prompts";
import * as sellers from "./sellers";
import * as serv from "./serv";
import { store } from "./store";

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString("base64url")}`;

class Blocked extends Error {}
class Cancelled extends Error {}

// ---------- persistence helpers ----------

async function save(e: Errand) {
  e.updatedAt = now();
  await store.put(e);
  publish(e);
}

function event(e: Errand, type: ErrandEvent["type"], message: string, data?: unknown) {
  e.events.push({ at: now(), type, message, ...(data === undefined ? {} : { data }) });
}

// ---------- waiting for the user ----------

const waiters = new Map<string, (answer: string) => void>();
const cancelled = new Set<string>();

function waitFor(key: string): Promise<string> {
  return new Promise((resolve) => waiters.set(key, resolve));
}

async function ask(e: Errand, text: string, options: string[], context: string): Promise<string> {
  const q: Question = { id: newId("q"), at: now(), text, options, answer: null, context };
  e.questions.push(q);
  const before = e.status;
  e.status = "needs_input";
  event(e, "question", text, { questionId: q.id, options });
  await save(e);
  const answer = await waitFor(`${e.id}:${q.id}`);
  if (cancelled.has(e.id)) throw new Cancelled("Cancelled.");
  // Keep working on this same object: steps and facts held by the caller must stay attached.
  q.answer = answer;
  e.status = before === "needs_input" ? "running" : before;
  event(e, "log", `You answered: ${answer}`);
  await save(e);
  return answer;
}

export async function answerQuestion(errandId: string, questionId: string, answer: string): Promise<boolean> {
  const fn = waiters.get(`${errandId}:${questionId}`);
  if (!fn) return false;
  waiters.delete(`${errandId}:${questionId}`);
  fn(answer);
  return true;
}

export async function approveDemo(errandId: string): Promise<boolean> {
  const fn = waiters.get(`${errandId}:approve`);
  if (!fn) return false;
  waiters.delete(`${errandId}:approve`);
  fn("approved");
  return true;
}

export async function cancelErrand(errandId: string): Promise<boolean> {
  const e = await store.get(errandId);
  if (!e || ["done", "failed", "cancelled"].includes(e.status)) return false;
  cancelled.add(errandId);
  for (const [key, fn] of waiters) if (key.startsWith(`${errandId}:`)) fn("no");
  e.status = "cancelled";
  event(e, "status", "Cancelled by you. Nothing else will be paid.");
  await save(e);
  return true;
}

function checkCancelled(e: Errand) {
  if (cancelled.has(e.id)) throw new Cancelled("Cancelled.");
}

// ---------- one Kite session at a time ----------

let kiteChain: Promise<unknown> = Promise.resolve();
function withKiteLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = kiteChain.then(fn, fn);
  kiteChain = next.catch(() => undefined);
  return next;
}

// ---------- create ----------

export async function createErrand(input: CreateErrandInput): Promise<Errand> {
  const t = now();
  const task = input.email && !input.task.includes(input.email) ? `${input.task}\n\nMy email: ${input.email}` : input.task;
  const e: Errand = {
    id: newId("e"),
    createdAt: t,
    updatedAt: t,
    mode: env.mode,
    task,
    budgetUsd: Math.min(input.budgetUsd, env.maxBudgetUsd),
    maxPerPaymentUsd: Math.min(input.maxPerPaymentUsd, input.budgetUsd, env.maxBudgetUsd),
    validFor: input.validFor ?? "1h",
    askAboveUsd: input.askAboveUsd ?? null,
    status: "planning",
    plan: null,
    guardVersion: env.serv.guardVersion,
    kite: { requestId: null, sessionId: null, approvalUrl: null, approvedAt: null },
    steps: [],
    decisions: [],
    payments: [],
    questions: [],
    answer: null,
    evaluation: null,
    events: [],
    error: null,
  };
  event(e, "status", env.mode === "demo" ? "Errand created in demo mode: payments are simulated." : "Errand created.");
  await save(e);
  void lifecycle(e).catch(async (err) => {
    const fresh = (await store.get(e.id)) ?? e;
    if (err instanceof Cancelled) return;
    fresh.status = "failed";
    fresh.error = err instanceof Error ? err.message : String(err);
    event(fresh, "error", fresh.error);
    log.error("errand.failed", { id: e.id, error: fresh.error });
    await save(fresh);
  });
  return e;
}

// ---------- lifecycle ----------

async function lifecycle(e: Errand) {
  await planPhase(e);
  await approvalPhase(e);
  await withKiteLock(async () => {
    if (env.mode === "live" && e.kite.sessionId) await kite.useSession(e.kite.sessionId);
    await runPhase(e);
  });
}

async function planPhase(e: Errand) {
  const useServ = servConfigured();
  if (!useServ && env.mode === "live") throw new Error("Live mode needs SERV_API_KEY.");
  const answers: { q: string; a: string }[] = [];

  for (let round = 0; round < 2; round++) {
    let feedback: string[] | undefined;
    let accepted = false;
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      checkCancelled(e);
      const plan = useServ
        ? (await serv.plan({ task: e.task, budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, feedback, answers })).plan
        : scriptedPlan(e.task, e.budgetUsd);
      const check = checkPlan(plan, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: env.defaultCountry });
      if (check.ok) {
        e.plan = plan;
        accepted = true;
      } else {
        feedback = check.issues;
        event(e, "log", `Plan sent back to SERV: ${check.issues.join(" ")}`);
        await save(e);
        if (attempt === 1) throw new Error(`SERV could not make a plan inside your limits: ${check.issues.join(" ")}`);
      }
    }
    const plan = e.plan!;
    e.steps = plan.steps.map((s) => ({ stepId: s.id, status: "pending", note: "", facts: [], sources: [], suggestions: [] }));
    event(e, "plan_ready", plan.summary, { totalMaxUsd: checkPlan(plan, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: env.defaultCountry }).totalMaxUsd });
    await save(e);

    if (plan.questions.length && round === 0) {
      for (const q of plan.questions) {
        const a = await ask(e, q, [], "The planner needs this before it can finish the plan.");
        answers.push({ q, a });
      }
      e.status = "planning";
      await save(e);
      continue;
    }
    return;
  }
}

async function approvalPhase(e: Errand) {
  const total = checkPlan(e.plan!, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: env.defaultCountry }).totalMaxUsd;
  const maxTotal = Math.min(e.budgetUsd, Math.max(total, 0.01));
  e.status = "awaiting_approval";

  if (env.mode === "demo") {
    event(e, "awaiting_approval", `Approve a session of up to ${formatUsd(maxTotal)} (demo: no passkey needed).`);
    await save(e);
    await waitFor(`${e.id}:approve`);
    checkCancelled(e);
    e.kite.approvedAt = now();
    e.status = "running";
    event(e, "status", "Session approved (simulated).");
    await save(e);
    return;
  }

  const req = await kite.createSession({ taskSummary: `Errand: ${e.task}`, maxPerTxUsd: e.maxPerPaymentUsd, maxTotalUsd: maxTotal, ttl: e.validFor });
  e.kite.requestId = req.requestId;
  e.kite.sessionId = req.sessionId;
  e.kite.approvalUrl = req.approvalUrl;
  event(e, "awaiting_approval", `Approve a Kite Passport session of up to ${formatUsd(maxTotal)}, at most ${formatUsd(e.maxPerPaymentUsd)} per payment.`, {
    approvalUrl: req.approvalUrl,
  });
  await save(e);
  if (!req.requestId) throw new Error("Kite did not return a session request id. See the agent log for kpass output.");

  const deadline = Date.now() + env.kite.approvalTimeoutMs;
  while (Date.now() < deadline) {
    checkCancelled(e);
    await new Promise((r) => setTimeout(r, 4000));
    const st = await kite.sessionStatus(req.requestId);
    if (st.state === "approved") {
      e.kite.sessionId = st.sessionId ?? e.kite.sessionId;
      if (!e.kite.sessionId) throw new Error("Kite approved the session but returned no session id.");
      e.kite.approvedAt = now();
      e.status = "running";
      event(e, "status", "Kite Passport session approved.");
      await save(e);
      return;
    }
    if (st.state === "rejected") throw new Error("The Kite Passport session was declined or expired. Nothing was paid.");
  }
  throw new Error("The Kite Passport session was not approved in time. Nothing was paid.");
}

// ---------- the guarded payment ----------

function guardContext(e: Errand): GuardContext {
  const check = checkPlan(e.plan!, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: env.defaultCountry });
  return {
    plan: e.plan!,
    payments: e.payments,
    limits: { ...DEFAULT_LIMITS, totalMaxUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, askAboveUsd: e.askAboveUsd },
    approvedRecipients: check.approvedRecipients,
    defaultCountry: env.defaultCountry,
  };
}

function allFacts(e: Errand): string[] {
  return e.steps.flatMap((s) => s.facts);
}

async function decide(e: Errand, c: PaymentCandidate, step: PlanStep | null): Promise<GuardDecision> {
  const rules = checkRules(c, guardContext(e));
  let servResult: { outcome: "approve" | "block" | "ask"; rule: string; reason: string } | null = null;
  let servRequestId: string | null = null;
  let servModel: string | null = null;

  if (rules.outcome !== "block") {
    try {
      if (servConfigured()) {
        const { reply, meta } = await serv.guard({
          task: e.task,
          step,
          payment: { url: c.url, method: c.method, body: c.body, priceUsd: c.priceUsd, recipient: c.recipient, plannedProductUsd: c.plannedProductUsd, note: c.note },
          rules,
          spentUsd: spentUsd(e.payments),
          budgetUsd: e.budgetUsd,
          earlierFacts: allFacts(e).slice(-20),
          earlierDecisions: e.decisions.slice(-10).map((d) => ({ decision: d.decision, reason: d.reason, url: d.candidate.url })),
          constraints: e.plan?.constraints ?? [],
        });
        servResult = { outcome: reply.decision, rule: meta.model.startsWith("gr_") ? "serv.graph" : "serv.shadow_agent", reason: reply.reason };
        servRequestId = meta.requestId;
        servModel = meta.model;
      } else {
        const reply = scriptedGuard();
        servResult = { outcome: reply.decision, rule: "demo.scripted", reason: reply.reason };
      }
    } catch (err) {
      servResult = { outcome: "ask", rule: "serv.unavailable", reason: `${serv.servErrorMessage(err)} Errand will not pay without a check unless you confirm.` };
    }
  }

  const final = combine(rules, servResult);
  const d: GuardDecision = {
    id: newId("d"),
    at: now(),
    candidate: c,
    decision: final.outcome,
    rule: final.rule,
    reason: final.reason,
    source: final === rules ? "rules" : "serv",
    servRequestId,
    servModel,
  };
  e.decisions.push(d);
  const label = d.decision === "approve" ? "Approved" : d.decision === "block" ? "Blocked" : "Needs you";
  event(e, "decision", `${label}: ${formatUsd(c.priceUsd)} to ${sellerName(c.url)}. ${d.reason}`, { decisionId: d.id });
  await save(e);
  return d;
}

function sellerName(url: string): string {
  const ep = endpointForUrl(url, "GET") ?? endpointForUrl(url, "POST");
  return ep ? SELLERS[ep.seller].name : new URL(url).host;
}

async function pay(
  e: Errand,
  req: sellers.SellerRequest,
  opts: { step: PlanStep; recipient?: string; plannedProductUsd?: number; priceUsd?: number; note?: string },
): Promise<unknown> {
  checkCancelled(e);
  const catalogPrice = ENDPOINT_BY_ID[req.endpointId]?.priceUsd ?? null;
  let price = opts.priceUsd ?? catalogPrice ?? 0;
  let note = opts.note;
  if (env.mode === "live" && catalogPrice !== null && opts.priceUsd === undefined) {
    const quoted = await sellers.quoteUsd(req);
    if (quoted !== null) {
      price = quoted;
      note = `${note ? `${note} ` : ""}Seller quoted ${formatUsd(quoted)} before payment.`;
    }
  }

  const candidate: PaymentCandidate = {
    stepId: opts.step.id,
    endpointId: req.endpointId,
    url: req.url,
    method: req.method,
    body: req.body,
    priceUsd: price,
    origin: "plan",
    recipient: opts.recipient,
    plannedProductUsd: opts.plannedProductUsd,
    note,
  };

  let d = await decide(e, candidate, opts.step);
  if (d.decision === "ask") {
    const answer = await ask(e, `${d.reason} Pay ${formatUsd(price)} to ${sellerName(req.url)}?`, ["Pay it", "Don't pay"], `Step: ${opts.step.purpose}`);
    const yes = /^(pay|yes|y|ok|approve)/i.test(answer.trim());
    const follow: GuardDecision = {
      ...d,
      id: newId("d"),
      at: now(),
      decision: yes ? "approve" : "block",
      rule: "user.answer",
      reason: yes ? "You confirmed this payment." : "You declined this payment.",
      source: "rules",
    };
    e.decisions.push(follow);
    event(e, "decision", `${yes ? "Approved" : "Blocked"} by you: ${formatUsd(price)} to ${sellerName(req.url)}.`, { decisionId: follow.id });
    await save(e);
    d = follow;
  }
  if (d.decision !== "approve") throw new Blocked(d.reason);

  const result =
    env.mode === "demo"
      ? demoExecute(req)
      : await kite.execute({ url: req.url, method: req.method, body: req.body, idempotencyKey: `${e.id}-${d.id}` });

  e.payments.push({
    id: newId("p"),
    at: now(),
    decisionId: d.id,
    stepId: opts.step.id,
    endpointId: req.endpointId,
    url: req.url,
    method: req.method,
    amountUsd: result.amountUsd ?? price,
    requestHash: requestHash(req.method, req.url, req.body),
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    chain: result.chain,
    simulated: env.mode === "demo",
    used: null,
    raw: env.mode === "live" ? result.raw : undefined,
  });
  event(e, "payment", `${env.mode === "demo" ? "Simulated payment" : "Paid"} ${formatUsd(result.amountUsd ?? price)} to ${sellerName(req.url)}.`, {
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
  });
  await save(e);
  return result.body;
}

/** Every purchase a seller's text suggests is put through the guard and logged. R1 blocks it. */
async function screenSuggestions(e: Errand, step: PlanStep, suggestions: string[]) {
  for (const s of suggestions) {
    const url = s.match(/https?:\/\/[^\s"')]+/)?.[0] ?? "https://unknown.seller/suggested";
    const price = Number(s.match(/\$(\d+(\.\d+)?)/)?.[1] ?? 0);
    const c: PaymentCandidate = {
      stepId: step.id,
      endpointId: null,
      url,
      method: "POST",
      priceUsd: price,
      origin: "seller_content",
      note: `Suggested by the seller's response: "${s.slice(0, 160)}"`,
    };
    await decide(e, c, step);
  }
}

async function readPaid(e: Errand, step: PlanStep, endpointId: string, body: unknown) {
  if (servConfigured()) {
    try {
      const { reply } = await serv.read({ task: e.task, purpose: step.purpose, seller: SELLERS[ENDPOINT_BY_ID[endpointId]!.seller].name, response: body });
      return reply;
    } catch (err) {
      event(e, "log", `SERV could not read the response: ${serv.servErrorMessage(err)}`);
      return { facts: [], sources: [], suggestions: [] };
    }
  }
  return scriptedRead(body);
}

// ---------- steps ----------

function result(e: Errand, id: string): StepResult {
  return e.steps.find((s) => s.stepId === id)!;
}

async function runPhase(e: Errand) {
  const plan = e.plan!;
  const notifySteps: PlanStep[] = [];

  for (const step of plan.steps) {
    checkCancelled(e);
    const r = result(e, step.id);
    if (step.type === "email.send") {
      notifySteps.push(step);
      continue;
    }

    if (step.condition) {
      const facts = allFacts(e);
      const reply = servConfigured() ? (await serv.condition({ task: e.task, condition: step.condition, facts })).reply : scriptedCondition(facts);
      event(e, "step", `Condition "${step.condition}": ${reply.decision}. ${reply.reason}`, { stepId: step.id });
      if (reply.decision === "skip") {
        r.status = "skipped";
        r.note = reply.reason;
        await save(e);
        continue;
      }
      if (reply.decision === "ask") {
        const a = await ask(e, reply.question || `${reply.reason} Go ahead with "${step.purpose}"?`, ["Go ahead", "Skip it"], step.condition);
        if (!/^(go|yes|y|ok)/i.test(a.trim())) {
          r.status = "skipped";
          r.note = "You chose to skip this step.";
          await save(e);
          continue;
        }
      }
    }

    r.status = "running";
    event(e, "step", `Started: ${step.purpose}`, { stepId: step.id });
    await save(e);
    try {
      if (step.type.startsWith("buy.")) await runBuy(e, step, r);
      else if (step.type === "phone.call") await runCall(e, step, r);
      else if (step.type === "reppo.opinion") await runOpinion(e, step, r);
      else await runResearch(e, step, r);
      r.status = "done";
    } catch (err) {
      if (err instanceof Cancelled) throw err;
      r.status = err instanceof Blocked ? "blocked" : "failed";
      r.note = err instanceof Error ? err.message : String(err);
      event(e, "step", `${r.status === "blocked" ? "Blocked" : "Failed"}: ${step.purpose}. ${r.note}`, { stepId: step.id });
    }
    await save(e);
  }

  // Final answer
  const purchases = e.steps.flatMap((s) => (s.output?.purchase ? [String(s.output.purchase)] : []));
  const blocked = e.decisions.filter((d) => d.decision === "block").map((d) => d.reason);
  const stepsForSummary = plan.steps.map((s) => {
    const r = result(e, s.id);
    if (s.type === "email.send") {
      return { id: s.id, purpose: s.purpose, status: "sends_with_this_answer", note: `This answer is emailed to ${stepInput(s, "to") ?? "the recipient"} right after you write it.`, facts: [], sources: [] };
    }
    return { id: s.id, purpose: s.purpose, status: r.status, note: r.note, facts: r.facts, sources: r.sources };
  });
  const summary = servConfigured()
    ? (await serv.summarize({ task: e.task, steps: stepsForSummary, purchases, blocked })).reply
    : scriptedSummary({ steps: stepsForSummary, purchases, blocked });
  e.answer = { text: summary.text, citations: summary.citations };
  for (const p of e.payments) {
    const step = plan.steps.find((s) => s.id === p.stepId);
    p.used = step?.type.startsWith("buy.") || step?.type === "phone.call" ? true : summary.usedStepIds.includes(p.stepId ?? "");
  }
  event(e, "answer", "Answer ready.");
  await save(e);

  // Emails go last so they can carry the answer.
  for (const step of notifySteps) {
    const r = result(e, step.id);
    r.status = "running";
    await save(e);
    try {
      const to = stepInput(step, "to")!;
      const subject = stepInput(step, "subject") ?? "Your errand is done";
      const receipt = `${env.webOrigin.split(",")[0]}/r/${e.id}`;
      const written = await dolphin.writeEmail({ task: e.task, answer: summary.text, receiptUrl: receipt });
      if (written) event(e, "log", `Email wording written by Dolphin (${written.model}, open-source). No decision was made by it.`);
      await pay(e, sellers.emailRequest(to, subject, written?.text ?? emailBody(summary.text, receipt)), { step, recipient: to });
      r.status = "done";
      r.note = `Emailed ${to}.`;
      r.facts.push(`Emailed the result to ${to}.`);
    } catch (err) {
      r.status = err instanceof Blocked ? "blocked" : "failed";
      r.note = err instanceof Error ? err.message : String(err);
    }
    await save(e);
  }

  e.status = "done";
  e.evaluation = !reppoConfigured() ? null : { evalId: "", status: "QUEUED", submittedAt: null, minSettleAt: null, settledAt: null, score: null, decision: null, confidence: null, verdicts: [], assessments: [], sandbox: env.reppo.sandbox };
  event(e, "status", `Done. Spent ${formatUsd(spentUsd(e.payments))} of ${formatUsd(e.budgetUsd)}.`);
  await save(e);
}

async function runResearch(e: Errand, step: PlanStep, r: StepResult) {
  const req = sellers.researchRequest(step, (ref) => {
    const out = e.steps.find((s) => s.stepId === ref)?.output;
    return typeof out?.placeId === "string" ? out.placeId : undefined;
  });
  const body = await pay(e, req, { step });
  if (step.type === "maps.search") r.output = { ...(r.output ?? {}), placeId: sellers.firstPlaceId(body) };
  const read = await readPaid(e, step, req.endpointId, body);
  r.facts.push(...read.facts);
  r.sources.push(...read.sources);
  r.suggestions.push(...read.suggestions);
  r.note = `${read.facts.length} facts, ${read.sources.length} sources.`;
  await save(e);
  if (read.suggestions.length) await screenSuggestions(e, step, read.suggestions);
}

async function runCall(e: Errand, step: PlanStep, r: StepResult) {
  const phone = normalizePhone(stepInput(step, "phone") ?? "", "US");
  if (!phone || !isNorthAmerican(phone)) throw new Blocked("StablePhone can only call +1 numbers.");
  if (stepInput(step, "secondOpinion") === "yes") {
    await secondOpinion(e, step, r, `Is this call the right next step for the errand? Call task: ${stepInput(step, "task") ?? ""}`, { phone: maskPhone(phone) });
  }
  const body = (await pay(e, sellers.phoneRequest(phone, stepInput(step, "task") ?? ""), { step })) as { call_id?: string } | null;
  r.output = { callId: body?.call_id ?? null, purchase: `AI phone call to ${maskPhone(phone)}` };
  r.facts.push(`Placed an AI phone call to ${maskPhone(phone)}${body?.call_id ? ` (call ${body.call_id})` : ""}.`);
}

async function runBuy(e: Errand, step: PlanStep, r: StepResult) {
  const kind = sellers.buyKind(step);
  const query = stepInput(step, "query") ?? "";
  const country = stepInput(step, "country");
  const amountUsd = Number(stepInput(step, "amountUsd"));
  let packageValue = stepInput(step, "packageValue");
  const recipientRaw = stepInput(step, "recipient");
  const recipient = recipientRaw ? (normalizePhone(recipientRaw, country ?? env.defaultCountry) ?? undefined) : undefined;
  if (kind === "topup" && !recipient) throw new Blocked("No valid phone number to top up.");

  // 1. Search
  const found = await pay(e, sellers.bitrefillSearch(kind, query, country), { step });
  const product = sellers.pickProduct(found, query, country);
  if (!product) throw new Error(`Bitrefill has no in-stock ${kind} matching "${query}"${country ? ` in ${country}` : ""}.`);
  r.facts.push(`Bitrefill product: ${product.name} (${product.slug}).`);

  // 2. Packages
  const detail = sellers.readDetail(await pay(e, sellers.bitrefillDetail(product.slug), { step }));
  let pkg = sellers.pickPackage(detail, { packageValue, amountUsd });
  if (!pkg) {
    const options = detail.packages.slice(0, 8).map((p) => `${p.package_value} ${p.package_currency ?? ""}`.trim());
    if (!options.length) throw new Error(`${product.name} has no packages for sale right now.`);
    const a = await ask(e, `Which ${product.name} package should I buy? Your limit for it is ${formatUsd(amountUsd)}.`, options, step.purpose);
    packageValue = a.split(" ")[0];
    pkg = sellers.pickPackage(detail, { packageValue, amountUsd });
    if (!pkg) throw new Blocked("No package was chosen.");
  }

  // 3. Price-locked invoice
  const needsRecipient = detail.recipientRequired || detail.recipientType !== "none";
  const invoice = sellers.readInvoice(
    await pay(
      e,
      sellers.bitrefillCreateInvoice({ productId: detail.id || product.slug, packageValue: pkg.package_value, refillInput: needsRecipient ? recipient : undefined }),
      { step },
    ),
  );
  if (!invoice) throw new Error("Bitrefill did not return an invoice with a price.");
  r.facts.push(`Invoice ${invoice.invoiceId}: ${formatUsd(invoice.priceUsd)} for ${pkg.package_value} ${pkg.package_currency ?? ""}.`.replace(" .", "."));

  // 3b. Subjective choice? Ask Reppo's independent evaluators before paying.
  if (stepInput(step, "secondOpinion") === "yes") {
    const what = `${product.name} ${pkg.package_value} ${pkg.package_currency ?? ""}`.trim();
    await secondOpinion(e, step, r, `Is buying ${what} for ${formatUsd(invoice.priceUsd)} the right choice for this errand?`, {
      product: what,
      priceUsd: invoice.priceUsd,
    });
  }

  // 4. Pay the invoice: the payment the guard cares most about.
  await pay(e, sellers.bitrefillPay(invoice.invoiceId), {
    step,
    priceUsd: invoice.priceUsd,
    plannedProductUsd: amountUsd,
    recipient: needsRecipient ? recipient : undefined,
    note: `${product.name} ${pkg.package_value} ${pkg.package_currency ?? ""}${recipient ? ` for ${maskPhone(recipient)}` : ""}`.trim(),
  });

  // 5. Delivery
  let delivery = sellers.readDelivery(await pay(e, sellers.bitrefillStatus(invoice.invoiceId), { step }));
  if (!/deliver|complete/i.test(`${delivery.status} ${delivery.delivery}`)) {
    await new Promise((res) => setTimeout(res, env.mode === "demo" ? 500 : 15_000));
    delivery = sellers.readDelivery(await pay(e, sellers.bitrefillStatus(invoice.invoiceId), { step }));
  }
  const what = `${product.name} ${pkg.package_value} ${pkg.package_currency ?? ""}`.trim();
  r.output = { invoiceId: invoice.invoiceId, priceUsd: invoice.priceUsd, product: product.slug, delivery, purchase: `${what} for ${formatUsd(invoice.priceUsd)}${recipient ? ` to ${maskPhone(recipient)}` : ""}` };
  r.facts.push(`Delivery: ${delivery.status} / ${delivery.delivery}.`);
  if (kind !== "topup") r.facts.push("Bitrefill ties the code to the paying wallet; it can be retrieved with that wallet.");
}

// ---------- Reppo: independent opinions on subjective calls ----------
// Jev (inside the SERV guard graph) handles the predictable checks; Reppo's
// evaluators judge the subjective ones: "is this the right eSIM, gift, restaurant?"

const OPINION_CONTEXT =
  "Errand is an AI agent running an errand for a user who set a budget and constraints. It asks independent evaluators for a second opinion on a subjective choice before acting. Judge the proposal against the user's task, constraints and the facts gathered. accept = good choice, revise = acceptable but a better option likely exists, reject = wrong choice.";

async function askReppo(e: Errand, step: PlanStep, question: string, proposal: Record<string, unknown>) {
  const payload = JSON.stringify({
    question,
    proposal,
    task: redact(e.task),
    constraints: (e.plan?.constraints ?? []).map(redact),
    facts: allFacts(e).slice(-15).map(redact),
  });
  const body = await pay(
    e,
    sellers.reppoLiteRequest({
      payload,
      context: OPINION_CONTEXT,
      criteria: [
        "Does the proposal fit the user's task and constraints?",
        "Is the price reasonable for what it is?",
        "Is there a clearly better option the agent should choose instead?",
      ],
    }),
    { step, note: "Independent second opinion from Reppo's evaluators" },
  );
  return sellers.readLiteVerdict(body);
}

function verdictLine(v: sellers.LiteVerdict): string {
  const score = v.score !== null ? `, score ${v.score}` : "";
  const who = v.evaluators ? ` from ${v.evaluators} independent evaluators` : "";
  return `Reppo second opinion${who}: ${v.decision ?? "no clear verdict"}${score}.`;
}

async function secondOpinion(e: Errand, step: PlanStep, r: StepResult, question: string, proposal: Record<string, unknown>) {
  const v = await askReppo(e, step, question, proposal);
  r.facts.push(verdictLine(v), ...v.critiques.slice(0, 2).map((c) => `Evaluator note: ${c}`));
  r.output = { ...(r.output ?? {}), reppo: v };
  event(e, "step", verdictLine(v), { stepId: step.id });
  await save(e);
  if (v.decision === "accept") return;
  const why = v.critiques[0] ? ` "${v.critiques[0]}"` : "";
  const a = await ask(e, `${verdictLine(v)}${why} Go ahead anyway?`, ["Go ahead", "Stop here"], step.purpose);
  if (!/^(go|yes|y|ok|buy)/i.test(a.trim())) throw new Blocked("You stopped after Reppo's second opinion.");
}

async function runOpinion(e: Errand, step: PlanStep, r: StepResult) {
  const question = stepInput(step, "question") ?? step.purpose;
  const v = await askReppo(e, step, question, { proposedAnswer: allFacts(e).slice(-8).join(" ") || "(no research yet)" });
  r.facts.push(verdictLine(v), ...v.critiques.map((c) => `Evaluator note: ${c}`));
  r.output = { ...(r.output ?? {}), reppo: v };
  r.note = verdictLine(v);
}
