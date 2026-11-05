/**
 * Kite Passport through the kpass CLI (v6.13+). Commands and flags were read
 * from `kpass --help` and `kpass session create --help` on the installed CLI.
 *
 *   kpass session create --separate --task-summary .. --max-amount-per-tx .. --max-total-amount .. --ttl .. --no-browser
 *   kpass session status --request-id ..
 *   kpass session use --session-id ..
 *   kpass session execute --url .. --idempotency-key .. [--method POST] [--headers json] [--body json]
 *   kpass wallet balance
 *
 * Added on 5 Nov from Kite's own Passport skills (bundle 110, skills 3.6.7):
 *   kpass login init --email .. --client agent        (authenticate-user)
 *   KPASS_LOGIN_CODE=.. kpass login verify --login-id ..
 *   kpass agent:register --type errand                (request-session)
 *   kpass allowance status                            (kite-passport: free, reads only)
 *   kpass session execute .. --use-allowance          (x402-execute: allowance pays, idempotency key required)
 *   kpass shop:search / shop:cart / shop:shipping / shop:checkout --confirmed / shop:order status  (shopping)
 *
 * Each connected person gets their own folder. kpass keeps a project's login in
 * `.kite-passport/` in the folder it runs in ("With a local (project) install,
 * each project keeps its own login"), and HOME/USERPROFILE point there too, so
 * one person's login can never be used for another person's errand.
 */
import { execFile } from "node:child_process";
import type { AllowanceStatus, ShippingInput } from "@errand/core";
import { env } from "./env";
import { log } from "./log";
import { extractBody, extractPayment, explorerUrl, findApprovalUrl, findString, readApproval } from "./kite-parse";

export class KiteError extends Error {
  constructor(
    message: string,
    public readonly raw: unknown,
    public readonly exitCode: number | null,
  ) {
    super(message);
  }
}

/** Plain-language messages for the CLI's documented exit codes. */
const EXIT: Record<number, string> = {
  1: "Kite Passport could not be reached.",
  2: "kpass rejected the command (usage error).",
  3: "Kite Passport login expired. Run `kpass login init` on the agent machine.",
  4: "Kite Passport could not find that session or user.",
  5: "Kite Passport is rate limiting requests. Try again in a minute.",
};

export interface KpassOpts {
  /** A connected person's own folder. Omit for the operator's Passport. */
  home?: string | null;
  timeoutMs?: number;
  /** Extra environment, e.g. KPASS_LOGIN_CODE (kept out of the process list, as Kite advises). */
  extraEnv?: Record<string, string>;
}

function kpassEnv(o: KpassOpts): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env, KPASS_NO_BROWSER: "1", KPASS_NO_UPDATE_CHECK: "1", ...(o.extraEnv ?? {}) };
  if (o.home) {
    base.HOME = o.home;
    base.USERPROFILE = o.home;
  }
  return base;
}

export async function kpass(args: string[], timeoutOrOpts: number | KpassOpts = 120_000): Promise<unknown> {
  const o: KpassOpts = typeof timeoutOrOpts === "number" ? { timeoutMs: timeoutOrOpts } : timeoutOrOpts;
  const timeoutMs = o.timeoutMs ?? 120_000;
  const full = [...args, "--output", "json", "--no-interactive"];
  return new Promise((resolve, reject) => {
    execFile(
      env.kite.bin,
      full,
      { cwd: o.home ?? env.kite.workdir, env: kpassEnv(o), timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        let parsed: unknown = null;
        const text = stdout.toString().trim();
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          // Some commands print several JSON documents; keep the last one.
          const last = text.split(/\n(?=\{)/).pop();
          try {
            parsed = last ? JSON.parse(last) : text;
          } catch {
            parsed = text;
          }
        }
        const code = error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === "number" ? ((error as unknown as { code: number }).code) : error ? 1 : 0;
        const status = typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>).status : undefined;
        if (error || status === "error") {
          const userMessage = findString(parsed, ["user_message"]);
          if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
            reject(new KiteError(`kpass not found at "${env.kite.bin}". Install it or set KPASS_BIN.`, null, null));
            return;
          }
          const specific = userMessage ?? findString(parsed, ["error", "message"]) ?? (stderr.toString().trim() || null);
          reject(new KiteError(specific ?? EXIT[code] ?? "kpass failed.", parsed, code));
          return;
        }
        resolve(parsed);
      },
    );
  });
}

