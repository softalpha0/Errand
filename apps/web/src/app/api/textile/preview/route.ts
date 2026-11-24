import { NextResponse } from "next/server";
import { bad, fromError, pair, parseBuyAmount, parseCurrency, textile } from "@/lib/textile-server";

/** Indicative USD₮ cost for an exact amount of a local currency. Free, reserves nothing. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const currency = parseCurrency(body.currency);
  const buyAmount = parseBuyAmount(body.buyAmount);
  if (!currency) return bad("Pick a supported currency.");
  if (buyAmount === null) return bad("Enter an amount above zero.");
  try {
    const data = await textile.preview({ ...pair(currency), buyAmount: buyAmount.toString() });
    return NextResponse.json({ data });
  } catch (e) {
    return fromError(e);
  }
}
