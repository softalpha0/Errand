/**
 * Textile FX RFQ API v2 client (Celo), keyless.
 * Source: https://fx-docs.textilecredit.com/api/v2/rfq.html, /authentication.html, /errors.html (read 24 Nov 2026).
 *
 * Flow: request a firm quote (unsigned first; on 401 proof_of_control_required sign TakerControl v1 and resend)
 * → validate it (R15) → approve takerPays to the reactor → WAIT for the receipt → recheck expiresAt
 * → broadcast transactions.swap with Errand's tag → POST /submit → poll GET until filled.
 *
 * Attribution: keyless callers get no Textile tag (includeAttribution is for partner keys), so Errand appends
 * its own ERC-8021 suffix to transactions.swap.data (Loops FAQ). Do it once: either a wallet client extended
 * with errandAttribution(), or tagCalldata(), never both.
 */
import { decodeFunctionData, encodeFunctionData, toHex, type Address, type Hex } from "viem";
import { TEXTILE_REACTOR } from "./session.js";

export const TEXTILE_API = "https://api.textilecredit.com/v2";
export const REQUEST_TIMEOUT_MS = 75_000;

export type RfqAmount = { sellAmount: string; buyAmount?: never } | { buyAmount: string; sellAmount?: never };

export type RfqRequest = {
  chainId: number;
  sellToken: Address;
  buyToken: Address;
  taker: Address;
  builderCodes?: string[];
} & RfqAmount;

export type Tx = { to: Address; data: Hex; value: string; chainId: number };

export type FirmQuote = {
  rfqId: string;
  claimToken: string;
  status: "quoted";
  quote: {
    sellAmount: string;
    buyAmount: string;
    feeAmount: string;
    takerPays: string;
    rateRay: string;
    expiresAt: string;
    orderDeadline: string;
    latestOrderDeadline: string;
    reactor: Address;
    taker: Address;
    encodedOrder: Hex;
    signature: Hex;
    orders: unknown[];
  };
  transactions: { approval: Tx; swap: Tx };
  routing?: unknown;
};

export type NoQuote = {
  rfqId?: string;
  claimToken?: string;
  status: "no_quote";
  reason: "no_makers_online" | "no_restricted_liquidity" | "no_valid_quote" | string;
  availableSellAmount?: string;
  availableBuyAmount?: string;
  reservedUntil?: string;
  retryAfterMs?: number;
};

export type RfqStatus = {
  rfqId: string;
  status: "soliciting" | "quoted" | "no_quote" | "submitted" | "filled" | "failed" | "expired" | string;
  sellAmount: string;
  buyAmount: string;
  feeAmount?: string;
  taker: string;
  expiresAt: string;
  txHash: string | null;
  submittedAt: string | null;
  filledAt: string | null;
  failReason: string | null;
};

export class TextileError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code?: string,
    readonly reason?: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TextileError";
  }
}

