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
  SHOP_CHECKOUT_URL,
  SHOP_FEE_USD,
  checkPlan,
  checkRules,
  combine,
  endpointForUrl,
  expectedChargeUsd,
  guardConstraints,
  servReviews,
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
  type Funding,
  type GuardDecision,
  type PaymentCandidate,
  type Plan,
  type PlanStep,
  type Question,
  type StepResult,
} from "@errand/core";
import { publish } from "./bus";
import * as dolphin from "./dolphin";
import { evaluateAction, redact } from "./reppo";
import { demoExecute, demoShipping, demoShopSearch, scriptedCondition, scriptedGuard, scriptedPlan, scriptedRead, scriptedSummary } from "./demo";
import { budgetCap, env, reppoConfigured, servConfigured } from "./env";
import * as kite from "./kite";
import { explorerUrl, reconcileAmountUsd } from "./kite-parse";
import { log } from "./log";
import { allowanceFor, passportHome } from "./passports";
import { emailBody } from "./prompts";
import * as sellers from "./sellers";
import * as serv from "./serv";
import { store } from "./store";

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${randomBytes(6).toString("base64url")}`;

class Blocked extends Error {}
class Cancelled extends Error {}

/** Standing errands listen here (standing.ts), so this file doesn't import it. */
export const runnerHooks: {
  onPlanApproved?: (e: Errand) => Promise<void>;
  onFinished?: (e: Errand) => Promise<void>;
} = {};

/** The kpass folder for this errand: the person's own Passport, or null for the operator's. */
function homeOf(e: Errand): string | null {
  return e.passportId ? passportHome(e.passportId) : null;
}

export interface CreateOptions {
  passportId?: string | null;
  funding?: Funding;
  standingId?: string | null;
  /** A plan the person already approved (later runs of a standing errand). */
  presetPlan?: Plan | null;
}

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

/** In-app approval: demo errands, and allowance-funded errands (the allowance itself was approved with a passkey on Kite). */
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

// kpass keeps "the current session" per login folder, so errands on the same folder take turns.
const kiteChains = new Map<string, Promise<unknown>>();
function withKiteLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = kiteChains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  kiteChains.set(key, next.catch(() => undefined));
  return next;
}

// ---------- create ----------

export async function createErrand(input: CreateErrandInput, opts: CreateOptions = {}): Promise<Errand> {
  const cap = budgetCap({ ownPassport: Boolean(opts.passportId), test: input.network === "test" });
  const t = now();
  const task = input.email && !input.task.includes(input.email) ? `${input.task}\n\nMy email: ${input.email}` : input.task;
  const e: Errand = {
    id: newId("e"),
    createdAt: t,
    updatedAt: t,
    mode: input.network === "test" ? "demo" : env.mode,
    task,
    budgetUsd: Math.min(input.budgetUsd, cap),
    maxPerPaymentUsd: Math.min(input.maxPerPaymentUsd, input.budgetUsd, cap),
    validFor: input.validFor ?? "1h",
    askAboveUsd: input.askAboveUsd ?? null,
    funding: opts.funding ?? "session",
    passportId: input.network === "test" ? null : (opts.passportId ?? null),
    // Every errand goes to Reppo (phone numbers and emails are hidden first). "private" remains only on old records.
    privacy: "public",
    country: input.country ?? env.defaultCountry,
    standingId: opts.standingId ?? null,
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
  event(e, "status", e.mode === "demo" ? "Test errand: payments and seller replies are simulated, and nothing is charged." : "Errand created.");
  if (e.passportId) event(e, "log", "Paid from your own Kite Passport.");
  if (e.privacy === "private") event(e, "log", "Private errand: nothing about it is sent to Reppo's public network.");
  await save(e);
  void lifecycle(e, opts.presetPlan ?? null)
    .catch(async (err) => {
      const fresh = (await store.get(e.id)) ?? e;
      if (err instanceof Cancelled) return;
      fresh.status = "failed";
      fresh.error = err instanceof Error ? err.message : String(err);
      event(fresh, "error", fresh.error);
      log.error("errand.failed", { id: e.id, error: fresh.error });
      await save(fresh);
    })
    .finally(async () => {
      const last = await store.get(e.id);
      if (last && runnerHooks.onFinished) await runnerHooks.onFinished(last).catch((err) => log.error("standing.hook_failed", { error: String(err) }));
    });
  return e;
}

function planCheck(e: Errand) {
  return checkPlan(e.plan!, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: e.country, funding: e.funding });
}

// ---------- lifecycle ----------

async function lifecycle(e: Errand, preset: Plan | null) {
  if (preset) {
    const check = checkPlan(preset, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: e.country, funding: e.funding });
    if (!check.ok) throw new Error(`The approved plan no longer fits its limits: ${check.issues.join(" ")}`);
    e.plan = preset;
    e.steps = preset.steps.map((s) => ({ stepId: s.id, status: "pending", note: "", facts: [], sources: [], suggestions: [] }));
    event(e, "plan_ready", preset.summary, { totalMaxUsd: check.totalMaxUsd, repeat: true });
    await save(e);
  } else {
    await planPhase(e);
  }
  if (e.funding === "allowance") await allowancePhase(e, preset !== null);
  else await approvalPhase(e);
  await withKiteLock(homeOf(e) ?? "operator", async () => {
    if (e.mode === "live" && e.funding === "session" && e.kite.sessionId) await kite.useSession(e.kite.sessionId, homeOf(e));
    await runPhase(e);
  });
}

/**
 * Standing errands pay from the person's Kite allowance: approved once, on Kite, with
 * their passkey. The first run's plan still needs their yes in Errand; later runs repeat
 * that exact plan. Kite's allowance never pays shopping checkouts (checked in checkPlan).
 */
async function allowancePhase(e: Errand, alreadyApproved: boolean) {
  const total = planCheck(e).totalMaxUsd;
  const allowance = await allowanceFor(e.passportId);
  if (allowance.state !== "active") {
    throw new Error(allowance.userMessage ?? `Your Kite allowance is ${allowance.state.replace("_", " ")}. Set one up at agentpassport.ai/overview.`);
  }
  if (allowance.left !== null && allowance.left + 0.000001 < total) {
    throw new Error(allowance.userMessage ?? `Your Kite allowance has $${allowance.left} left; this run may need $${total}.`);
  }
  if (!alreadyApproved) {
    e.status = "awaiting_approval";
    event(e, "awaiting_approval", `Approve this plan to repeat it on its schedule, paid from your Kite allowance (up to ${formatUsd(total)} a run). No passkey needed: you approved the allowance on Kite.`, { allowance: true });
    await save(e);
    await waitFor(`${e.id}:approve`);
    checkCancelled(e);
  }
  e.kite.approvedAt = now();
  e.status = "running";
  event(e, "status", `${e.mode === "demo" ? "Simulated: " : ""}paying from your Kite allowance${allowance.left !== null ? ` ($${allowance.left} left this ${allowance.period ?? "period"})` : ""}.`);
  await save(e);
  if (!alreadyApproved && runnerHooks.onPlanApproved) await runnerHooks.onPlanApproved(e);
}

async function planPhase(e: Errand) {
  const useServ = servConfigured();
  if (!useServ && e.mode === "live") throw new Error("Live mode needs SERV_API_KEY.");
  const answers: { q: string; a: string }[] = [];

  for (let round = 0; round < 2; round++) {
    let feedback: string[] | undefined;
    let accepted = false;
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      checkCancelled(e);
      const plan = useServ
        ? (await serv.plan({ task: e.task, budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, country: e.country, feedback, answers })).plan
        : scriptedPlan(e.task, e.budgetUsd);
      if (plan.steps.length === 0) {
        // SERV planned nothing. If it has questions, ask them and plan again; otherwise send it back once.
        if (plan.questions.length && round === 0) {
          for (const q of plan.questions) answers.push({ q, a: await ask(e, q, [], "The planner needs this before it can plan the errand.") });
          e.status = "planning";
          await save(e);
          attempt = -1; // start the attempts again with the answers
          continue;
        }
        feedback = [
          `Your plan had no steps. The budget is ${formatUsd(e.budgetUsd)} with at most ${formatUsd(e.maxPerPaymentUsd)} per payment, which is enough for this errand. Return the steps needed to do it, using only the step types listed.`,
        ];
        event(e, "log", "SERV returned an empty plan; asking it to plan again.");
        await save(e);
        if (attempt === 1) {
          throw new Error(
            e.budgetUsd < 0.05 || e.maxPerPaymentUsd < 0.01
              ? "SERV could not fit any paid step inside your limits. Raise the budget or the per-payment limit (research calls cost $0.01–$0.04) and try again."
              : "SERV couldn't turn this errand into a plan. Try rewording it: say what to buy or find, for whom, and how much.",
          );
        }
        continue;
      }
      const sourceText = [e.task, ...answers.map((x) => x.a)].join("\n");
      const check = checkPlan(plan, { budgetUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, defaultCountry: e.country, funding: e.funding, sourceText });
      if (check.ok) {
        e.plan = plan;
        accepted = true;
      } else {
        feedback = check.issues;
        event(e, "log", `Plan sent back to SERV: ${check.issues.join(" ")}`);
        await save(e);
        if (attempt === 1) {
          const buys = plan.steps.some((x) => x.type.startsWith("buy.") || x.type === "phone.call");
          const hint = buys && e.maxPerPaymentUsd < 1 ? ` A purchase is paid in one payment, so "Most per payment" must cover the whole price (top-ups and eSIMs usually cost $0.30 or more).` : "";
          throw new Error(`SERV could not make a plan inside your limits (budget ${formatUsd(e.budgetUsd)}, at most ${formatUsd(e.maxPerPaymentUsd)} per payment).${hint} Details: ${check.issues.join(" ")}`);
        }
      }
    }
    const plan = e.plan!;
    e.steps = plan.steps.map((s) => ({ stepId: s.id, status: "pending", note: "", facts: [], sources: [], suggestions: [] }));
    event(e, "plan_ready", plan.summary, { totalMaxUsd: planCheck(e).totalMaxUsd });
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
  const total = planCheck(e).totalMaxUsd;
  const maxTotal = Math.min(e.budgetUsd, Math.max(total, 0.01));
  e.status = "awaiting_approval";

  if (e.mode === "demo") {
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

  const req = await kite.createSession({ taskSummary: `Errand: ${e.task}`, maxPerTxUsd: e.maxPerPaymentUsd, maxTotalUsd: maxTotal, ttl: e.validFor, home: homeOf(e) });
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
    const st = await kite.sessionStatus(req.requestId, homeOf(e));
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
  const check = planCheck(e);
  return {
    plan: e.plan!,
    payments: e.payments,
    limits: { ...DEFAULT_LIMITS, totalMaxUsd: e.budgetUsd, maxPerPaymentUsd: e.maxPerPaymentUsd, askAboveUsd: e.askAboveUsd },
    approvedRecipients: check.approvedRecipients,
    defaultCountry: e.country,
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

  if (rules.outcome !== "block" && servReviews(c)) {
    try {
      if (servConfigured()) {
        const { reply, meta } = await serv.guard({
          task: e.task,
          step,
          payment: { url: c.url, method: c.method, body: c.body, priceUsd: c.priceUsd, recipient: c.recipient, plannedProductUsd: expectedChargeUsd(c), note: c.note },
          rules,
          spentUsd: spentUsd(e.payments),
          budgetUsd: e.budgetUsd,
          earlierFacts: allFacts(e).slice(-20),
          earlierDecisions: e.decisions.slice(-10).map((d) => ({ decision: d.decision, reason: d.reason, url: d.candidate.url })),
          constraints: guardConstraints(e.plan?.constraints ?? [], step?.type),
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
  if (ep) return SELLERS[ep.seller].name;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function liveExecute(e: Errand, req: sellers.SellerRequest, key: string): Promise<kite.ExecuteResult> {
  if (req.endpointId === "kite.shop.checkout") {
    const cap = Number((req.body as { maxTotalUsd?: number }).maxTotalUsd);
    const order = await kite.shopCheckout(cap, homeOf(e));
    return { body: order.raw, txHash: order.txHash, chain: order.chain, amountUsd: order.chargedUsd, explorerUrl: explorerUrl(order.chain, order.txHash), raw: order.raw };
  }
  return kite.execute({ url: req.url, method: req.method, body: req.body, idempotencyKey: key, useAllowance: e.funding === "allowance", home: homeOf(e) });
}

async function pay(
  e: Errand,
  req: sellers.SellerRequest,
  opts: { step: PlanStep; recipient?: string; plannedProductUsd?: number; priceUsd?: number; note?: string; confirmedByUser?: boolean },
): Promise<unknown> {
  checkCancelled(e);
  const catalogPrice = ENDPOINT_BY_ID[req.endpointId]?.priceUsd ?? null;
  let price = opts.priceUsd ?? catalogPrice ?? 0;
  let note = opts.note;
  if (e.mode === "live" && catalogPrice !== null && opts.priceUsd === undefined) {
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
  // You already said yes to this step's purchase: SERV's judgement-call "ask" isn't repeated.
  // Fixed-rule asks (R11 price above plan, R12 your own threshold) always ask again.
  const alreadyConfirmed = opts.confirmedByUser === true || e.decisions.some((x) => x.rule === "user.answer" && x.decision === "approve" && x.candidate.stepId === opts.step.id);
  if (d.decision === "ask" && d.source === "serv" && alreadyConfirmed) {
    const follow: GuardDecision = { ...d, id: newId("d"), at: now(), decision: "approve", rule: "user.earlier", reason: "You already confirmed this purchase earlier in this step." };
    e.decisions.push(follow);
    event(e, "decision", `Approved: ${formatUsd(price)} to ${sellerName(req.url)}. You already confirmed this purchase.`, { decisionId: follow.id });
    await save(e);
    d = follow;
  }
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

  const result = e.mode === "demo" ? demoExecute(req) : await liveExecute(e, req, `${e.id}-${d.id}`);

  e.payments.push({
    id: newId("p"),
    at: now(),
    decisionId: d.id,
    stepId: opts.step.id,
    endpointId: req.endpointId,
    url: req.url,
    method: req.method,
    amountUsd: reconcileAmountUsd(result.amountUsd, price),
    requestHash: requestHash(req.method, req.url, req.body),
    txHash: result.txHash,
    explorerUrl: result.explorerUrl,
    chain: result.chain,
    simulated: e.mode === "demo",
    used: null,
    raw: e.mode === "live" ? result.raw : undefined,
  });
  event(e, "payment", `${e.mode === "demo" ? "Simulated payment" : "Paid"} ${formatUsd(reconcileAmountUsd(result.amountUsd, price))} to ${sellerName(req.url)}${e.funding === "allowance" ? " from your Kite allowance" : ""}.`, {
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
      if (step.type === "buy.amazon") await runAmazon(e, step, r);
      else if (step.type.startsWith("buy.")) await runBuy(e, step, r);
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
    p.used = step?.type.startsWith("buy.") || step?.type === "phone.call" || step?.type === "reppo.opinion" ? true : summary.usedStepIds.includes(p.stepId ?? "");
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
  if (e.privacy === "private") event(e, "log", "Private errand: the run was not sent to Reppo's public evaluation network.");
  e.evaluation = !reppoConfigured() || e.privacy === "private" || (e.mode === "demo" && env.mode === "live") ? null : { evalId: "", status: "QUEUED", submittedAt: null, minSettleAt: null, settledAt: null, score: null, decision: null, confidence: null, verdicts: [], assessments: [], sandbox: false };
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
  const recipient = recipientRaw ? (normalizePhone(recipientRaw, country ?? e.country) ?? undefined) : undefined;
  if (kind === "topup" && !recipient) throw new Blocked("No valid phone number to top up.");

  // 1. Search
  const found = await pay(e, sellers.bitrefillSearch(kind, query, country), { step });
  let product = sellers.pickProduct(found, query, country);
  if (!product && country) {
    // Nothing for that country, but the same product exists elsewhere: ask instead of failing or guessing.
    const elsewhere = sellers.pickProduct(found, query);
    if (elsewhere) {
      const where = elsewhere.country ? elsewhere.country.toUpperCase() : "another country";
      const a = await ask(e, `Bitrefill has no ${query} for ${country}, but it has ${elsewhere.name} for ${where}. Buy that one?`, [`Buy the ${where} one`, "Don't buy"], step.purpose);
      if (/^buy/i.test(a.trim())) product = elsewhere;
      else throw new Blocked("You chose not to buy a product from another country.");
    }
  }
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

  // 5. Delivery. The purchase is already paid: a failed or blocked check must not turn it into "not bought".
  let delivery: { status: string; delivery: string } = { status: "paid", delivery: "not confirmed yet" };
  try {
    delivery = sellers.readDelivery(await pay(e, sellers.bitrefillStatus(invoice.invoiceId), { step }));
    if (!/deliver|complete/i.test(`${delivery.status} ${delivery.delivery}`)) {
      await new Promise((res) => setTimeout(res, e.mode === "demo" ? 500 : 15_000));
      delivery = sellers.readDelivery(await pay(e, sellers.bitrefillStatus(invoice.invoiceId), { step }));
    }
  } catch (err) {
    if (err instanceof Cancelled) throw err;
    event(e, "log", `Paid, but the delivery check didn't run: ${err instanceof Error ? err.message : String(err)}`);
  }
  const what = `${product.name} ${pkg.package_value} ${pkg.package_currency ?? ""}`.trim();
  r.output = { invoiceId: invoice.invoiceId, priceUsd: invoice.priceUsd, product: product.slug, delivery, purchase: `${what} for ${formatUsd(invoice.priceUsd)}${recipient ? ` to ${maskPhone(recipient)}` : ""}` };
  r.facts.push(`Delivery: ${delivery.status} / ${delivery.delivery}.`);
  if (kind !== "topup") r.facts.push("Bitrefill ties the code to the paying wallet; it can be retrieved with that wallet.");
}

