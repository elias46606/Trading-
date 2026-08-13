import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kleiner Systemstatus für die UI: Läuft der Worker? Ist Telegram konfiguriert?
// DB-Zugriff abgesichert — bei Ausfall meldet die Route den Fehler statt 500.
export async function GET() {
  const base = {
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    copilotConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  };
  try {
    const [tokenCount, latestPair, alertCount] = await Promise.all([
      prisma.token.count(),
      prisma.pair.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
      prisma.alertSent.count(),
    ]);
    return NextResponse.json({
      ...base,
      dbOk: true,
      tokenCount,
      alertCount,
      lastIngestAt: latestPair?.updatedAt ?? null,
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json({
      ...base,
      dbOk: false,
      dbErrorCode: e.code ?? null,
      dbError: (e.message ?? String(err)).slice(0, 300),
    });
  }
}