/** EIP-712 typed data for the keyless proof of control (TakerControl v1). */
export function takerControlTypedData(p: { taker: Address; chainId: number; nonce: Hex; issuedAtMs: number }) {
  return {
    domain: { name: "Textile Taker Control", version: "1", chainId: p.chainId },
    types: {
      TakerControl: [
        { name: "taker", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
      ],
    },
    primaryType: "TakerControl" as const,
    message: { taker: p.taker, chainId: BigInt(p.chainId), nonce: p.nonce, issuedAt: BigInt(p.issuedAtMs) },
  };
}

export type TypedDataSigner = (typedData: ReturnType<typeof takerControlTypedData>) => Promise<Hex>;

export function randomNonce(): Hex {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}

export type TextileClientOptions = { baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number; now?: () => number };

export class TextileClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;

  constructor(opts: TextileClientOptions = {}) {
    this.base = (opts.baseUrl ?? TEXTILE_API).replace(/\/$/, "");
    this.doFetch = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.now = opts.now ?? Date.now;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const res = await this.doFetch(`${this.base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    let json: { data?: T; error?: { code?: string; message?: string; request_id?: string; details?: Record<string, unknown> } } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new TextileError(`Textile returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`, res.status);
    }
    if (!res.ok || json.error) {
      const e = json.error ?? {};
      throw new TextileError(
        e.message ?? `Textile HTTP ${res.status}`,
        res.status,
        e.code,
        typeof e.details?.reason === "string" ? e.details.reason : undefined,
        e.request_id ?? res.headers.get("x-request-id") ?? undefined,
        e.details,
      );
    }
    if (json.data === undefined) throw new TextileError("Textile response had no data.", res.status);
    return json.data;
  }

  /** Free indicative price. Nothing reserved. */
  preview(req: Omit<RfqRequest, "taker" | "builderCodes">) {
    return this.call<{ status: "preview" | "no_quote"; sellAmount?: string; buyAmount?: string; feeAmount?: string; takerPays?: string; availableSellAmount?: string; reason?: string }>(
      "POST",
      "/rfq/preview",
      req,
    );
  }

  /**
   * Firm quote. Sends unsigned first; if Textile asks for proof of control, signs TakerControl v1 once
   * with `sign` and resends. The claimToken in the result is returned only once: store it.
   */
  async request(req: RfqRequest, sign: TypedDataSigner): Promise<FirmQuote | NoQuote> {
    try {
      return await this.call<FirmQuote | NoQuote>("POST", "/rfq/request", req);
    } catch (e) {
      if (!(e instanceof TextileError && e.httpStatus === 401 && e.reason === "proof_of_control_required")) throw e;
    }
    const nonce = randomNonce();
    const issuedAt = this.now();
    const signature = await sign(takerControlTypedData({ taker: req.taker, chainId: req.chainId, nonce, issuedAtMs: issuedAt }));
    return this.call<FirmQuote | NoQuote>("POST", "/rfq/request", { ...req, takerProof: { nonce, issuedAt, signature } });
  }

  get(rfqId: string, claimToken: string) {
    return this.call<RfqStatus>("GET", `/rfq/${encodeURIComponent(rfqId)}`, undefined, { "X-Rfq-Claim": claimToken });
  }

  /** Report the broadcast swap hash (idempotent for the same hash; a different hash → 409). */
  submit(rfqId: string, claimToken: string, txHash: Hex) {
    return this.call<unknown>("POST", `/rfq/${encodeURIComponent(rfqId)}/submit`, { txHash }, { "X-Rfq-Claim": claimToken });
  }

  /** Release a quote you won't execute (only while quoted). Does not free the outstanding-RFQ slot. */
  cancel(rfqId: string, claimToken: string) {
    return this.call<{ rfqId: string; status: string }>("POST", `/rfq/${encodeURIComponent(rfqId)}/cancel`, {}, { "X-Rfq-Claim": claimToken });
  }
}

const approveAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export function encodeApprove(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [spender, amount] });
}

/**
 * Rule R15 (PRD §8): refuse a firm quote that is expired, for another taker, pointed at another contract,
 * for other tokens, or costs more than planned. Returns the list of problems (empty = OK).
 */
export function validateFirmQuote(
  q: FirmQuote,
  expect: { taker: Address; sellToken: Address; maxTakerPays: bigint; chainId: number; nowMs: number; reactor?: Address },
): string[] {
  const problems: string[] = [];
  const reactor = (expect.reactor ?? TEXTILE_REACTOR).toLowerCase();
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (q.status !== "quoted") problems.push(`Quote status is ${q.status}, not quoted.`);
  if (Date.parse(q.quote.expiresAt) <= expect.nowMs) problems.push("Quote has expired.");
  if (!eq(q.quote.taker, expect.taker)) problems.push("Quote is bound to a different taker.");
  if (!eq(q.quote.reactor, reactor)) problems.push("Quote's reactor is not Textile's LimitOrderReactor.");
  if (!eq(q.transactions.swap.to, reactor)) problems.push("Swap transaction does not go to the reactor.");
  if (q.transactions.swap.chainId !== expect.chainId || q.transactions.approval.chainId !== expect.chainId) problems.push("Transactions are for another chain.");
  if (BigInt(q.transactions.swap.value || "0") !== 0n) problems.push("Swap transaction sends native value; it must be 0.");
  if (!eq(q.transactions.approval.to, expect.sellToken)) problems.push("Approval is not on the sell token.");
  if (BigInt(q.quote.takerPays) > expect.maxTakerPays) problems.push("Quote costs more than the planned maximum.");
  try {
    const decoded = decodeFunctionData({ abi: approveAbi, data: q.transactions.approval.data });
    const [spender, amount] = decoded.args;
    if (!eq(spender, reactor)) problems.push("Approval spender is not the reactor.");
    if (amount !== BigInt(q.quote.takerPays)) problems.push("Approval amount differs from takerPays.");
  } catch {
    problems.push("Approval calldata is not a plain approve(spender, amount).");
  }
  return problems;
}

export function isTerminal(status: string): boolean {
  return status === "filled" || status === "failed" || status === "expired" || status === "no_quote";
}
