"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TokenMetrics } from "@/lib/types";
import { fmtAge, fmtPct, fmtRatioAsPct, fmtUsd } from "@/lib/format";
import { AmpelBadge } from "./AmpelBadge";
import { WatchButton } from "./WatchButton";

const POLL_MS = 20_000;

// Discovery-/Screener-Feed. Liest über die API nur aus der DB
// und aktualisiert sich alle 20 Sekunden selbst.
export function TokenTable({ endpoint }: { endpoint: string }) {
  const [tokens, setTokens] = useState<TokenMetrics[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tokens: TokenMetrics[] };
      setTokens(data.tokens);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [endpoint]);

  useEffect(() => {
    setTokens(null);
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (error && tokens === null) {
    return <div className="text-ampel-red text-sm py-8 text-center">Fehler beim Laden: {error}</div>;
  }
  if (tokens === null) {
    return <div className="text-muted text-sm py-8 text-center animate-pulse">Lade Daten …</div>;
  }
  if (tokens.length === 0) {
    return (
      <div className="text-muted text-sm py-8 text-center">
        Keine Tokens erfüllen aktuell die Filter. Läuft der Worker? (<code>npm run worker</code>)
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-line">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium text-right">Preis</th>
            <th className="px-4 py-3 font-medium text-right">Liquidität</th>
            <th className="px-4 py-3 font-medium text-right">24h-Vol</th>
            <th className="px-4 py-3 font-medium text-right">MCap</th>
            <th className="px-4 py-3 font-medium text-right" title="24h-Volumen ÷ Market Cap">
              Vol/MCap
            </th>
            <th className="px-4 py-3 font-medium text-right">24h %</th>
            <th className="px-4 py-3 font-medium text-right">Pool-Alter</th>
            <th className="px-4 py-3 font-medium text-right" title="Käufe / Verkäufe in 24h">
              B/S 24h
            </th>
            <th className="px-4 py-3 font-medium">Safety</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr
              key={t.address}
              className="border-b border-line/50 last:border-0 hover:bg-surface-2/60 transition-colors"
            >
              <td className="px-4 py-2.5">
                <Link href={`/token/${t.address}`} className="flex items-center gap-2 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.address && (
                    <span className="h-6 w-6 rounded-full bg-surface-2 border border-line grid place-items-center text-[10px] text-muted overflow-hidden shrink-0">
                      {t.symbol.slice(0, 2)}
                    </span>
                  )}
                  <span>
                    <span className="font-medium group-hover:text-accent transition-colors">
                      {t.symbol}
                    </span>
                    {t.name && (
                      <span className="text-muted text-xs block max-w-40 truncate">{t.name}</span>
                    )}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtUsd(t.priceUsd)}</td>
              <td className="px-4 py-2.5 text-right">{fmtUsd(t.liquidityUsd)}</td>
              <td className="px-4 py-2.5 text-right">{fmtUsd(t.volume24h)}</td>
              <td className="px-4 py-2.5 text-right">{fmtUsd(t.mcap)}</td>
              <td className="px-4 py-2.5 text-right">{fmtRatioAsPct(t.volMcapRatio)}</td>
              <td
                className={`px-4 py-2.5 text-right ${
                  (t.priceChange24h ?? 0) > 0
                    ? "text-ampel-green"
                    : (t.priceChange24h ?? 0) < 0
                      ? "text-ampel-red"
                      : ""
                }`}
              >
                {fmtPct(t.priceChange24h)}
              </td>
              <td className="px-4 py-2.5 text-right">{fmtAge(t.poolAgeHours)}</td>
              <td className="px-4 py-2.5 text-right text-xs">
                <span className="text-ampel-green">{t.buys24h ?? "—"}</span>
                <span className="text-muted"> / </span>
                <span className="text-ampel-red">{t.sells24h ?? "—"}</span>
              </td>
              <td className="px-4 py-2.5">
                <AmpelBadge ampel={t.ampel} score={t.safetyScore} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <WatchButton address={t.address} watchlisted={t.watchlisted} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-xs text-muted border-t border-line flex justify-between">
        <span>{tokens.length} Tokens</span>
        {updatedAt && <span>Aktualisiert: {updatedAt.toLocaleTimeString("de-DE")}</span>}
      </div>
    </div>
  );
}
