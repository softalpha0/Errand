/**
 * Errand Guard's payment check: an agent describes a payment it is about to make on Celo,
 * and gets back approve | ask | block with plain reasons. Pure function, no I/O.
 *
 * Rules (G1–G8) are deliberately simple and explainable. They can only make a decision
 * stricter, never looser: any block wins, then any ask.
 */
import { CNGN, FORBIDDEN_ADAPTERS, USDT } from "@errand/celo/tokens";

export type Decision = "approve" | "ask" | "block";

export type PaymentToCheck = {
  /** Chain the payment is on. Errand Guard checks Celo mainnet only. */
  chainId: number;
  /** ERC-20 token address being paid. */
  token: string;
  /** Recipient address. */
  to: string;
  /** Amount in the token's smallest unit, as a decimal string. */
  amount: string;
  /** The paying agent's own limits for this payment, if it has them. */
  limits?: {
    /** Largest amount allowed for one payment, smallest unit, decimal string. */
    maxAmount?: string;
    /** Recipients the agent's user approved. If set, anything else is blocked. */
    allowedRecipients?: string[];
  };
  /** Who proposed this payment. "seller" = text from a paid response or a web page told the agent to pay. */
  suggestedBy?: "user" | "agent" | "seller";
  /** Optional free text: what the payment is for. Shown back, never trusted. */
  purpose?: string;
};

export type Finding = { rule: string; decision: Decision; reason: string };

export type CheckResult = {
  decision: Decision;
  findings: Finding[];
  /** Fingerprint used for the duplicate rule (G7). */
  fingerprint: string;
};

/** Tokens Errand Guard knows on Celo mainnet (docs/celo/SPONSORS.md §1 and §7). Lower-case address → symbol. */
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  [USDT.address.toLowerCase()]: { symbol: "USD₮", decimals: 6 },
  [CNGN.address.toLowerCase()]: { symbol: "cNGN", decimals: 6 },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
  "0xd2ab3c9a02dbbab236bfec45d1d755df4267f771": { symbol: "USA₮", decimals: 6 },
  "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22": { symbol: "IDRX", decimals: 2 },
  "0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d": { symbol: "wARS", decimals: 18 },
  "0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0": { symbol: "wBRL", decimals: 18 },
  "0x337e7456b420bd3481e7fa61fa9850343d610d34": { symbol: "wMXN", decimals: 18 },
  "0x8a1d45e102e886510e891d2ec656a708991e2d76": { symbol: "wCOP", decimals: 18 },
};

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const UINT = /^\d{1,78}$/;
const ZERO = "0x0000000000000000000000000000000000000000";

export function fingerprintOf(p: Pick<PaymentToCheck, "chainId" | "token" | "to" | "amount">): string {
  return `${p.chainId}:${p.token.toLowerCase()}:${p.to.toLowerCase()}:${p.amount}`;
}

/**
 * @param recentFingerprints fingerprints this same caller checked in the last few minutes (for G7).
 */
