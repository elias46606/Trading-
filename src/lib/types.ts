// Gemeinsame Typen für Worker, API-Routen und Frontend.

export type Ampel = "GREEN" | "YELLOW" | "RED";

export type FlagLevel = "danger" | "warn" | "info";

export interface SafetyFlag {
  code: string;
  level: FlagLevel;
  message: string;
}

// Screening-Filter — Defaults aus dem Konzept (Abschnitt 4.2).
export interface ScreenerFilter {
  minLiquidityUsd: number;
  /** 24h-Volumen geteilt durch Market Cap, z.B. 0.3 = 30 % */
  minVolMcapRatio: number;
  /** 0 = kein Limit */
  maxPoolAgeHours: number;
  /** Proxy für "Min. Unique Buyers": DexScreener liefert Käufe, keine Unique Wallets */
  minBuys24h: number;
  requireGreen: boolean;
  /** Nur Coins, die in Consumer-Apps wie Fomo direkt handelbar sind */
  fomoOnly: boolean;
  /** Scam-Filter: Coins mit roter Safety-Ampel ausblenden */
  hideRed: boolean;
}

export const DEFAULT_FILTER: ScreenerFilter = {
  minLiquidityUsd: 20_000,
  minVolMcapRatio: 0.3,
  maxPoolAgeHours: 0,
  minBuys24h: 0,
  requireGreen: false,
  fomoOnly: true,
  hideRed: true,
};

// Metriken eines Tokens, wie sie Scoring, Dispatcher und KI-Copilot nutzen.
export interface TokenMetrics {
  address: string;
  symbol: string;
  name: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  mcap: number | null;
  volMcapRatio: number | null;
  poolAgeHours: number | null;
  buys24h: number | null;
  sells24h: number | null;
  buys1h: number | null;
  dexId: string | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
  contractFlags: string[];
  safetyScore: number | null;
  ampel: Ampel | null;
  safetyFlags: SafetyFlag[];
  rugcheckScore: number | null;
  dexUrl: string | null;
  pairAddress: string | null;
  watchlisted: boolean;
  firstSeenAt: string | null;
}
