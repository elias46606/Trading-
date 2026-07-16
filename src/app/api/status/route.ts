import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kleiner Systemstatus für die UI: Läuft der Worker? Ist Telegram konfiguriert?
export async function GET() {
  const [tokenCount, latestPair, alertCount] = await Promise.all([
    prisma.token.count(),
    prisma.pair.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.alertSent.count(),
  ]);
  return NextResponse.json({
    tokenCount,
    alertCount,
    lastIngestAt: latestPair?.updatedAt ?? null,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    copilotConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
