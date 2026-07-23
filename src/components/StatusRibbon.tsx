"use client";

import { useEffect, useState } from "react";

interface Status {
  tokenCount: number;
  alertCount: number;
  lastIngestAt: string | null;
  telegramConfigured: boolean;
  copilotConfigured: boolean;
}

// Zeigt, ob der Ingest-Worker Daten liefert — die häufigste Stolperfalle,
// weil Web-App und Worker getrennte Prozesse sind (Konzept 2).
export function StatusRibbon() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then(setStatus)
        .catch(() => {});
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!status) return null;

  const last = status.lastIngestAt ? new Date(status.lastIngestAt) : null;
  // GitHub-Actions-Takt läuft real alle ~5–15 Min. — erst danach ist es "stale".
  const staleMinutes = last ? (Date.now() - last.getTime()) / 60_000 : Infinity;
  const workerOk = staleMinutes < 20;

  return (
    <div
      className="flex items-center gap-x-3 text-xs text-muted"
      title={`${status.tokenCount} Tokens erfasst${last ? ` · letzte Aktualisierung ${last.toLocaleTimeString("de-DE")}` : ""}${status.telegramConfigured ? " · Telegram verbunden" : " · Alerts nur in-App"}`}
    >
      <span className={workerOk ? "text-ampel-green" : "text-ampel-yellow"}>
        ● {workerOk ? "Live" : "Aktualisierung folgt"}
      </span>
      <span>{status.tokenCount.toLocaleString("de-DE")} Coins erfasst</span>
    </div>
  );
}
