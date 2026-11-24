import { NextResponse } from "next/server";
import { ATTRIBUTION_CODE, PAIR, bad, fromError, parseAddress, parseBuyAmount, parseProof, textile } from "@/lib/textile-server";

/** Firm quote for the user's wallet (taker). Keyless: relays the proof the user's wallet signed in the browser. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const buyAmount = parseBuyAmount(body.buyAmount);
  const taker = parseAddress(body.taker);
  const proof = parseProof(body.takerProof);
  if (buyAmount === null) return bad("Send between ₦1,500 and ₦50,000.");
  if (!taker) return bad("taker must be a wallet address.");
  if (proof === null) return bad("takerProof is malformed.");
  if (!textile.keyed && !proof) return bad("Sign the Textile proof in your wallet first.", 401);
  try {
    const data = await textile.requestWithProof({ ...PAIR, buyAmount: buyAmount.toString(), taker, builderCodes: [ATTRIBUTION_CODE] }, proof);
    return NextResponse.json({ data });
  } catch (e) {
    return fromError(e);
  }
}
