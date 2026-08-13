import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runIngestCycle } from "../../../../worker/ingest";
import { runDispatchCycle } from "../../../../worker/dispatcher";

// Serverloser Worker-Ersatz fürs kostenlose Hosting (Vercel, siehe DEPLOY.md):
// Ein externer Cron-Dienst (z.B. cron-job.org) ruft diese Route alle 1–2
// Minuten auf. Jeder Aufruf macht genau einen Ingest- + Dispatch-Zyklus —
// es braucht keinen dauerhaft laufenden Prozess.
//
// Aufruf: GET /api/cron?key=<CRON_SECRET>

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Schutz gegen Doppel-Aufrufe (z.B. Cron + neugieriger Browser-Tab):
// Ingest höchstens alle 30 Sekunden.
const MIN_INGEST_GAP_MS = 30_000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const key =
      req.nextUrl.searchParams.get("key") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (key !== secret) {
      return NextResponse.json({ error: "Ungültiger key" }, { status: 401 });
    }
  }

  const started = Date.now();
  const result: Record<string, unknown> = {};

  // Frische-Check eigen abgesichert: ein kurzer Neon-Verbindungsaussetzer
  // (kostenloser Tarif schläft nach Leerlauf) darf keinen 500 werfen —
  // dann eben Ingest laufen lassen statt abzubrechen.
  let fresh = false;
  try {
    const latest = await prisma.pair.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    fresh = Boolean(latest && Date.now() - latest.updatedAt.getTime() < MIN_INGEST_GAP_MS);
  } catch (err) {
    console.error("[cron] Frische-Check fehlgeschlagen:", err);
  }

  if (fresh) {
    result.ingest = "übersprungen (Daten jünger als 30s)";
  } else {
    try {
      await runIngestCycle();
      result.ingest = "ok";
    } catch (err) {
      console.error("[cron] Ingest fehlgeschlagen:", err);
      result.ingest = "fehler";
    }
  }

  try {
    await runDispatchCycle();
    result.dispatch = "ok";
  } catch (err) {
    console.error("[cron] Dispatch fehlgeschlagen:", err);
    result.dispatch = "fehler";
  }

  result.durationMs = Date.now() - started;
  // Immer HTTP 200 — auch wenn ein Teilzyklus scholt. Der Cron-Dienst
  // soll nicht bei jedem transienten DB-Hänger einen Fehlschlag melden;
  // der nächste Aufruf (in 1 Min.) holt es ohnehin nach.
  return NextResponse.json(result);
}
