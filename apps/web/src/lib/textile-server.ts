/**
 * Server-only Textile relay for the errand composer. Runs in Next.js route handlers on Vercel.
 * The browser never calls Textile directly (no CORS dependency) and a TEXTILE_API_KEY, if set, never
 * reaches the browser. Keyless: the user's wallet signs the TakerControl proof in the browser and we relay it.
 */
import { NextResponse } from "next/server";
import { USDT } from "@errand/celo/tokens";
import { LOCAL_CURRENCIES, MAX_ERRAND_USDT, currencyByCode, type LocalCurrency } from "@errand/celo/currencies";
import { TextileClient, TextileError, type TakerProof } from "@errand/celo/textile";
import { r14Corridor } from "@errand/celo/rules";

export const textile = new TextileClient({ apiKey: process.env.TEXTILE_API_KEY });
export const CHAIN_ID = 42220;
export const ATTRIBUTION_CODE = "celo_511bb691f2f0";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x[0-9a-fA-F]*$/;

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function fromError(e: unknown) {
  if (e instanceof TextileError) {
    return NextResponse.json({ error: e.message, code: e.code, reason: e.reason, requestId: e.requestId, details: e.details }, { status: e.httpStatus >= 500 ? 502 : e.httpStatus });
  }
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

/** A supported local currency by its code ("NGN", "IDR", …). */
export function parseCurrency(v: unknown): LocalCurrency | null {
  return typeof v === "string" ? (currencyByCode(v) ?? null) : null;
}

/** Exact-output amount in the local token's atomic units. The dollar limits are checked on the quote. */
export function parseBuyAmount(v: unknown): bigint | null {
  if (typeof v !== "string" || !/^\d{1,40}$/.test(v)) return null;
  const n = BigInt(v);
  return n > 0n ? n : null;
}

export function parseAddress(v: unknown): `0x${string}` | null {
  return typeof v === "string" && ADDRESS.test(v) ? (v as `0x${string}`) : null;
}

export function parseProof(v: unknown): TakerProof | undefined | null {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.nonce !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(p.nonce)) return null;
  if (typeof p.issuedAt !== "number" || !Number.isSafeInteger(p.issuedAt)) return null;
  if (typeof p.signature !== "string" || !HEX.test(p.signature)) return null;
  return { nonce: p.nonce as `0x${string}`, issuedAt: p.issuedAt, signature: p.signature as `0x${string}` };
}

export function parseRfq(body: Record<string, unknown>): { rfqId: string; claimToken: string } | null {
  const { rfqId, claimToken } = body;
  if (typeof rfqId !== "string" || !/^rfq_[A-Za-z0-9_-]{4,64}$/.test(rfqId)) return null;
  if (typeof claimToken !== "string" || claimToken.length < 6 || claimToken.length > 200) return null;
  return { rfqId, claimToken };
}

export function pair(c: LocalCurrency) {
  const p = { chainId: CHAIN_ID, sellToken: USDT.address, buyToken: c.token.address };
  if (r14Corridor(p.chainId, p.sellToken, p.buyToken).length) throw new Error("R14: outside the hackathon corridors.");
  return p;
}

export { LOCAL_CURRENCIES, MAX_ERRAND_USDT };
