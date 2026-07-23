import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { StatusRibbon } from "@/components/StatusRibbon";
import { TokenTable } from "@/components/TokenTable";
import { parseFilterFromParams } from "@/lib/screening";
import { DEFAULT_FILTER } from "@/lib/types";

export const dynamic = "force-dynamic";

// Startansicht: "Neueste" — frisch gelistete Coins, neueste zuerst.
// "Screener" ist die gefilterte Ansicht nach 24h-Volumen.
export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "screener" ? "screener" : "new";
  const showAll = params.fomoOnly === "false";

  const filter = { ...DEFAULT_FILTER, ...parseFilterFromParams(params) };
  const query = new URLSearchParams(
    view === "new"
      ? { view: "new", fomoOnly: String(!showAll), hideRed: String(!showAll) }
      : {
          minLiquidityUsd: String(filter.minLiquidityUsd),
          minVolMcapRatio: String(filter.minVolMcapRatio),
          maxPoolAgeHours: String(filter.maxPoolAgeHours),
          minBuys24h: String(filter.minBuys24h),
          requireGreen: String(filter.requireGreen),
          fomoOnly: String(filter.fomoOnly),
          hideRed: String(filter.hideRed),
        },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {view === "new" ? "Neueste Coins" : "Screener"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {view === "new" ? (
              <>
                Frisch gelistete Coins der letzten 24h, handelbar in <b>Fomo</b> —
                Scam-Verdacht (rote Ampel) automatisch rausgefiltert.{" "}
                <Link
                  href={showAll ? "/" : "/?fomoOnly=false"}
                  className="text-accent hover:underline"
                >
                  {showAll ? "wieder filtern" : "alle zeigen (ungefiltert)"}
                </Link>
              </>
            ) : (
              "Aktive Solana-Tokens, die deine Filter erfüllen — ohne rote Ampel, sortiert nach 24h-Volumen."
            )}
          </p>
        </div>
        <StatusRibbon />
      </div>

      <div className="flex gap-1 border-b border-line">
        <Tab href="/" active={view === "new"}>
          🆕 Neueste
        </Tab>
        <Tab href="/?view=screener" active={view === "screener"}>
          🔥 Screener
        </Tab>
      </div>

      {view === "screener" && <FilterBar initial={filter} />}
      <TokenTable key={query.toString()} endpoint={`/api/tokens?${query.toString()}`} />
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
        active
          ? "bg-surface border-line text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
