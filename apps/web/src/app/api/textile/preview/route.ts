import { NextResponse } from "next/server";
import { PAIR, bad, fromError, parseBuyAmount, textile } from "@/lib/textile-server";

/** Indicative USD₮ cost for an exact Naira amount. Free, reserves nothing. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const buyAmount = parseBuyAmount(body.buyAmount);
  if (buyAmount === null) return bad("Send between ₦1,500 and ₦50,000.");
  try {
    const data = await textile.preview({ ...PAIR, buyAmount: buyAmount.toString() });
    return NextResponse.json({ data });
  } catch (e) {
    return fromError(e);
  }
}
