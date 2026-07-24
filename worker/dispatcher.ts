// Alert-Dispatcher (Konzept 2, Prozess 2 + Konzept 4.4):
// prüft neue Daten gegen die User-Regeln, verschickt Treffer per
// Telegram, dedupliziert pro Token+Regel innerhalb des Cooldowns.

import { prisma } from "../src/lib/db";
import { screenTokens, parseFilterFromParams, toMetrics, isFomoTradeable } from "../src/lib/screening";
import type { ScreenerFilter, TokenMetrics } from "../src/lib/types";
import { DEFAULT_FILTER } from "../src/lib/types";
import { sendTelegram, telegramConfigured } from "./telegram";

// Rug-Frühwarnung (Konzept 4.4 v2 / Phase 3)
const LIQUIDITY_DROP_PCT = 30; // Alert ab -30 % Liquidität …
const LIQUIDITY_DROP_LOOKBACK_MIN = 30; // … innerhalb der letzten 30 Minuten
const LIQUIDITY_DROP_COOLDOWN_MIN = 120;
const VOLUME_SPIKE_FACTOR = 2; // Alert ab Verdopplung des 24h-Volumens …
const VOLUME_SPIKE_LOOKBACK_MIN = 60; // … gegenüber vor ~1 Stunde
const VOLUME_SPIKE_MIN_INCREASE_USD = 10_000;
const VOLUME_SPIKE_COOLDOWN_MIN = 360;

// "Neuer Coin"-Push (Konzept 4.4 Kernstück):
// Fenster, in dem ein frisch entdeckter Coin als "neu" gilt. Dedup über
// alerts_sent (kind=NEW_COIN) sorgt dafür, dass jeder Coin nur 1× kommt —
// das Fenster puffert nur Cron-Verzögerungen ab.
const NEW_COIN_WINDOW_MIN = 30;
// Obergrenze pro Zyklus, damit ein Discovery-Schwung nicht 50 Nachrichten
// auf einmal aufs Handy feuert.
const NEW_COIN_MAX_PER_CYCLE = 12;

export async function runDispatchCycle(): Promise<void> {
  const sentNew = await dispatchNewCoinAlerts();
  const sentRules = await dispatchRuleAlerts();
  const sentWatch = await dispatchWatchlistAlerts();
  if (sentNew + sentRules + sentWatch > 0) {
    console.log(
      `[dispatcher] ${sentNew} Neuer-Coin-Alerts, ${sentRules} Regel-Alerts, ${sentWatch} Watchlist-Alerts verschickt`,
    );
  }
}

// Push für jeden frisch aufgetauchten, handelbaren Coin ohne Scam-Signal.
// Automatisch aktiv, sobald Telegram konfiguriert ist — respektiert den
// Scam-Filter (keine roten Ampeln), damit die Mitteilung Wert hat.
async function dispatchNewCoinAlerts(): Promise<number> {
  if (!telegramConfigured()) return 0; // ohne Zustellweg gäbe es nur DB-Spam

  const since = new Date(Date.now() - NEW_COIN_WINDOW_MIN * 60_000);
  const tokens = await prisma.token.findMany({
    where: {
      firstSeenAt: { gte: since },
      // Noch keine Neuer-Coin-Mitteilung für diesen Token verschickt.
      alertsSent: { none: { kind: "NEW_COIN" } },
    },
    include: {
      pairs: { orderBy: { liquidityUsd: "desc" }, take: 1 },
      safetyScore: true,
      watchlist: true,
    },
    orderBy: { firstSeenAt: "desc" },
    take: 60,
  });

  let sent = 0;
  for (const token of tokens) {
    if (sent >= NEW_COIN_MAX_PER_CYCLE) break;
    const m = toMetrics(token);
    // Scam-Schutz: keine roten Ampeln, nur in Fomo handelbare Coins.
    if (m.ampel === "RED") continue;
    if (!isFomoTradeable(m)) continue;

    const message = formatNewCoinAlert(m);
    const delivered = await sendTelegram(message);
    await prisma.alertSent.create({
      data: { tokenId: token.id, kind: "NEW_COIN", message, deliveredTelegram: delivered },
    });
    sent++;
  }
  return sent;
}

