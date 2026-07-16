import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await prisma.alertSent.findMany({
    include: {
      token: { select: { address: true, symbol: true, name: true } },
      rule: { select: { name: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ alerts });
}