export interface SessionRequest {
  requestId: string | null;
  sessionId: string | null;
  approvalUrl: string | null;
  raw: unknown;
}

function notRegistered(err: unknown): boolean {
  return err instanceof KiteError && /agent not registered/i.test(`${err.message} ${JSON.stringify(err.raw ?? "")}`);
}

/**
 * Kite needs the calling agent registered once per login before it will create sessions
 * (`kpass agent:register --type <type>`, Kite's request-session skill). Register on first need, then retry once.
 */
async function withRegistration<T>(home: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!notRegistered(err)) throw err;
    log.info("kite.agent_register", { home: home ? "connected passport" : "operator" });
    await registerAgent(home);
    return fn();
  }
}

/**
 * Kite rejects a session whose per-payment limit is above its total (seen live on 5 Nov:
 * "max_amount_per_tx is required" for $1.00 per payment with a $0.34 total). Cents are
 * rounded up so the session is never a fraction of a cent smaller than the plan needs.
 */
export function sessionLimits(maxPerTxUsd: number, maxTotalUsd: number): { perTx: string; total: string } {
  const up = (x: number) => Math.ceil(Math.round(x * 1_000_000) / 10_000) / 100;
  const total = Math.max(0.01, up(maxTotalUsd));
  const perTx = Math.max(0.01, Math.min(up(maxPerTxUsd), total));
  return { perTx: perTx.toFixed(2), total: total.toFixed(2) };
}

export async function createSession(opts: {
  taskSummary: string;
  maxPerTxUsd: number;
  maxTotalUsd: number;
  ttl?: string;
  home?: string | null;
}): Promise<SessionRequest> {
  const limits = sessionLimits(opts.maxPerTxUsd, opts.maxTotalUsd);
  const raw = await withRegistration(opts.home, () => kpass([
    "session",
    "create",
    "--separate",
    "--no-reuse",
    "--no-browser",
    "--task-summary",
    opts.taskSummary.slice(0, 120),
    "--max-amount-per-tx",
    limits.perTx,
    "--max-total-amount",
    limits.total,
    "--ttl",
    opts.ttl ?? env.kite.sessionTtl,
  ], { home: opts.home }));
  log.info("kite.session.create", raw);
  return {
    requestId: findString(raw, ["request_id", "requestId"]),
    sessionId: findString(raw, ["session_id", "sessionId"]),
    approvalUrl: findApprovalUrl(raw),
    raw,
  };
}

export async function sessionStatus(requestId: string, home?: string | null): Promise<{ state: "approved" | "rejected" | "pending"; sessionId: string | null; raw: unknown }> {
  const raw = await kpass(["session", "status", "--request-id", requestId], { home });
  return { state: readApproval(raw), sessionId: findString(raw, ["session_id", "sessionId"]), raw };
}

export async function useSession(sessionId: string, home?: string | null): Promise<void> {
  await kpass(["session", "use", "--session-id", sessionId], { home });
}

export interface ExecuteResult {
  body: unknown;
  txHash: string | null;
  chain: string | null;
  amountUsd: number | null;
  explorerUrl: string | null;
  raw: unknown;
}

export async function execute(req: {
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  idempotencyKey: string;
  /** Pay from the person's Kite allowance (standing errands). Kite requires the idempotency key. */
  useAllowance?: boolean;
  home?: string | null;
}): Promise<ExecuteResult> {
  const args = ["session", "execute", "--url", req.url, "--idempotency-key", req.idempotencyKey, "--method", req.method];
  if (req.useAllowance) args.push("--use-allowance");
  if (req.method === "POST") {
    args.push("--headers", JSON.stringify({ "Content-Type": "application/json" }));
    args.push("--body", JSON.stringify(req.body ?? {}));
  }
  const raw = await withRegistration(req.home, () => kpass(args, { timeoutMs: 180_000, home: req.home }));
  const pay = extractPayment(raw);
  return {
    body: extractBody(raw),
    txHash: pay.txHash,
    chain: pay.chain,
    amountUsd: pay.amountUsd,
    explorerUrl: explorerUrl(pay.chain, pay.txHash),
    raw,
  };
}