function formatNewCoinAlert(m: TokenMetrics): string {
  const ampelIcon = m.ampel === "GREEN" ? "🟢" : m.ampel === "YELLOW" ? "🟡" : "⚪";
  const lines = [
    `🚀 <b>Neuer Coin: ${escapeHtml(m.symbol)}</b>${m.name ? ` — ${escapeHtml(m.name)}` : ""}`,
    `${ampelIcon} Safety: ${m.safetyScore ?? "—"}/100 · ` +
      `Alter: ${m.poolAgeHours !== null ? m.poolAgeHours < 1 ? Math.round(m.poolAgeHours * 60) + " Min." : m.poolAgeHours.toFixed(1) + "h" : "—"} · ` +
      `Liq: $${fmt(m.liquidityUsd)}`,
    `<code>${m.address}</code> (in Fomo einfügen)`,
  ];
  if (m.dexUrl) lines.push(m.dexUrl);
  lines.push("⚠️ Sehr früh = sehr riskant. Kein Prognose-Tool, keine Anlageberatung.");
  return lines.join("\n");
}

// „Neuer Token erfüllt alle Screening-Filter UND Safety-Ampel = grün → Alert."
async function dispatchRuleAlerts(): Promise<number> {
  const rules = await prisma.alertRule.findMany({ where: { active: true } });
  let sent = 0;

  for (const rule of rules) {
    let filter: Partial<ScreenerFilter>;
    try {
      filter = parseFilterFromParams(JSON.parse(rule.filterJson));
    } catch {
      console.warn(`[dispatcher] Regel ${rule.id} hat ungültiges filterJson — übersprungen`);
      continue;
    }

    const matches = await screenTokens(filter, 50);
    for (const m of matches) {
      const token = await prisma.token.findUnique({ where: { address: m.address } });
      if (!token) continue;

      // Dedup: Token+Regel nur 1× pro Cooldown-Fenster.
      const recent = await prisma.alertSent.findFirst({
        where: {
          ruleId: rule.id,
          tokenId: token.id,
          sentAt: { gte: new Date(Date.now() - rule.cooldownMinutes * 60_000) },
        },
      });
      if (recent) continue;

      const message = formatScreenerAlert(rule.name, m);
      const delivered = await sendTelegram(message);
      await prisma.alertSent.create({
        data: {
          ruleId: rule.id,
          tokenId: token.id,
          kind: "SCREENER_MATCH",
          message,
          deliveredTelegram: delivered,
        },
      });
      sent++;
    }
  }
  return sent;
}

