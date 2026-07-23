"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TokenMetrics } from "@/lib/types";
import { fmtAge, fmtPct, fmtUsd } from "@/lib/format";
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
        Gerade keine Tokens für diese Ansicht — in ein paar Minuten wieder reinschauen.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="text-left text-xs text-muted border-b border-line">
            <th className="px-4 py-3 font-medium">Token</th>
            <th className="px-4 py-3 font-medium text-right">Alter</th>
            <th className="px-4 py-3 font-medium text-right">Preis / 24h</th>
            <th className="px-4 py-3 font-medium text-right">Liquidität</th>
            <th className="px-4 py-3 font-medium text-right">24h-Volumen</th>
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
              <td className="px-4 py-3">
                <Link href={`/token/${t.address}`} className="group block">
                  <span className="font-semibold group-hover:text-accent transition-colors">
                    {t.symbol}
                  </span>
                  {t.name && (
                    <span className="text-muted text-xs block max-w-44 truncate">{t.name}</span>
                  )}
                </Link>
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  t.poolAgeHours !== null && t.poolAgeHours < 1 ? "text-accent font-medium" : "text-muted"
                }`}
              >
                {fmtAge(t.poolAgeHours)}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-mono text-xs block">{fmtUsd(t.priceUsd)}</span>
                <span
                  className={`text-xs ${
                    (t.priceChange24h ?? 0) > 0
                      ? "text-ampel-green"
                      : (t.priceChange24h ?? 0) < 0
                        ? "text-ampel-red"
                        : "text-muted"
                  }`}
                >
                  {fmtPct(t.priceChange24h)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">{fmtUsd(t.liquidityUsd)}</td>
              <td className="px-4 py-3 text-right">{fmtUsd(t.volume24h)}</td>
              <td className="px-4 py-3">
                <AmpelBadge ampel={t.ampel} score={t.safetyScore} />
              </td>
              <td className="px-4 py-3 text-right">
                <WatchButton address={t.address} watchlisted={t.watchlisted} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 text-xs text-muted border-t border-line flex justify-between">
        <span>{tokens.length} Tokens · Tippen für Details, Chart & Trade-Verlauf</span>
        {updatedAt && <span>Stand: {updatedAt.toLocaleTimeString("de-DE")}</span>}
      </div>
    </div>
  );
}
