import os from "node:os";
import path from "node:path";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? fallback : v.trim();
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" && process.env[name] !== undefined ? v : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes";
}

export const env = {
  port: num("PORT", 8787),
  /** "live" pays real sellers through Kite Passport. "demo" simulates payments and labels them. */
  mode: (str("ERRAND_MODE", "demo") === "live" ? "live" : "demo") as "live" | "demo",
  webOrigin: str("WEB_ORIGIN", "http://localhost:3000"),
  /** Optional: require this code in the x-access-code header to start a live errand. */
  accessCode: str("ERRAND_ACCESS_CODE"),
  defaultCountry: str("DEFAULT_COUNTRY", "NG"),
  maxBudgetUsd: num("MAX_BUDGET_USD", 25),

  serv: {
    apiKey: str("SERV_API_KEY"),
    baseUrl: str("SERV_BASE_URL", "https://inference-api.openserv.ai/v1"),
    /** Planner: Kronos audits the reasoning prompt before inference. */
    planModel: str("SERV_PLAN_MODEL", "gpt-5.4-mini-serv-kronos"),
    model: str("SERV_MODEL", "gpt-5.4-mini"),
    /** gr_ id of the guard graph built from docs/serv-guard-graph.md. Empty = Shadow Agent fallback. */
    guardGraphId: str("SERV_GUARD_GRAPH_ID"),
    /** Label shown on receipts and the stats page so before/after runs can be compared. */
    guardVersion: str("SERV_GUARD_VERSION", str("SERV_GUARD_GRAPH_ID", "shadow-agent-v1")),
  },

  kite: {
    bin: str("KPASS_BIN", "kpass"),
    /** Folder kpass runs in. Its login lives in .kite-passport/ here or in your home folder. */
    workdir: str("KPASS_WORKDIR", os.homedir()),
    sessionTtl: str("KITE_SESSION_TTL", "1h"),
    approvalTimeoutMs: num("KITE_APPROVAL_TIMEOUT_MS", 15 * 60_000),
    /** `kpass agent:register --type` value for connected people's Passports. */
    agentType: str("KITE_AGENT_TYPE", "errand"),
    /** One folder per connected person; each holds that person's own `.kite-passport/` login. */
    passportsDir: str("PASSPORTS_DIR", path.join(os.homedir(), ".errand", "passports")),
  },

  /** Standing errands: how often the scheduler looks for due runs. */
  standingPollMs: num("STANDING_POLL_MS", 60_000),

  telegram: {
    /** From @BotFather. Empty = no Telegram bot. */
    token: str("TELEGRAM_BOT_TOKEN"),
    /** Only changed for tests. */
    apiBase: str("TELEGRAM_API_BASE", "https://api.telegram.org"),
    /** Telegram user ids or @usernames allowed to start errands. Required in live mode. */
    allowed: str("TELEGRAM_ALLOWED_USERS").split(",").map((s) => s.trim().replace(/^@/, "").toLowerCase()).filter(Boolean),
    budgetUsd: num("TELEGRAM_BUDGET_USD", 1),
    /** 0 = same as the errand budget. */
    maxPerPaymentUsd: num("TELEGRAM_MAX_PER_PAYMENT_USD", 0),
  },

  reppo: {
    apiKey: str("REPPO_API_KEY"),
    baseUrl: str("REPPO_BASE_URL", "https://eval.reppo.xyz/api/v1"),
    enabled: bool("REPPO_ENABLED", true),
    /** Reppo removed its sandbox in Nov 2026; kept so old .env files still load. Always false. */
    sandbox: false,
    /** How often the grading worker checks Reppo (evaluations settle in 30-90 s). */
    pollMs: num("REPPO_POLL_MS", 10_000),
  },

  dolphin: {
    apiKey: str("DOLPHIN_API_KEY"),
    baseUrl: str("DOLPHIN_BASE_URL", "https://lighthouse.dphn.ai/run/text-v/v1"),
    model: str("DOLPHIN_MODEL", "deepseek-ai/DeepSeek-V4.1-Flash"),
  },

  /** Shared secret the public guard service (kite-service/errand-guard) sends to POST /check. Empty = /check disabled. */
  guardServiceToken: str("GUARD_SERVICE_TOKEN"),

  databaseUrl: str("DATABASE_URL"),
};

export function servConfigured(): boolean {
  return env.serv.apiKey.length > 0;
}

/** The form's ceiling for anyone who isn't spending Errand's own money. */
export const OPEN_BUDGET_MAX_USD = 1000;

/**
 * The most one errand may spend. MAX_BUDGET_USD protects the owner's wallet, so it applies only when
 * a live errand pays from Errand's own Kite Passport. Someone's own Passport is limited by Kite and their
 * passkey, and test errands move no money.
 */
export function budgetCap(opts: { ownPassport: boolean; test: boolean }): number {
  return env.mode === "live" && !opts.ownPassport && !opts.test ? env.maxBudgetUsd : OPEN_BUDGET_MAX_USD;
}

export function reppoConfigured(): boolean {
  return env.reppo.enabled && env.reppo.apiKey.length > 0;
}
