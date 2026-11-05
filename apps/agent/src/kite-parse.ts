/**
 * kpass prints JSON, but the exact field names of `session create`,
 * `session status` and `session execute` are not documented. These helpers
 * search the JSON for the values we need instead of assuming one shape.
 * The raw output is always stored next to what we extracted, so the first
 * real run tells you if anything here needs adjusting (docs/kite-integration.md).
 */

type Json = unknown;

/** Depth-first search for the first value whose key matches one of `keys`. */
export function findKey(obj: Json, keys: string[], depth = 0): unknown {
  if (depth > 8 || obj === null || typeof obj !== "object") return undefined;
  const lower = keys.map((k) => k.toLowerCase());
  if (!Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (lower.includes(k.toLowerCase()) && v !== null && v !== undefined && v !== "") return v;
    }
  }
  for (const v of Array.isArray(obj) ? obj : Object.values(obj as Record<string, unknown>)) {
    const found = findKey(v, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function findString(obj: Json, keys: string[]): string | null {
  // Keys are tried in priority order, each across the whole document.
  for (const k of keys) {
    const v = findKey(obj, [k]);
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Like findString, but ignores the CLI's own top-level envelope fields. */
function findNested(obj: Json, keys: string[]): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return findString(obj, keys);
  const { status: _s, hint: _h, next_command: _n, _version: _v, ...rest } = obj as Record<string, unknown>;
  return findString(rest, keys);
}

/** Any https URL in the output that looks like an approval link. */
export function findApprovalUrl(obj: Json): string | null {
  const direct = findString(obj, ["approval_url", "approvalUrl", "approve_url", "url", "link"]);
  if (direct && /^https?:\/\//.test(direct)) return direct;
  const all: string[] = [];
  const walk = (o: Json, d: number) => {
    if (d > 8) return;
    if (typeof o === "string" && /^https?:\/\//.test(o)) all.push(o);
    else if (o && typeof o === "object") for (const v of Object.values(o as Record<string, unknown>)) walk(v, d + 1);
  };
  walk(obj, 0);
  return all.find((u) => /approv|session|passport/i.test(u)) ?? all[0] ?? null;
}

const APPROVED = ["approved", "active", "granted", "completed", "success"];
const REJECTED = ["rejected", "denied", "declined", "expired", "cancelled", "canceled", "failed"];

export function readApproval(obj: Json): "approved" | "rejected" | "pending" {
  const status = (findNested(obj, ["approval_status", "session_status", "request_status", "state", "status"]) ?? "").toLowerCase();
  if (REJECTED.some((s) => status.includes(s))) return "rejected";
  if (APPROVED.includes(status)) return "approved";
  if (findString(obj, ["session_id", "sessionId"]) && !status.includes("pend")) return "approved";
  return "pending";
}

/** Pull the seller's HTTP body out of a `session execute` result. */
export function extractBody(obj: Json): unknown {
  let candidate: unknown;
  for (const k of ["response_body", "body", "response", "data", "result"]) {
    candidate = findKey(obj, [k]);
    if (candidate !== undefined) break;
  }
  if (typeof candidate === "string") {
    try {
      return JSON.parse(candidate);
    } catch {
      return candidate;
    }
  }
  return candidate ?? obj;
}

export function extractPayment(obj: Json): {
  txHash: string | null;
  chain: string | null;
  amountUsd: number | null;
} {
  const txHash = findString(obj, ["tx_hash", "txHash", "transaction_hash", "transactionHash", "hash", "transaction"]);
  const chain = findString(obj, ["settled_chain", "chain", "network"]);
  const amountRaw = findKey(obj, ["amount_usd", "amountUsd", "charged_usd", "amount"]);
  const amount = typeof amountRaw === "number" ? amountRaw : typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  return {
    txHash: txHash && /^0x[0-9a-fA-F]{20,}$|^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(txHash) ? txHash : null,
    chain,
    amountUsd: Number.isFinite(amount) ? amount : null,
  };
}

/**
 * The amount Kite reports can be in dollars or in USDC base units (6 decimals): live on 5 Nov,
 * a $0.002 payment came back as "2000". Read it both ways and keep the one that matches the
 * price Errand expected to pay. Without a usable report, the expected price is recorded.
 */
export function reconcileAmountUsd(reported: number | null, expectedUsd: number): number {
  if (reported === null || !Number.isFinite(reported) || reported <= 0) return expectedUsd;
  if (!(expectedUsd > 0)) return reported < 1000 ? reported : reported / 1_000_000;
  const candidates = [reported, reported / 1_000_000];
  const off = (x: number) => Math.abs(Math.log(x / expectedUsd));
  return candidates.reduce((best, x) => (off(x) < off(best) ? x : best));
}

export function explorerUrl(chain: string | null, txHash: string | null): string | null {
  if (!txHash) return null;
  const c = (chain ?? "").toLowerCase();
  if (c.includes("kite") || c.includes("2366")) return `https://kitescan.ai/tx/${txHash}`;
  if (c.includes("solana")) return `https://solscan.io/tx/${txHash}`;
  if (c.includes("polygon") || c.includes("137")) return `https://polygonscan.com/tx/${txHash}`;
  if (c.includes("arbitrum") || c.includes("42161")) return `https://arbiscan.io/tx/${txHash}`;
  if (c.includes("avalanche") || c.includes("43114")) return `https://snowtrace.io/tx/${txHash}`;
  // Errand's sellers settle on Base by default.
  return `https://basescan.org/tx/${txHash}`;
}
