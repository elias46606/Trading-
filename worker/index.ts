// Startet Ingest-Worker und Alert-Dispatcher in einem Prozess:
//   npm run worker
// Beide Loops laufen unabhängig; ein Fehler in einem Zyklus
// beendet den Prozess nicht.

import { runIngestCycle } from "./ingest";
import { runDispatchCycle } from "./dispatcher";

try {
  process.loadEnvFile?.(".env");
} catch {
  // keine .env vorhanden — Defaults nutzen
}

const ingestInterval = intFromEnv("INGEST_INTERVAL_SECONDS", 60);
const dispatchInterval = intFromEnv("DISPATCH_INTERVAL_SECONDS", 45);

console.log(
  `[worker] gestartet — Ingest alle ${ingestInterval}s, Dispatcher alle ${dispatchInterval}s ` +
    `(Telegram ${process.env.TELEGRAM_BOT_TOKEN ? "aktiv" : "nicht konfiguriert"})`,
);

let ingestRunning = false;
let dispatchRunning = false;

async function ingestTick() {
  if (ingestRunning) return; // Überlappende Zyklen vermeiden
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

function intFromEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
