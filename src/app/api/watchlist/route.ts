import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toMetrics } from "@/lib/screening";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await prisma.watchlistEntry.findMany({
    include: {
      token: {
        include: {
          pairs: { orderBy: { liquidityUsd: "desc" }, take: 1 },
          safetyScore: true,
          watchlist: true,
        },
      },
    },
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json({ tokens: entries.map((e) => toMetrics(e.token)) });
}

export async function POST(req: NextRequest) {
  const { address } = (await req.json()) as { address?: string };
  if (!address) return NextResponse.json({ error: "address fehlt" }, { status: 400 });

  const token = await prisma.token.findUnique({ where: { address } });
  if (!token) return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });

  await prisma.watchlistEntry.upsert({
    where: { tokenId: token.id },
    create: { tokenId: token.id },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { address } = (await req.json()) as { address?: string };
  if (!address) return NextResponse.json({ error: "address fehlt" }, { status: 400 });

  const token = await prisma.token.findUnique({ where: { address } });
  if (token) {
    await prisma.watchlistEntry.deleteMany({ where: { tokenId: token.id } });
  }
  return NextResponse.json({ ok: true });
}
