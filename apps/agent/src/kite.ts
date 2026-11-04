/**
 * Kite Passport through the kpass CLI (v6.13+). Commands and flags were read
 * from `kpass --help` and `kpass session create --help` on the installed CLI.
 *
 *   kpass session create --separate --task-summary .. --max-amount-per-tx .. --max-total-amount .. --ttl .. --no-browser
 *   kpass session status --request-id ..
 *   kpass session use --session-id ..
 *   kpass session execute --url .. --idempotency-key .. [--method POST] [--headers json] [--body json]
 *   kpass wallet balance
 */
import { execFile } from "node:child_process";
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

export async function kpass(args: string[], timeoutMs = 120_000): Promise<unknown> {
  const full = [...args, "--output", "json", "--no-interactive"];
  return new Promise((resolve, reject) => {
    execFile(
      env.kite.bin,
      full,
      { cwd: env.kite.workdir, timeout: timeoutMs, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
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
          if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
            reject(new KiteError(`kpass not found at "${env.kite.bin}". Install it or set KPASS_BIN.`, null, null));
            return;
          }
          const msg = findString(parsed, ["error", "message"]) ?? stderr.toString().trim() ?? EXIT[code] ?? "kpass failed";
          reject(new KiteError(`${EXIT[code] ?? "kpass failed."} ${msg}`.trim(), parsed, code));
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

export async function createSession(opts: {
  taskSummary: string;
  maxPerTxUsd: number;
  maxTotalUsd: number;
  ttl?: string;
}): Promise<SessionRequest> {
  const raw = await kpass([
    "session",
    "create",
    "--separate",
    "--no-reuse",
    "--no-browser",
    "--task-summary",
    opts.taskSummary.slice(0, 120),
    "--max-amount-per-tx",
    opts.maxPerTxUsd.toFixed(2),
    "--max-total-amount",
    opts.maxTotalUsd.toFixed(2),
    "--ttl",
    opts.ttl ?? env.kite.sessionTtl,
  ]);
  log.info("kite.session.create", raw);
  return {
    requestId: findString(raw, ["request_id", "requestId"]),
    sessionId: findString(raw, ["session_id", "sessionId"]),
    approvalUrl: findApprovalUrl(raw),
    raw,
  };
}

export async function sessionStatus(requestId: string): Promise<{ state: "approved" | "rejected" | "pending"; sessionId: string | null; raw: unknown }> {
  const raw = await kpass(["session", "status", "--request-id", requestId]);
  return { state: readApproval(raw), sessionId: findString(raw, ["session_id", "sessionId"]), raw };
}

export async function useSession(sessionId: string): Promise<void> {
  await kpass(["session", "use", "--session-id", sessionId]);
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
}): Promise<ExecuteResult> {
  const args = ["session", "execute", "--url", req.url, "--idempotency-key", req.idempotencyKey, "--method", req.method];
  if (req.method === "POST") {
    args.push("--headers", JSON.stringify({ "Content-Type": "application/json" }));
    args.push("--body", JSON.stringify(req.body ?? {}));
  }
  const raw = await kpass(args, 180_000);
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

export async function walletBalance(): Promise<unknown> {
  return kpass(["wallet", "balance"]);
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
