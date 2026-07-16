import { FilterBar } from "@/components/FilterBar";
import { StatusRibbon } from "@/components/StatusRibbon";
import { TokenTable } from "@/components/TokenTable";
import { parseFilterFromParams } from "@/lib/screening";
import { DEFAULT_FILTER } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = { ...DEFAULT_FILTER, ...parseFilterFromParams(params) };

  const query = new URLSearchParams({
    minLiquidityUsd: String(filter.minLiquidityUsd),
    minVolMcapRatio: String(filter.minVolMcapRatio),
    maxPoolAgeHours: String(filter.maxPoolAgeHours),
    minBuys24h: String(filter.minBuys24h),
    requireGreen: String(filter.requireGreen),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Discovery & Screening</h1>
          <p className="text-sm text-muted mt-1">
            Neue und aktive Solana-Tokens, die deine Filter erfüllen — sortiert nach 24h-Volumen.
          </p>
        </div>
        <StatusRibbon />
      </div>
      <FilterBar initial={filter} />
      <TokenTable key={query.toString()} endpoint={`/api/tokens?${query.toString()}`} />
    </div>
  );
}
