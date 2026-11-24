import { NextResponse } from "next/server";
import { textile } from "@/lib/textile-server";

/** Tells the browser whether it must sign a Textile proof (keyless) or not (server has an API key). */
export function GET() {
  return NextResponse.json({ keyed: textile.keyed });
}