// Watchlist-Frühwarnung: Liquiditäts-Drop (Rug im Gange!) + Volumen-Spike.
async function dispatchWatchlistAlerts(): Promise<number> {
  const entries = await prisma.watchlistEntry.findMany({
    include: {
      token: {
        include: { pairs: { orderBy: { liquidityUsd: "desc" }, take: 1 } },
      },
    },
  });
  let sent = 0;

  for (const entry of entries) {
    const pair = entry.token.pairs[0];
    if (!pair) continue;

    // Liquiditäts-Drop: aktuelle Liquidität vs. ältester Snapshot im Lookback.
    const liqBaseline = await prisma.pairSnapshot.findFirst({
      where: {
        pairId: pair.id,
        takenAt: { gte: new Date(Date.now() - LIQUIDITY_DROP_LOOKBACK_MIN * 60_000) },
        liquidityUsd: { not: null },
      },
      orderBy: { takenAt: "asc" },
    });
    const nowLiq = pair.liquidityUsd ?? 0;
    const baseLiq = liqBaseline?.liquidityUsd ?? 0;
    if (baseLiq > 1_000 && nowLiq < baseLiq * (1 - LIQUIDITY_DROP_PCT / 100)) {
      const dropPct = ((baseLiq - nowLiq) / baseLiq) * 100;
      if (await notRecentlyAlerted(entry.tokenId, "LIQUIDITY_DROP", LIQUIDITY_DROP_COOLDOWN_MIN)) {
        const message =
          `🚨 <b>RUG-WARNUNG: Liquiditäts-Drop</b>\n` +
          `${escapeHtml(entry.token.symbol)} — Liquidität in ${LIQUIDITY_DROP_LOOKBACK_MIN} Min. ` +
          `um ${dropPct.toFixed(0)} % gefallen\n` +
          `$${fmt(baseLiq)} → $${fmt(nowLiq)}\n` +
          (pair.url ? pair.url : "");
        const delivered = await sendTelegram(message);
        await prisma.alertSent.create({
          data: { tokenId: entry.tokenId, kind: "LIQUIDITY_DROP", message, deliveredTelegram: delivered },
        });
        sent++;
      }
    }

    // Volumen-Spike: 24h-Volumen deutlich über dem Stand von vor ~1h.
    const volBaseline = await prisma.pairSnapshot.findFirst({
      where: {
        pairId: pair.id,
        takenAt: { lte: new Date(Date.now() - VOLUME_SPIKE_LOOKBACK_MIN * 60_000) },
        volume24h: { not: null },
      },
      orderBy: { takenAt: "desc" },
    });
    const nowVol = pair.volume24h ?? 0;
    const baseVol = volBaseline?.volume24h ?? 0;
    if (
      baseVol > 0 &&
      nowVol >= baseVol * VOLUME_SPIKE_FACTOR &&
      nowVol - baseVol >= VOLUME_SPIKE_MIN_INCREASE_USD
    ) {
      if (await notRecentlyAlerted(entry.tokenId, "VOLUME_SPIKE", VOLUME_SPIKE_COOLDOWN_MIN)) {
        const message =
          `📈 <b>Volumen-Spike</b>\n` +
          `${escapeHtml(entry.token.symbol)} — 24h-Volumen von $${fmt(baseVol)} auf $${fmt(nowVol)} ` +
          `(${(nowVol / baseVol).toFixed(1)}×) innerhalb ~${VOLUME_SPIKE_LOOKBACK_MIN} Min.\n` +
          (pair.url ? pair.url : "");
        const delivered = await sendTelegram(message);
        await prisma.alertSent.create({
          data: { tokenId: entry.tokenId, kind: "VOLUME_SPIKE", message, deliveredTelegram: delivered },
        });
        sent++;
      }
    }
  }
  return sent;
}

async function notRecentlyAlerted(tokenId: number, kind: string, cooldownMin: number): Promise<boolean> {
  const recent = await prisma.alertSent.findFirst({
    where: { tokenId, kind, sentAt: { gte: new Date(Date.now() - cooldownMin * 60_000) } },
  });
  return recent === null;
}

function formatScreenerAlert(ruleName: string, m: TokenMetrics): string {
  const ampelIcon = m.ampel === "GREEN" ? "🟢" : m.ampel === "YELLOW" ? "🟡" : "🔴";
  const lines = [
    `${ampelIcon} <b>Screener-Treffer: ${escapeHtml(ruleName)}</b>`,
    `<b>${escapeHtml(m.symbol)}</b>${m.name ? ` (${escapeHtml(m.name)})` : ""}`,
    `Liquidität: $${fmt(m.liquidityUsd)} · 24h-Vol: $${fmt(m.volume24h)} · MCap: $${fmt(m.mcap)}`,
    `Vol/MCap: ${m.volMcapRatio !== null ? (m.volMcapRatio * 100).toFixed(0) + " %" : "—"} · ` +
      `Pool-Alter: ${m.poolAgeHours !== null ? m.poolAgeHours.toFixed(1) + "h" : "—"} · ` +
      `Safety: ${m.safetyScore ?? "—"}/100`,
    `<code>${m.address}</code>`,
  ];
  if (m.dexUrl) lines.push(m.dexUrl);
  lines.push("⚠️ Kein Prediktor. Grün = kein sofortiges Rug-Signal erkennbar, keine Garantie.");
  return lines.join("\n");
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return Math.round(n).toLocaleString("de-DE");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
