import { prisma } from "./db";
import type { Ampel, SafetyFlag, ScreenerFilter, TokenMetrics } from "./types";
import { DEFAULT_FILTER } from "./types";

// Screening-Logik (Konzept 4.2) — wird von der Web-App (API-Route)
// UND vom Alert-Dispatcher benutzt, damit beide identisch filtern.

type TokenWithRelations = Awaited<ReturnType<typeof queryTokens>>[number];

async function queryTokens(where: object, take: number) {
  return prisma.token.findMany({
    where,
    include: {
      pairs: { orderBy: { liquidityUsd: "desc" }, take: 1 },
      safetyScore: true,
      watchlist: true,
    },
    take,
  });
}

export function toMetrics(t: TokenWithRelations): TokenMetrics {
  const pair = t.pairs[0];
  const liq = pair?.liquidityUsd ?? null;
  const vol = pair?.volume24h ?? null;
  const mcap = pair?.mcap ?? null;
  const volMcapRatio = vol !== null && mcap !== null && mcap > 0 ? vol / mcap : null;
  const poolAgeHours = pair?.pairCreatedAt
    ? (Date.now() - pair.pairCreatedAt.getTime()) / 3_600_000
    : null;

  return {
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    priceUsd: pair?.priceUsd ?? null,
    liquidityUsd: liq,
    volume24h: vol,
    mcap,
    volMcapRatio,
    poolAgeHours,
    buys24h: pair?.buys24h ?? null,
    sells24h: pair?.sells24h ?? null,
    priceChange1h: pair?.priceChange1h ?? null,
    priceChange24h: pair?.priceChange24h ?? null,
    contractFlags: parseJsonArray(t.contractFlags),
    safetyScore: t.safetyScore?.score ?? null,
    ampel: (t.safetyScore?.ampel as Ampel | undefined) ?? null,
    safetyFlags: parseFlags(t.safetyScore?.flags),
    rugcheckScore: t.safetyScore?.rugcheckScore ?? null,
    dexUrl: pair?.url ?? null,
    watchlisted: t.watchlist !== null,
    firstSeenAt: t.firstSeenAt?.toISOString() ?? null,
  };
}

/** Metriken für einen einzelnen Token (Detailseite, Copilot-Grounding). */
export async function getTokenMetrics(address: string): Promise<TokenMetrics | null> {
  const tokens = await queryTokens({ address }, 1);
  return tokens.length > 0 ? toMetrics(tokens[0]) : null;
}

export function matchesFilter(m: TokenMetrics, f: ScreenerFilter): boolean {
  if ((m.liquidityUsd ?? 0) < f.minLiquidityUsd) return false;
  if (f.minVolMcapRatio > 0 && (m.volMcapRatio ?? 0) < f.minVolMcapRatio) return false;
  if (f.maxPoolAgeHours > 0 && (m.poolAgeHours ?? Infinity) > f.maxPoolAgeHours) return false;
  if (f.minBuys24h > 0 && (m.buys24h ?? 0) < f.minBuys24h) return false;
  if (f.requireGreen && m.ampel !== "GREEN") return false;
  return true;
}

/** Alle Tokens laden (neueste zuerst), Filter in JS anwenden. */
export async function screenTokens(filter: Partial<ScreenerFilter>, limit = 100): Promise<TokenMetrics[]> {
  const f: ScreenerFilter = { ...DEFAULT_FILTER, ...filter };
  // Grob-Vorfilter in SQL (Liquidität), Feinfilter in JS —
  // bei den Datenmengen eines Einzelnutzer-Screeners völlig ausreichend.
  const tokens = await queryTokens(
    { pairs: { some: { liquidityUsd: { gte: f.minLiquidityUsd } } } },
    500,
  );
  return tokens
    .map(toMetrics)
    .filter((m) => matchesFilter(m, f))
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, limit);
}

export function parseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parseFlags(json: string | null | undefined): SafetyFlag[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parseFilterFromParams(params: Record<string, string | undefined>): Partial<ScreenerFilter> {
  const f: Partial<ScreenerFilter> = {};
  if (params.minLiquidityUsd !== undefined) f.minLiquidityUsd = Number(params.minLiquidityUsd) || 0;
  if (params.minVolMcapRatio !== undefined) f.minVolMcapRatio = Number(params.minVolMcapRatio) || 0;
  if (params.maxPoolAgeHours !== undefined) f.maxPoolAgeHours = Number(params.maxPoolAgeHours) || 0;
  if (params.minBuys24h !== undefined) f.minBuys24h = Number(params.minBuys24h) || 0;
  if (params.requireGreen !== undefined) f.requireGreen = params.requireGreen === "true";
  return f;
}
