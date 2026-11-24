/**
 * Server-only Textile relay for the errand composer. Runs in Next.js route handlers on Vercel.
 * The browser never calls Textile directly (no CORS dependency) and a TEXTILE_API_KEY, if set, never
 * reaches the browser. Keyless: the user's wallet signs the TakerControl proof in the browser and we relay it.
 */
import { NextResponse } from "next/server";
import { CNGN, USDT } from "@errand/celo/tokens";
import { TextileClient, TextileError, type TakerProof } from "@errand/celo/textile";
import { MAX_ERRAND_NAIRA_ATOMIC, MIN_ERRAND_NAIRA_ATOMIC, r14Corridor } from "@errand/celo/rules";

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

/** Exact-output Naira amount (cNGN atomic units, 6 decimals) within Errand's testing limits. */
export function parseBuyAmount(v: unknown): bigint | null {
  if (typeof v !== "string" || !/^\d{1,30}$/.test(v)) return null;
  const n = BigInt(v);
  return n >= MIN_ERRAND_NAIRA_ATOMIC && n <= MAX_ERRAND_NAIRA_ATOMIC ? n : null;
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

export const PAIR = { chainId: CHAIN_ID, sellToken: USDT.address, buyToken: CNGN.address };
if (r14Corridor(PAIR.chainId, PAIR.sellToken, PAIR.buyToken).length) throw new Error("R14: the composer's pair is outside the hackathon corridors.");
