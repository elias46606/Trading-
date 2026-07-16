import { NextRequest, NextResponse } from "next/server";
import { screenTokens, parseFilterFromParams } from "@/lib/screening";

export const dynamic = "force-dynamic";

// Discovery-/Screener-Feed: liest ausschließlich aus der DB (Konzept 6).
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filter = parseFilterFromParams(params);
  const tokens = await screenTokens(filter, 100);
  return NextResponse.json({ tokens, updatedAt: new Date().toISOString() });
}
