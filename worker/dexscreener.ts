// DexScreener-API-Client mit Rate-Limiting (Konzept 3 + 6).
//
// Limits laut DexScreener-Doku:
//   - token-profiles / token-boosts: 60 req/min
//   - tokens/pairs/search:          300 req/min
// Wir bleiben bewusst deutlich darunter.

const BASE = "https://api.dexscreener.com";

class RateLimiter {
  private timestamps: number[] = [];
  constructor(private maxPerMinute: number) {}

  async wait(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
      if (this.timestamps.length < this.maxPerMinute) {
        this.timestamps.push(now);
        return;
      }
      await sleep(1_000);
    }
  }
}

const profileLimiter = new RateLimiter(50); // Limit: 60/min
const pairsLimiter = new RateLimiter(250); // Limit: 300/min

async function getJson<T>(url: string, limiter: RateLimiter): Promise<T | null> {
  await limiter.wait();
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.warn(`[dexscreener] ${res.status} für ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[dexscreener] Fehler für ${url}:`, err);
    return null;
  }
}

export interface DexTokenProfile {
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
}

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: Record<"m5" | "h1" | "h6" | "h24", { buys: number; sells: number } | undefined>;
  volume?: Record<"m5" | "h1" | "h6" | "h24", number | undefined>;
  priceChange?: Record<"m5" | "h1" | "h6" | "h24", number | undefined>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

/** Neueste Token-Profile (frisch gelistete/beworbene Tokens). */
export async function fetchLatestProfiles(): Promise<DexTokenProfile[]> {
  const data = await getJson<DexTokenProfile[]>(`${BASE}/token-profiles/latest/v1`, profileLimiter);
  return data ?? [];
}

/** Aktuell geboostete Tokens (Trending-Signal). */
export async function fetchLatestBoosts(): Promise<DexTokenProfile[]> {
  const data = await getJson<DexTokenProfile[]>(`${BASE}/token-boosts/latest/v1`, profileLimiter);
  return data ?? [];
}

/** Am stärksten geboostete Tokens — meist mit echten AMM-Pools. */
export async function fetchTopBoosts(): Promise<DexTokenProfile[]> {
  const data = await getJson<DexTokenProfile[]>(`${BASE}/token-boosts/top/v1`, profileLimiter);
  return data ?? [];
}

/** Pair-Daten für bis zu 30 Token-Adressen in einem Call. */
export async function fetchPairsForTokens(chainId: string, addresses: string[]): Promise<DexPair[]> {
  if (addresses.length === 0) return [];
  const result: DexPair[] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    const batch = addresses.slice(i, i + 30);
    const data = await getJson<DexPair[]>(
      `${BASE}/tokens/v1/${chainId}/${batch.join(",")}`,
      pairsLimiter,
    );
    if (data) result.push(...data);
  }
  return result;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