// ---------- Amazon through Kite Passport's shopping checkout ----------
// Follows Kite's shopping skill: search (free) -> cart -> shipping -> an order summary the
// person must confirm -> `shop:checkout --confirmed`. Kite charges the price cap + $1 up front
// and the provider refunds the unused part of the cap to the wallet.

function pickShopItem(items: kite.ShopItem[], capUsd: number): kite.ShopItem | null {
  const fits = items.filter((i) => i.priceUsd !== null && i.priceUsd <= capUsd);
  const score = (i: kite.ShopItem) => (i.rating ?? 0) * Math.log10((i.reviews ?? 0) + 10);
  fits.sort((a, b) => score(b) - score(a) || (a.priceUsd ?? 0) - (b.priceUsd ?? 0));
  return fits[0] ?? null;
}

async function runAmazon(e: Errand, step: PlanStep, r: StepResult) {
  const home = homeOf(e);
  const query = stepInput(step, "query") ?? "";
  const cap = Number(stepInput(step, "maxTotalUsd"));
  if (e.funding === "allowance") throw new Blocked("Kite's allowance never pays shopping checkouts.");

  // 1. Search (free, no session needed)
  const items = e.mode === "demo" ? demoShopSearch(query) : await kite.shopSearch(query, home);
  event(e, "step", `Searched Amazon through Kite for "${query}" (free): ${items.length} results.`, { stepId: step.id });
  r.facts.push(...items.slice(0, 3).map((i) => `Amazon: ${i.title.slice(0, 90)}, ${i.priceUsd !== null ? formatUsd(i.priceUsd) : "no price"}${i.rating ? `, ${i.rating} stars (${i.reviews ?? 0} reviews)` : ""}.`));
  const pick = pickShopItem(items, cap);
  if (!pick) throw new Blocked(`No Amazon result for "${query}" fits your ${formatUsd(cap)} limit.`);
  r.facts.push(`Chosen: ${pick.title.slice(0, 120)} at ${formatUsd(pick.priceUsd ?? 0)} (best rated within your limit).`);
  await save(e);

  // 2. Judgement call? Reppo's evaluators look at the choice first.
  if (stepInput(step, "secondOpinion") === "yes") {
    await secondOpinion(e, step, r, `Is this the right product for the errand? ${pick.title.slice(0, 160)} at ${formatUsd(pick.priceUsd ?? 0)}.`, {
      product: pick.title.slice(0, 200),
      priceUsd: pick.priceUsd,
      rating: pick.rating,
      reviews: pick.reviews,
    });
  }

  // 3. Cart (free)
  let subtotal = pick.priceUsd;
  let payWith = "USDC";
  if (e.mode === "live") {
    await kite.shopCartClear(home);
    await kite.shopCartAdd(pick, home);
    const cart = await kite.shopCartView(home);
    subtotal = cart.subtotalUsd;
    payWith = `${cart.currency ?? "USDC"}${cart.chain ? ` on ${cart.chain}` : ""}`;
    if (cart.items.length !== 1 || cart.items[0]?.externalId !== pick.externalId) throw new Error("The Kite cart does not hold exactly the chosen item.");
  }
  if (subtotal === null || subtotal > cap) throw new Blocked(`The cart subtotal ${subtotal === null ? "is unknown" : formatUsd(subtotal)}, above your ${formatUsd(cap)} limit.`);

  // 4. Shipping lives in the person's Kite profile. Errand never stores it.
  let ship = e.mode === "demo" ? demoShipping() : await kite.shopShippingView(home);
  if (!ship.complete) {
    const a = await ask(e, `Your Kite shipping profile is missing: ${ship.missing.join(", ")}. Add it on the Connect page (it goes straight to Kite), then choose "Done".`, ["Done", "Cancel the order"], step.purpose);
    if (!/^done/i.test(a.trim())) throw new Blocked("You cancelled the order.");
    ship = await kite.shopShippingView(home);
    if (!ship.complete) throw new Blocked(`The shipping profile is still missing: ${ship.missing.join(", ")}.`);
  }

  // 5. Kite's rule: never check out without an explicit yes to the order summary.
  const charge = Math.round((cap + SHOP_FEE_USD) * 100) / 100;
  const shipTo = [ship.name, ship.city, ship.state, ship.country].filter(Boolean).join(", ");
  const a = await ask(
    e,
    `Order summary: ${pick.title.slice(0, 120)}, ${formatUsd(subtotal)}. Ship to ${shipTo || "your Kite address"}. Kite charges ${formatUsd(charge)} up front (your ${formatUsd(cap)} limit including tax and shipping, plus Kite's $${SHOP_FEE_USD} fee) in ${payWith}; the unused part is refunded to your wallet. Place this order?`,
    ["Place order", "Don't buy"],
    step.purpose,
  );
  if (!/^(place|yes|y|confirm|buy)/i.test(a.trim())) throw new Blocked("You chose not to place the order.");

  // 6. The guarded payment (R13 checks the charge is exactly the cap + Kite's fee).
  const order = (await pay(
    e,
    { endpointId: "kite.shop.checkout", url: SHOP_CHECKOUT_URL, method: "POST", body: { maxTotalUsd: cap, item: `${pick.provider}:${pick.externalId}` } },
    { step, priceUsd: charge, plannedProductUsd: cap, confirmedByUser: true, note: `Amazon: ${pick.title.slice(0, 100)}, subtotal ${formatUsd(subtotal)}. Kite's shopping checkout charges the order cap (${formatUsd(cap)}, the user's limit including tax and shipping) plus Kite's fixed $${SHOP_FEE_USD} provider fee up front, ${formatUsd(charge)} in total, and refunds whatever the order doesn't use. The user confirmed this order summary.` },
  )) as Record<string, unknown> | null;
  const o = kite.readOrder(order);
  r.output = { ...(r.output ?? {}), orderId: o.orderId, orderStatus: o.orderStatus, purchase: `${pick.title.slice(0, 80)} from Amazon${o.orderId ? ` (order ${o.orderId})` : ""}` };
  r.facts.push(`Order ${o.orderId ?? "(no id)"}: ${o.orderStatus ?? "pending"}. Kite's provider refunds whatever the order costs below ${formatUsd(cap)} to the wallet.`);
}