export function checkPayment(p: PaymentToCheck, recentFingerprints: ReadonlySet<string> = new Set()): CheckResult {
  const findings: Finding[] = [];
  const block = (rule: string, reason: string) => findings.push({ rule, decision: "block", reason });
  const ask = (rule: string, reason: string) => findings.push({ rule, decision: "ask", reason });

  // G1 chain
  if (p.chainId !== 42220) block("G1", `Errand Guard checks Celo mainnet (42220) only; this payment is on chain ${p.chainId}.`);

  // G2/G3 token
  const tokenOk = ADDRESS.test(p.token);
  if (!tokenOk) block("G2", "The token is not a valid address.");
  else if (FORBIDDEN_ADAPTERS.some((a) => a.toLowerCase() === p.token.toLowerCase()))
    block("G3", "This is an 18-decimal fee-currency adapter, not the token. Paying with it misprices the amount by 10^12.");
  else if (!KNOWN_TOKENS[p.token.toLowerCase()]) ask("G2", "Errand Guard doesn't know this token on Celo. Check it is the real one before paying.");

  // G4 recipient
  if (!ADDRESS.test(p.to)) block("G4", "The recipient is not a valid address.");
  else if (p.to.toLowerCase() === ZERO) block("G4", "The recipient is the zero address; the money would be lost.");
  else if (tokenOk && p.to.toLowerCase() === p.token.toLowerCase()) block("G4", "The recipient is the token contract itself; the money would be stuck.");

  // G5 amount
  if (!UINT.test(p.amount) || BigInt(p.amount) === 0n) block("G5", "The amount must be a whole number of the token's smallest unit, above zero.");
  else if (p.limits?.maxAmount !== undefined) {
    if (!UINT.test(p.limits.maxAmount)) block("G5", "limits.maxAmount must be a whole number in the token's smallest unit.");
    else if (BigInt(p.amount) > BigInt(p.limits.maxAmount)) block("G5", "The amount is above the largest single payment your user allowed.");
  }

  // G6 recipient allowlist
  const allowed = p.limits?.allowedRecipients;
  if (allowed && ADDRESS.test(p.to) && !allowed.some((a) => a.toLowerCase() === p.to.toLowerCase()))
    block("G6", "The recipient is not on the list your user approved.");

  // G7 duplicate
  const fingerprint = fingerprintOf(p);
  if (recentFingerprints.has(fingerprint)) ask("G7", "You checked the same payment (token, recipient, amount) a few minutes ago. Make sure it isn't a double payment.");

  // G8 seller-suggested purchase (Errand's rule R1)
  if (p.suggestedBy === "seller")
    block("G8", "A seller's text or a web page suggested this payment. Errand Guard never approves payments proposed by the party being paid; ask your user.");

  const decision: Decision = findings.some((f) => f.decision === "block") ? "block" : findings.some((f) => f.decision === "ask") ? "ask" : "approve";
  return { decision, findings, fingerprint };
}

/** Validates an untrusted JSON body into a PaymentToCheck, or returns a list of problems. */
export function parsePayment(body: unknown): { ok: true; payment: PaymentToCheck } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, problems: ["Send a JSON object."] };
  const b = body as Record<string, unknown>;
  if (typeof b.chainId !== "number") problems.push("chainId (number) is required.");
  for (const k of ["token", "to", "amount"] as const) if (typeof b[k] !== "string") problems.push(`${k} (string) is required.`);
  if (b.suggestedBy !== undefined && !["user", "agent", "seller"].includes(b.suggestedBy as string)) problems.push('suggestedBy must be "user", "agent" or "seller".');
  if (b.purpose !== undefined && (typeof b.purpose !== "string" || b.purpose.length > 280)) problems.push("purpose must be a string of at most 280 characters.");
  let limits: PaymentToCheck["limits"];
  if (b.limits !== undefined) {
    if (typeof b.limits !== "object" || b.limits === null) problems.push("limits must be an object.");
    else {
      const l = b.limits as Record<string, unknown>;
      if (l.maxAmount !== undefined && typeof l.maxAmount !== "string") problems.push("limits.maxAmount must be a string.");
      if (l.allowedRecipients !== undefined && (!Array.isArray(l.allowedRecipients) || l.allowedRecipients.some((a) => typeof a !== "string") || l.allowedRecipients.length > 50))
        problems.push("limits.allowedRecipients must be a list of at most 50 addresses.");
      limits = {
        ...(typeof l.maxAmount === "string" ? { maxAmount: l.maxAmount } : {}),
        ...(Array.isArray(l.allowedRecipients) ? { allowedRecipients: l.allowedRecipients as string[] } : {}),
      };
    }
  }
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    payment: {
      chainId: b.chainId as number,
      token: b.token as string,
      to: b.to as string,
      amount: b.amount as string,
      ...(limits ? { limits } : {}),
      ...(b.suggestedBy ? { suggestedBy: b.suggestedBy as PaymentToCheck["suggestedBy"] } : {}),
      ...(typeof b.purpose === "string" ? { purpose: b.purpose } : {}),
    },
  };
}
