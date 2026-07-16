import { NextResponse } from "next/server";
import { getTokenMetrics } from "@/lib/screening";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const metrics = await getTokenMetrics(address);
  if (!metrics) {
    return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ token: metrics });
}
