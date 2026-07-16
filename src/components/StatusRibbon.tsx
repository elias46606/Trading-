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
  const staleMinutes = last ? (Date.now() - last.getTime()) / 60_000 : Infinity;
  const workerOk = staleMinutes < 5;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className={workerOk ? "text-ampel-green" : "text-ampel-red"}>
        ● Worker {workerOk ? "aktiv" : "inaktiv — `npm run worker` starten"}
      </span>
      <span>{status.tokenCount} Tokens in der DB</span>
      <span>
        Telegram:{" "}
        {status.telegramConfigured ? (
          <span className="text-ampel-green">verbunden</span>
        ) : (
          "nicht konfiguriert (Alerts nur in-App)"
        )}
      </span>
      {last && <span>Letzter Ingest: {last.toLocaleTimeString("de-DE")}</span>}
    </div>
  );
}
