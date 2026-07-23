import { NextRequest, NextResponse } from "next/server";
import { screenTokens, parseFilterFromParams } from "@/lib/screening";

export const dynamic = "force-dynamic";

// Discovery-/Screener-Feed: liest ausschließlich aus der DB (Konzept 6).
// ?view=new  → frisch gelistete Coins, neueste zuerst (max. 24h alt)
// sonst      → Screener nach Filtern, sortiert nach 24h-Volumen
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const isNew = params.view === "new";
  const filter = isNew
    ? {
        minLiquidityUsd: 0,
        minVolMcapRatio: 0,
        maxPoolAgeHours: 24,
        minBuys24h: 0,
        requireGreen: false,
        ...parseFilterFromParams(params),
      }
    : parseFilterFromParams(params);
  const tokens = await screenTokens(filter, 100, isNew ? "newest" : "volume");
  return NextResponse.json({ tokens, updatedAt: new Date().toISOString() });
}
