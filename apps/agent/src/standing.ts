/**
 * Standing errands: "keep Mum's data topped up, at most $1 a day".
 *
 * x402 is one payment per call, which doesn't fit metered or recurring spending
 * (Kite said so in the hackathon AMA). Until Kite ships metered and subscription
 * payments, Errand meters on top of what exists today: the Kite **allowance**, a
 * weekly or monthly budget the person approves once on Kite with their passkey
 * (`kpass session execute --use-allowance`).
 *
 * - The first run plans the errand with SERV and asks the person to approve that plan.
 * - Every later run repeats exactly that plan, once per day or week, capped per run.
 * - Every payment in every run still goes through the guard (R1–R13 + SERV).
 * - Before each run Errand reads `kpass allowance status` (free). If the allowance is
 *   used up or too small, that run is skipped with Kite's own message and the next period tries again.
 * - Kite's allowance never pays shopping checkouts, so Amazon steps are refused.
 */
import { randomBytes } from "node:crypto";
import { spentUsd, type CreateStandingInput, type Errand, type StandingErrand } from "@errand/core";
import { env } from "./env";
import { log } from "./log";
import { allowanceFor } from "./passports";
import { createErrand, runnerHooks } from "./runner";
import { store } from "./store";

const PERIOD_MS = { day: 24 * 60 * 60_000, week: 7 * 24 * 60 * 60_000 } as const;
const now = () => new Date().toISOString();

async function put(s: StandingErrand) {
  s.updatedAt = now();
  await store.putDoc("standing", s.id, s);
}

export async function getStanding(id: string): Promise<StandingErrand | null> {
  return store.getDoc<StandingErrand>("standing", id);
}

export async function listStanding(passportId: string | null): Promise<StandingErrand[]> {
  const all = await store.listDocs<StandingErrand>("standing");
  return all.filter((s) => s.passportId === passportId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function errandInput(s: StandingErrand, email?: string) {
  return {
    task: s.task,
    budgetUsd: s.capPerRunUsd,
    maxPerPaymentUsd: Math.min(s.maxPerPaymentUsd, s.capPerRunUsd),
    validFor: "1h" as const,
    askAboveUsd: null,
    privacy: "public" as const,
    country: s.country ?? env.defaultCountry,
    network: "mainnet" as const,
    ...(email ? { email } : {}),
  };
}

export async function createStanding(input: CreateStandingInput, passportId: string | null): Promise<{ standing: StandingErrand; errandId: string }> {
  const s: StandingErrand = {
    id: `st_${randomBytes(6).toString("base64url")}`,
    createdAt: now(),
    updatedAt: now(),
    task: input.task,
    every: input.every,
    capPerRunUsd: Math.min(input.capPerRunUsd, env.maxBudgetUsd),
    maxPerPaymentUsd: input.maxPerPaymentUsd,
    privacy: input.privacy,
    country: input.country ?? env.defaultCountry,
    passportId,
    plan: null,
    state: "pending_approval",
    pausedReason: null,
    nextRunAt: null,
    runs: [],
  };
  await put(s);
  const e = await createErrand(errandInput(s, input.email), { passportId, funding: "allowance", standingId: s.id });
  s.runs.push({ errandId: e.id, at: now(), status: e.status, spentUsd: 0, note: "First run: approve the plan." });
  await put(s);
  return { standing: s, errandId: e.id };
}

/** Runs one period's errand now (also used by "Run now" on the page). */
export async function runStanding(id: string, reason: "schedule" | "manual"): Promise<string | null> {
  const s = await getStanding(id);
  if (!s || !s.plan || s.state === "stopped") return null;
  const allowance = await allowanceFor(s.passportId).catch(() => null);
  const total = s.plan.steps.reduce((a, x) => a + x.maxUsd, 0);
  if (!allowance || allowance.state !== "active" || (allowance.left !== null && allowance.left + 0.000001 < total)) {
    const why = allowance?.userMessage ?? `Your Kite allowance can't cover this run ($${total.toFixed(2)}).`;
    // Skip this period only; the next period tries again (allowances reset weekly or monthly).
    s.runs.push({ errandId: "", at: now(), status: "skipped", spentUsd: 0, note: why });
    s.nextRunAt = new Date(Date.now() + PERIOD_MS[s.every]).toISOString();
    await put(s);
    log.info("standing.skipped", { id, why });
    return null;
  }
  const e = await createErrand(errandInput(s), { passportId: s.passportId, funding: "allowance", standingId: s.id, presetPlan: s.plan });
  s.runs.push({ errandId: e.id, at: now(), status: e.status, spentUsd: 0, note: reason === "manual" ? "Run now (you asked)." : `Scheduled ${s.every === "day" ? "daily" : "weekly"} run.` });
  if (reason === "schedule" || !s.nextRunAt) s.nextRunAt = new Date(Date.now() + PERIOD_MS[s.every]).toISOString();
  await put(s);
  return e.id;
}

export async function setState(id: string, passportId: string | null, state: "active" | "paused" | "stopped"): Promise<StandingErrand | null> {
  const s = await getStanding(id);
  if (!s || s.passportId !== passportId || !s.plan) return null;
  s.state = state;
  s.pausedReason = state === "paused" ? "Paused by you." : null;
  if (state === "active" && (!s.nextRunAt || s.nextRunAt < now())) s.nextRunAt = new Date(Date.now() + PERIOD_MS[s.every]).toISOString();
  await put(s);
  return s;
}

// The runner tells us when a first-run plan is approved and when any run finishes.
runnerHooks.onPlanApproved = async (e: Errand) => {
  if (!e.standingId || !e.plan) return;
  const s = await getStanding(e.standingId);
  if (!s || s.state !== "pending_approval") return;
  s.plan = e.plan;
  s.state = "active";
  s.nextRunAt = new Date(Date.now() + PERIOD_MS[s.every]).toISOString();
  await put(s);
};

runnerHooks.onFinished = async (e: Errand) => {
  if (!e.standingId) return;
  const s = await getStanding(e.standingId);
  if (!s) return;
  const run = s.runs.find((r) => r.errandId === e.id);
  if (run) {
    run.status = e.status;
    run.spentUsd = spentUsd(e.payments);
    run.note = e.status === "failed" ? (e.error ?? "Failed.") : run.note;
  }
  // A first run that never got its plan approved ends the standing errand.
  if (s.state === "pending_approval" && e.status !== "running") s.state = "stopped";
  await put(s);
};

let timer: NodeJS.Timeout | null = null;

export function startStandingScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    void (async () => {
      const all = await store.listDocs<StandingErrand>("standing");
      for (const s of all) {
        if (s.state !== "active" || !s.nextRunAt || s.nextRunAt > now()) continue;
        await runStanding(s.id, "schedule").catch((err) => log.error("standing.run_failed", { id: s.id, error: String(err) }));
      }
    })();
  }, env.standingPollMs);
  timer.unref?.();
  log.info("standing.scheduler", { pollMs: env.standingPollMs });
}
