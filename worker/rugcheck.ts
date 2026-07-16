// RugCheck.xyz — Solana-Security-Signale (Konzept 4.3).
// Öffentliche API, kein Key nötig. Wir nutzen den Summary-Report
// und rufen ihn nur für Tokens auf, die das Basis-Screening bestehen
// (Konzept 6: teure Checks nicht für jeden Müll-Token).

const BASE = "https://api.rugcheck.xyz/v1";

export interface RugcheckRisk {
  name: string;
  value?: string;
  description?: string;
  score?: number;
  level: string; // "danger" | "warn" | "info"
}

export interface RugcheckSummary {
  score: number | null;
  score_normalised: number | null;
  risks: RugcheckRisk[];
}

let lastCall = 0;

/** Summary-Report für einen Mint. Max ~2 Calls/Sekunde, defensiv gedrosselt. */
export async function fetchRugcheckSummary(mint: string): Promise<RugcheckSummary | null> {
  const wait = lastCall + 600 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const res = await fetch(`${BASE}/tokens/${mint}/report/summary`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      if (res.status !== 404) console.warn(`[rugcheck] ${res.status} für ${mint}`);
      return null;
    }
    const data = (await res.json()) as Partial<RugcheckSummary>;
    return {
      score: data.score ?? null,
      score_normalised: data.score_normalised ?? null,
      risks: Array.isArray(data.risks) ? data.risks : [],
    };
  } catch (err) {
    console.warn(`[rugcheck] Fehler für ${mint}:`, err);
    return null;
  }
}
