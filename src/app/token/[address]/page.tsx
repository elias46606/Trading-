import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTokenMetrics } from "@/lib/screening";
import { fmtAge, fmtDateTime, fmtPct, fmtRatioAsPct, fmtUsd } from "@/lib/format";
import { AmpelBadge } from "@/components/AmpelBadge";
import { WatchButton } from "@/components/WatchButton";
import { CopilotPanel } from "@/components/CopilotPanel";

export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<string, string> = {
  danger: "text-ampel-red",
  warn: "text-ampel-yellow",
  info: "text-muted",
};

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const metrics = await getTokenMetrics(address);
  if (!metrics) notFound();

  const token = await prisma.token.findUnique({ where: { address } });
  const alerts = token
    ? await prisma.alertSent.findMany({
        where: { tokenId: token.id },
        orderBy: { sentAt: "desc" },
        take: 10,
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{metrics.symbol}</h1>
        {metrics.name && <span className="text-muted">{metrics.name}</span>}
        <AmpelBadge ampel={metrics.ampel} score={metrics.safetyScore} />
        <WatchButton address={metrics.address} watchlisted={metrics.watchlisted} />
        <div className="ml-auto flex items-center gap-3 text-sm">
          {metrics.dexUrl && (
            <a
              href={metrics.dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              DexScreener ↗
            </a>
          )}
          <a
            href={`https://rugcheck.xyz/tokens/${metrics.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            RugCheck ↗
          </a>
        </div>
      </div>
      <p className="text-xs text-muted font-mono break-all -mt-4">{metrics.address}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric label="Preis" value={fmtUsd(metrics.priceUsd)} />
        <Metric label="Liquidität" value={fmtUsd(metrics.liquidityUsd)} />
        <Metric label="24h-Volumen" value={fmtUsd(metrics.volume24h)} />
        <Metric label="Market Cap" value={fmtUsd(metrics.mcap)} />
        <Metric label="Vol/MCap" value={fmtRatioAsPct(metrics.volMcapRatio)} />
        <Metric label="Pool-Alter" value={fmtAge(metrics.poolAgeHours)} />
        <Metric label="24h-Änderung" value={fmtPct(metrics.priceChange24h)} />
        <Metric label="1h-Änderung" value={fmtPct(metrics.priceChange1h)} />
        <Metric
          label="Käufe / Verkäufe 24h"
          value={`${metrics.buys24h ?? "—"} / ${metrics.sells24h ?? "—"}`}
        />
        <Metric
          label="RugCheck-Risiko"
          value={metrics.rugcheckScore !== null ? `${Math.round(metrics.rugcheckScore)}/100` : "—"}
        />
      </div>

      {metrics.pairAddress && (
        <section className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-baseline justify-between">
            <h2 className="font-semibold">Chart & Trade-Verlauf</h2>
            <span className="text-xs text-muted">Live von DexScreener</span>
          </div>
          <iframe
            src={`https://dexscreener.com/solana/${metrics.pairAddress}?embed=1&theme=dark&info=0`}
            className="w-full h-[640px] border-0"
            loading="lazy"
            title={`Chart und Trades für ${metrics.symbol}`}
          />
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-semibold mb-3">
          Risk-Befunde{" "}
          <span className="text-xs text-muted font-normal">
            (grün = kein sofortiges Rug-Signal erkennbar — keine Garantie)
          </span>
        </h2>
        {metrics.safetyFlags.length === 0 ? (
          <p className="text-sm text-muted">
            Keine Auffälligkeiten aus den verfügbaren Daten. Das ist keine Sicherheitsgarantie.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {metrics.safetyFlags.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className={LEVEL_STYLE[f.level] ?? "text-muted"}>
                  {f.level === "danger" ? "⛔" : f.level === "warn" ? "⚠️" : "ℹ️"}
                </span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        )}
        {metrics.contractFlags.length > 0 && (
          <p className="text-xs text-muted mt-3">
            Contract-Flags: {metrics.contractFlags.join(", ")}
          </p>
        )}
      </section>

      <CopilotPanel address={metrics.address} configured={Boolean(process.env.ANTHROPIC_API_KEY)} />

      {alerts.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="font-semibold mb-3">Letzte Alerts zu diesem Token</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="text-xs text-muted whitespace-nowrap">{fmtDateTime(a.sentAt)}</span>
                <span>{a.kind}</span>
                <span className="text-xs text-muted ml-auto">
                  {a.deliveredTelegram ? "→ Telegram ✓" : "nur in-App"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
        ← Zurück zum Screener
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-base font-medium mt-0.5">{value}</div>
    </div>
  );
}
