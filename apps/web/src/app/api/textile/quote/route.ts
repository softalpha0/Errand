import { NextResponse } from "next/server";
import { ATTRIBUTION_CODE, MAX_ERRAND_USDT, bad, fromError, pair, parseAddress, parseBuyAmount, parseCurrency, parseProof, textile } from "@/lib/textile-server";

/** Firm quote for the user's wallet (taker). Keyless: relays the proof the user's wallet signed in the browser. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const currency = parseCurrency(body.currency);
  const buyAmount = parseBuyAmount(body.buyAmount);
  const taker = parseAddress(body.taker);
  const proof = parseProof(body.takerProof);
  if (!currency) return bad("Pick a supported currency.");
  if (buyAmount === null) return bad("Enter an amount above zero.");
  if (!taker) return bad("taker must be a wallet address.");
  if (proof === null) return bad("takerProof is malformed.");
  if (!textile.keyed && !proof) return bad("Sign the Textile proof in your wallet first.", 401);
  try {
    const data = await textile.requestWithProof({ ...pair(currency), buyAmount: buyAmount.toString(), taker, builderCodes: [ATTRIBUTION_CODE] }, proof);
    if (data.status === "quoted" && BigInt(data.quote.takerPays) > MAX_ERRAND_USDT) {
      await textile.cancel(data.rfqId, data.claimToken).catch(() => undefined);
      return bad("While Errand is in testing, one errand costs at most $35.");
    }
    return NextResponse.json({ data });
  } catch (e) {
    return fromError(e);
  }
}