// ---------- Reppo: independent opinions on subjective calls ----------
// Jev (inside the SERV guard graph) handles the predictable checks; Reppo's
// evaluator panel judges the subjective ones: "is this the right eSIM, gift, restaurant?"
// Errand pays Reppo from its own credits, so a second opinion costs the user nothing.

interface Opinion {
  ok: boolean;
  route: "ship" | "review" | "block" | null;
  score: number | null;
  confidence: "low" | "medium" | "high" | null;
  reason: string | null;
  evaluators: number;
  evalId: string | null;
  error?: string;
}

function opinionInput(e: Errand, question: string, proposal: Record<string, unknown>): string {
  // Private errands share only the choice itself, never the task, constraints or research.
  if (e.privacy === "private") {
    return `An AI agent is about to take this action for a user: ${redact(question)}\nProposal: ${redact(JSON.stringify(proposal))}\n\nShould the agent go ahead? Judge whether the choice is sensible, whether the price is reasonable, and whether a clearly better option exists.`;
  }
  return [
    `What the user asked the agent: "${redact(e.task)}"`,
    (e.plan?.constraints ?? []).length ? `The user's constraints: ${(e.plan?.constraints ?? []).map(redact).join("; ")}` : "",
    `What the agent found so far: ${allFacts(e).slice(-15).map(redact).join(" ") || "(no research yet)"}`,
    `The action the agent is about to take: ${redact(question)}\nProposal: ${redact(JSON.stringify(proposal))}`,
    "Should the agent go ahead? Judge: does it fit the user's task and constraints, is the price reasonable for what it is, and is there a clearly better option the agent should choose instead?",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function askReppo(e: Errand, step: PlanStep, question: string, proposal: Record<string, unknown>): Promise<Opinion> {
  event(e, "step", "Asking Reppo's independent evaluators for a second opinion (usually under 2 minutes).", { stepId: step.id });
  await save(e);
  if (e.mode === "demo") {
    await new Promise((r) => setTimeout(r, 1_500));
    return { ok: true, route: "ship", score: 81, confidence: "high", reason: "Simulated: fits the task and the limits the user set; the price is in the normal range.", evaluators: 3, evalId: null };
  }
  const res = await evaluateAction(opinionInput(e, question, proposal));
  if (!res.ok) return { ok: false, route: null, score: null, confidence: null, reason: null, evaluators: 0, evalId: null, error: res.reason };
  const r = res.result;
  return { ok: true, route: r.route, score: r.score, confidence: r.confidence, reason: r.reason, evaluators: r.evaluators.length, evalId: r.id || null };
}

function verdictLine(v: Opinion): string {
  if (!v.ok) return `No second opinion from Reppo: ${v.error ?? "no answer"}.`;
  const route = v.route === "ship" ? "go ahead" : v.route === "review" ? "needs a human look" : v.route === "block" ? "don't do it" : "no clear verdict";
  const score = v.score !== null ? `, score ${v.score}/100` : "";
  const who = v.evaluators ? ` from ${v.evaluators} independent evaluators` : " from Reppo's evaluator panel";
  return `Reppo second opinion${who}: ${route}${score}${v.confidence ? ` (${v.confidence} confidence)` : ""}.`;
}

async function secondOpinion(e: Errand, step: PlanStep, r: StepResult, question: string, proposal: Record<string, unknown>) {
  const v = await askReppo(e, step, question, proposal);
  r.facts.push(verdictLine(v), ...(v.reason ? [`Reppo's reasoning: ${v.reason}`] : []));
  r.output = { ...(r.output ?? {}), reppo: v };
  event(e, "step", verdictLine(v), { stepId: step.id });
  await save(e);
  if (v.ok && v.route === "ship") return;
  const why = v.reason ? ` "${v.reason.slice(0, 300)}"` : "";
  const a = await ask(e, `${verdictLine(v)}${why} Go ahead anyway?`, ["Go ahead", "Stop here"], step.purpose);
  if (!/^(go|yes|y|ok|buy)/i.test(a.trim())) throw new Blocked("You stopped after Reppo's second opinion.");
}

async function runOpinion(e: Errand, step: PlanStep, r: StepResult) {
  const question = stepInput(step, "question") ?? step.purpose;
  const v = await askReppo(e, step, `Answer to the user's question "${question}": ${allFacts(e).slice(-8).join(" ") || "(no research yet)"}`, { question });
  r.facts.push(verdictLine(v), ...(v.reason ? [`Reppo's reasoning: ${v.reason}`] : []));
  r.output = { ...(r.output ?? {}), reppo: v };
  r.note = verdictLine(v);
}