export async function walletBalance(home?: string | null): Promise<unknown> {
  return kpass(["wallet", "balance"], { home });
}

// ---------- a person's own Passport ----------

export async function loginInit(email: string, home: string): Promise<{ loginId: string | null; expiresAt: string | null; raw: unknown }> {
  const raw = await kpass(["login", "init", "--email", email, "--client", "agent"], { home });
  return { loginId: findString(raw, ["login_id", "loginId"]), expiresAt: findString(raw, ["expires_at"]), raw };
}

export async function loginVerify(loginId: string, code: string, home: string): Promise<{ email: string | null; userId: string | null; raw: unknown }> {
  const raw = await kpass(["login", "verify", "--login-id", loginId], { home, extraEnv: { KPASS_LOGIN_CODE: code } });
  return { email: findString(raw, ["email"]), userId: findString(raw, ["user_id", "userId"]), raw };
}

export async function registerAgent(home?: string | null): Promise<unknown> {
  return kpass(["agent:register", "--type", env.kite.agentType], { home });
}

export async function logout(home: string): Promise<void> {
  await kpass(["logout"], { home });
}

export async function walletAddress(home?: string | null): Promise<string | null> {
  const raw = await kpass(["wallet", "address", "--chain", "base"], { home });
  const found = JSON.stringify(raw).match(/0x[a-fA-F0-9]{40}/);
  return found ? found[0] : null;
}

/** Free and read-only (Kite: "It binds nothing and sends no payment"). */
export async function allowanceStatus(home?: string | null): Promise<AllowanceStatus> {
  const raw = (await kpass(["allowance", "status"], { home })) as Record<string, unknown> | null;
  return readAllowance(raw);
}

export function readAllowance(raw: Record<string, unknown> | null): AllowanceStatus {
  const r = raw ?? {};
  const n = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const state = String(r.state ?? "unknown");
  return {
    state: (["active", "used_up", "none", "inactive", "no_feature"].includes(state) ? state : "unknown") as AllowanceStatus["state"],
    amount: n(r.amount),
    period: typeof r.period === "string" ? r.period : null,
    spent: n(r.spent),
    left: n(r.left),
    resetAt: typeof r.reset_at === "string" ? r.reset_at : null,
    dashboardUrl: typeof r.dashboard_url === "string" ? r.dashboard_url : null,
    userMessage: typeof r.user_message === "string" ? r.user_message : null,
  };
}

// ---------- shopping (Amazon through Kite) ----------
// Field names below are the ones printed in Kite's shopping skill (references/commands.md).

export interface ShopItem {
  provider: string;
  externalId: string;
  title: string;
  priceUsd: number | null;
  rating: number | null;
  reviews: number | null;
  link: string | null;
}

export function readShopItems(raw: unknown): ShopItem[] {
  const items = ((raw as { items?: unknown[] } | null)?.items ?? []) as Record<string, unknown>[];
  return items.map((i) => ({
    provider: String(i.provider ?? ""),
    externalId: String(i.external_identifier ?? ""),
    title: String(i.title ?? ""),
    priceUsd: parsePrice(i.price),
    rating: Number.isFinite(Number(i.rating)) ? Number(i.rating) : null,
    reviews: Number.isFinite(Number(i.reviews)) ? Number(i.reviews) : null,
    link: typeof i.link === "string" ? i.link : null,
  })).filter((i) => i.provider && i.externalId);
}

