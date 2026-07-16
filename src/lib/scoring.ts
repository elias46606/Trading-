import type { Ampel, SafetyFlag } from "./types";

// Risk-/Safety-Scoring (Konzept 4.3).
//
// Score 0–100: Start bei 100, jeder Befund zieht Punkte ab.
// Ampel: GREEN >= 70, YELLOW >= 40, sonst RED.
// Bestimmte harte Befunde (Honeypot-Signatur, quasi keine Liquidität)
// erzwingen RED unabhängig vom Score.
//
// WICHTIG: Ein grüner Score ist KEINE Garantie — er bedeutet nur
// "kein sofortiges Rug-Signal aus den verfügbaren Daten erkennbar".

export interface ScoringInput {
  liquidityUsd: number | null;
  volume24h: number | null;
  mcap: number | null;
  buys24h: number | null;
  sells24h: number | null;
  priceChange24h: number | null;
  poolAgeHours: number | null;
}

export interface RugcheckInput {
  /** RugCheck score_normalised: 0–100, HÖHER = RISKANTER */
  scoreNormalised: number | null;
  risks: { name: string; level: string; description?: string }[];
}

export interface ScoringResult {
  score: number;
  ampel: Ampel;
  flags: SafetyFlag[];
}

export function scoreFromDexData(input: ScoringInput): ScoringResult {
  const flags: SafetyFlag[] = [];
  let deduction = 0;
  let forceRed = false;

  const liq = input.liquidityUsd ?? 0;
  if (liq < 1_000) {
    flags.push({
      code: "LIQ_CRITICAL",
      level: "danger",
      message: `Liquidität nur $${Math.round(liq).toLocaleString("de-DE")} — Exit praktisch unmöglich`,
    });
    forceRed = true;
    deduction += 50;
  } else if (liq < 20_000) {
    flags.push({
      code: "LIQ_LOW",
      level: "warn",
      message: `Liquidität unter $20.000 ($${Math.round(liq).toLocaleString("de-DE")}) — hohe Slippage wahrscheinlich`,
    });
    deduction += 20;
  }

  // Honeypot-Signatur: es wird gekauft, aber (fast) nie verkauft.
  const buys = input.buys24h ?? 0;
  const sells = input.sells24h ?? 0;
  if (buys >= 20 && sells === 0) {
    flags.push({
      code: "HONEYPOT_PATTERN",
      level: "danger",
      message: `${buys} Käufe aber 0 Verkäufe in 24h — typische Honeypot-Signatur`,
    });
    forceRed = true;
    deduction += 60;
  } else if (buys >= 50 && sells > 0 && sells < buys * 0.05) {
    flags.push({
      code: "SELL_RESTRICTED",
      level: "warn",
      message: `Nur ${sells} Verkäufe bei ${buys} Käufen — mögliche Verkaufsbeschränkung`,
    });
    deduction += 25;
  }

  // Fake-Volume-Heuristik: viel Volumen, aber kaum Trades.
  const vol = input.volume24h ?? 0;
  const txns = buys + sells;
  if (vol > 50_000 && txns > 0 && vol / txns > 5_000) {
    flags.push({
      code: "VOLUME_TXN_MISMATCH",
      level: "warn",
      message: `Ø $${Math.round(vol / txns).toLocaleString("de-DE")} pro Trade bei $${Math.round(vol).toLocaleString("de-DE")} Volumen — Wash-Trading möglich`,
    });
    deduction += 20;
  }

  // MCap steht in keinem Verhältnis zur Liquidität → ein Dump killt alles.
  const mcap = input.mcap ?? 0;
  if (mcap > 0 && liq > 0 && mcap / liq > 100) {
    flags.push({
      code: "MCAP_LIQ_RATIO",
      level: "warn",
      message: `Market Cap ist das ${Math.round(mcap / liq)}-fache der Liquidität — extrem dünner Markt`,
    });
    deduction += 15;
  }

  // Kurssturz > 80 % in 24h: Rug evtl. schon passiert.
  if ((input.priceChange24h ?? 0) <= -80) {
    flags.push({
      code: "CRASHED_24H",
      level: "danger",
      message: `Kurs in 24h um ${Math.abs(input.priceChange24h!).toFixed(0)} % eingebrochen — möglicher abgeschlossener Rug`,
    });
    deduction += 40;
  }

  // Ganz frischer Pool: per se riskanter (Konzept 4.2).
  if (input.poolAgeHours !== null && input.poolAgeHours < 1) {
    flags.push({
      code: "POOL_VERY_NEW",
      level: "info",
      message: "Pool ist jünger als 1 Stunde — erhöhtes Rug-Risiko, wenig Datenbasis",
    });
    deduction += 10;
  }

  // Totes Handelsinteresse.
  if (mcap > 0 && vol / mcap < 0.02) {
    flags.push({
      code: "DEAD_VOLUME",
      level: "info",
      message: "24h-Volumen unter 2 % des Market Cap — kaum echtes Handelsinteresse",
    });
    deduction += 10;
  }

  const score = Math.max(0, Math.min(100, 100 - deduction));
  return { score, ampel: toAmpel(score, forceRed), flags };
}

// RugCheck-Befunde in den Heuristik-Score einarbeiten (Phase 2).
export function mergeRugcheck(base: ScoringResult, rc: RugcheckInput): ScoringResult {
  const flags = [...base.flags];
  let deduction = 100 - base.score;
  let forceRed = base.ampel === "RED";

  for (const risk of rc.risks) {
    const level: SafetyFlag["level"] = risk.level === "danger" ? "danger" : risk.level === "warn" ? "warn" : "info";
    flags.push({
      code: `RUGCHECK_${risk.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
      level,
      message: `RugCheck: ${risk.name}${risk.description ? ` — ${risk.description}` : ""}`,
    });
    if (level === "danger") {
      deduction += 30;
      forceRed = true;
    } else if (level === "warn") {
      deduction += 10;
    }
  }

  // score_normalised: 0 = unauffällig, 100 = maximales Risiko.
  if (rc.scoreNormalised !== null) {
    if (rc.scoreNormalised >= 60) {
      deduction += 30;
      forceRed = true;
    } else if (rc.scoreNormalised >= 30) {
      deduction += 15;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - deduction));
  return { score, ampel: toAmpel(score, forceRed), flags };
}

function toAmpel(score: number, forceRed: boolean): Ampel {
  if (forceRed) return "RED";
  if (score >= 70) return "GREEN";
  if (score >= 40) return "YELLOW";
  return "RED";
}

/** Contract-Flags (Mint-/Freeze-Authority) aus RugCheck-Risiken extrahieren. */
export function extractContractFlags(risks: { name: string }[]): string[] {
  const flags: string[] = [];
  for (const r of risks) {
    const n = r.name.toLowerCase();
    if (n.includes("mint authority")) flags.push("MINT_AUTHORITY");
    if (n.includes("freeze authority")) flags.push("FREEZE_AUTHORITY");
    if (n.includes("mutable metadata")) flags.push("MUTABLE_METADATA");
    if (n.includes("transfer fee")) flags.push("TRANSFER_FEE");
  }
  return [...new Set(flags)];
}
