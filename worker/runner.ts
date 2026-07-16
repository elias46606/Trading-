// Startet Ingest-Worker und Alert-Dispatcher als Endlos-Loops.
// Wird auf zwei Wegen genutzt:
//   1. Eigenständiger Prozess:  npm run worker  (worker/index.ts)
//   2. Eingebettet im Webserver: EMBEDDED_WORKER=true beim Deployment
//      (src/instrumentation.ts) — praktisch für Single-Service-Hosting
//      wie Railway, wo nur ein Prozess laufen soll.

import { runIngestCycle } from "./ingest";
import { runDispatchCycle } from "./dispatcher";

let started = false;

export function startWorkerLoops(): void {
  if (started) return; // doppelten Start (z.B. Hot Reload) verhindern
  started = true;

  const ingestInterval = intFromEnv("INGEST_INTERVAL_SECONDS", 60);
  const dispatchInterval = intFromEnv("DISPATCH_INTERVAL_SECONDS", 45);

  console.log(
    `[worker] gestartet — Ingest alle ${ingestInterval}s, Dispatcher alle ${dispatchInterval}s ` +
      `(Telegram ${process.env.TELEGRAM_BOT_TOKEN ? "aktiv" : "nicht konfiguriert"})`,
  );

  let ingestRunning = false;
  let dispatchRunning = false;

  async function ingestTick() {
    if (ingestRunning) return; // überlappende Zyklen vermeiden
    ingestRunning = true;
    try {
      await runIngestCycle();
    } catch (err) {
      console.error("[ingest] Zyklus fehlgeschlagen:", err);
    } finally {
      ingestRunning = false;
    }
  }

  async function dispatchTick() {
    if (dispatchRunning) return;
    dispatchRunning = true;
    try {
      await runDispatchCycle();
    } catch (err) {
      console.error("[dispatcher] Zyklus fehlgeschlagen:", err);
    } finally {
      dispatchRunning = false;
    }
  }

  void ingestTick();
  setInterval(ingestTick, ingestInterval * 1_000);
  // Dispatcher leicht versetzt starten, damit der erste Ingest Daten liefert.
  setTimeout(() => {
    void dispatchTick();
    setInterval(dispatchTick, dispatchInterval * 1_000);
  }, 15_000);
}

function intFromEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