export function parsePrice(v: unknown): number | null {
  const m = String(v ?? "").replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export async function shopSearch(query: string, home?: string | null): Promise<ShopItem[]> {
  return readShopItems(await kpass(["shop:search", "--query", query, "--max-results", "5"], { home }));
}

export async function shopCartClear(home?: string | null): Promise<void> {
  await kpass(["shop:cart", "clear"], { home });
}

export async function shopCartAdd(item: { provider: string; externalId: string }, home?: string | null): Promise<unknown> {
  return kpass(["shop:cart", "add", "--provider", item.provider, "--external-id", item.externalId], { home });
}

export interface ShopCart {
  items: ShopItem[];
  quantities: number[];
  subtotalUsd: number | null;
  chain: string | null;
  currency: string | null;
}

export function readCart(raw: unknown): ShopCart {
  const r = (raw ?? {}) as { items?: Record<string, unknown>[]; payment?: { chain?: string; currency?: string } };
  const items = readShopItems(r);
  const quantities = (r.items ?? []).map((i) => Number(i.quantity ?? 1) || 1);
  const prices = items.map((i) => i.priceUsd);
  const subtotal = prices.every((p) => p !== null) ? Math.round(items.reduce((a, i, k) => a + (i.priceUsd ?? 0) * (quantities[k] ?? 1), 0) * 100) / 100 : null;
  return { items, quantities, subtotalUsd: subtotal, chain: r.payment?.chain ?? null, currency: r.payment?.currency ?? null };
}

export async function shopCartView(home?: string | null): Promise<ShopCart> {
  return readCart(await kpass(["shop:cart", "view"], { home }));
}

export interface Shipping {
  complete: boolean;
  missing: string[];
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export function readShipping(raw: unknown): Shipping {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    complete: r.complete === true,
    missing: Array.isArray(r.missing) ? r.missing.map(String) : [],
    name: typeof r.name === "string" ? r.name : null,
    city: typeof r.city === "string" ? r.city : null,
    state: typeof r.state === "string" ? r.state : null,
    country: typeof r.country === "string" ? r.country : null,
  };
}

export async function shopShippingView(home?: string | null): Promise<Shipping> {
  return readShipping(await kpass(["shop:shipping", "view"], { home }));
}

export async function shopShippingUpdate(s: ShippingInput, home?: string | null): Promise<Shipping> {
  const args = ["shop:shipping", "update", "--name", s.name, "--email", s.email, "--line1", s.line1, "--city", s.city, "--state", s.state, "--postal", s.postal, "--country", s.country, "--phone", s.phone];
  if (s.line2) args.push("--line2", s.line2);
  return readShipping(await kpass(args, { home }));
}

export interface ShopOrder {
  orderId: string | null;
  orderStatus: string | null;
  txHash: string | null;
  chain: string | null;
  chargedUsd: number | null;
  raw: unknown;
}

export function readOrder(raw: unknown): ShopOrder {
  const r = (raw ?? {}) as Record<string, unknown>;
  const charged = Number(r.charged_amount);
  return {
    orderId: typeof r.order_id === "string" ? r.order_id : null,
    orderStatus: typeof r.order_status === "string" ? r.order_status : null,
    txHash: typeof r.destination_tx_hash === "string" ? r.destination_tx_hash : typeof r.tx_hash === "string" ? r.tx_hash : null,
    chain: typeof r.chain === "string" ? r.chain : null,
    // charged_amount is USDC base units (6 decimals); total_amount is a "$18.49" string.
    chargedUsd: Number.isFinite(charged) && charged > 0 ? charged / 1_000_000 : parsePrice(r.total_amount),
    raw,
  };
}

/** Only after the person confirmed the order summary. Five-minute timeout, as Kite documents. */
export async function shopCheckout(maxTotalUsd: number, home?: string | null): Promise<ShopOrder> {
  return readOrder(await kpass(["shop:checkout", "--confirmed", "--max-total", maxTotalUsd.toFixed(2)], { home, timeoutMs: 5 * 60_000 + 15_000 }));
}

export async function shopOrderStatus(orderId: string, home?: string | null): Promise<ShopOrder> {
  return readOrder(await kpass(["shop:order", "status", "--order-id", orderId], { home }));
}

export async function kpassVersion(): Promise<string | null> {
  try {
    return await new Promise((resolve) => {
      execFile(env.kite.bin, ["--version"], { timeout: 10_000, windowsHide: true }, (err, stdout) => {
        resolve(err ? null : stdout.toString().trim());
      });
    });
  } catch {
    return null;
  }
}
