// Ingest-Worker (Konzept 2, Prozess 1):
// pollt DexScreener, schreibt Rohdaten + Scores in die DB.
// Die Web-App liest NUR aus der DB — nie direkt aus den APIs.

import { prisma } from "../src/lib/db";
import { scoreFromDexData, mergeRugcheck, extractContractFlags } from "../src/lib/scoring";
import {
  fetchLatestProfiles,
  fetchLatestBoosts,
  fetchTopBoosts,
  fetchPairsForTokens,
  type DexPair,
} from "./dexscreener";
import { fetchRugcheckSummary } from "./rugcheck";

const CHAIN = "solana";
// Teure RugCheck-Calls nur für Tokens, die das Basis-Screening grob bestehen.
const RUGCHECK_MIN_LIQUIDITY = 10_000;
const RUGCHECK_MAX_PER_CYCLE = 15;
const RUGCHECK_TTL_MINUTES = 30;
// Bestehende Tokens werden nur aufgefrischt, solange sie kürzlich aktiv waren.
const REFRESH_WINDOW_HOURS = 48;
const REFRESH_MAX_TOKENS = 270; // 9 Batch-Calls à 30 Adressen
const SNAPSHOT_RETENTION_HOURS = 72;

const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLE_MINTS = new Set([
  SOL_MINT,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

export async function runIngestCycle(): Promise<void> {
  const started = Date.now();

  // 1. Discovery: neue Profile + Boosts (Trending) auf Solana.
  const [profiles, boosts, topBoosts] = await Promise.all([
    fetchLatestProfiles(),
    fetchLatestBoosts(),
    fetchTopBoosts(),
  ]);
  const discovered = new Map<string, { icon?: string }>();
  for (const p of [...profiles, ...boosts, ...topBoosts]) {
    if (p.chainId === CHAIN && p.tokenAddress && !STABLE_MINTS.has(p.tokenAddress)) {
      discovered.set(p.tokenAddress, { icon: p.icon });
    }
  }

  // 2. Refresh: bekannte Tokens (Watchlist immer, sonst nur kürzlich aktive).
  const cutoff = new Date(Date.now() - REFRESH_WINDOW_HOURS * 3_600_000);
  const known = await prisma.token.findMany({
    where: {
      chain: CHAIN,
      OR: [{ watchlist: { isNot: null } }, { pairs: { some: { updatedAt: { gte: cutoff } } } }],
    },
    select: { address: true, watchlist: { select: { id: true } } },
    orderBy: { firstSeenAt: "desc" },
    take: REFRESH_MAX_TOKENS,
  });

  const addresses = [
    ...new Set([...discovered.keys(), ...known.map((t) => t.address)]),
  ];
  if (addresses.length === 0) {
    console.log("[ingest] keine Kandidaten in diesem Zyklus");
    return;
  }

  // 3. Pair-Daten holen (gebatcht, rate-limitiert).
  const pairs = await fetchPairsForTokens(CHAIN, addresses);
  const wanted = new Set(addresses);
  const byToken = new Map<string, DexPair[]>();
  for (const pair of pairs) {
    if (pair.chainId !== CHAIN) continue;
    const addr = pair.baseToken?.address;
    if (!addr || !wanted.has(addr) || STABLE_MINTS.has(addr)) continue;
    const list = byToken.get(addr) ?? [];
    list.push(pair);
    byToken.set(addr, list);
  }

  // 4. Upsert Tokens + Pairs + Snapshots, danach Scoring.
  let updated = 0;
  for (const [address, tokenPairs] of byToken) {
    try {
      await upsertToken(address, tokenPairs, discovered.get(address)?.icon);
      updated++;
    } catch (err) {
      console.warn(`[ingest] Upsert fehlgeschlagen für ${address}:`, err);
    }
  }

  // 5. RugCheck-Anreicherung für die aussichtsreichsten Tokens.
  const enriched = await enrichWithRugcheck();

  // 6. Alte Snapshots aufräumen.
  const pruned = await prisma.pairSnapshot.deleteMany({
    where: { takenAt: { lt: new Date(Date.now() - SNAPSHOT_RETENTION_HOURS * 3_600_000) } },
  });

  console.log(
    `[ingest] ${updated} Tokens aktualisiert (${discovered.size} discovered, ${known.length} refresh), ` +
      `${enriched} RugCheck-Checks, ${pruned.count} alte Snapshots entfernt, ${Date.now() - started}ms`,
  );
}

async function upsertToken(address: string, tokenPairs: DexPair[], icon?: string): Promise<void> {
  const best = [...tokenPairs].sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];

  const token = await prisma.token.upsert({
    where: { address },
    create: {
      address,
      chain: CHAIN,
      symbol: best.baseToken.symbol ?? "?",
      name: best.baseToken.name ?? null,
      imageUrl: icon ?? best.info?.imageUrl ?? null,
    },
    update: {
      symbol: best.baseToken.symbol ?? "?",
      name: best.baseToken.name ?? null,
      ...(icon || best.info?.imageUrl ? { imageUrl: icon ?? best.info?.imageUrl } : {}),
    },
  });

  for (const p of tokenPairs) {
    const data = {
      dexId: p.dexId ?? null,
      url: p.url ?? null,
      tokenId: token.id,
      priceUsd: toNum(p.priceUsd),
      liquidityUsd: p.liquidity?.usd ?? null,
      volume24h: p.volume?.h24 ?? null,
      volume1h: p.volume?.h1 ?? null,
      mcap: p.marketCap ?? null,
      fdv: p.fdv ?? null,
      priceChange5m: p.priceChange?.m5 ?? null,
      priceChange1h: p.priceChange?.h1 ?? null,
      priceChange24h: p.priceChange?.h24 ?? null,
      buys24h: p.txns?.h24?.buys ?? null,
      sells24h: p.txns?.h24?.sells ?? null,
      buys1h: p.txns?.h1?.buys ?? null,
      sells1h: p.txns?.h1?.sells ?? null,
      pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt) : null,
    };
    const pair = await prisma.pair.upsert({
      where: { pairAddress: p.pairAddress },
      create: { pairAddress: p.pairAddress, ...data },
      update: data,
    });
    await prisma.pairSnapshot.create({
      data: {
        pairId: pair.id,
        priceUsd: data.priceUsd,
        liquidityUsd: data.liquidityUsd,
        volume24h: data.volume24h,
      },
    });
  }

  // Heuristik-Score aus den frischen DexScreener-Daten.
  const result = scoreFromDexData({
    liquidityUsd: best.liquidity?.usd ?? null,
    volume24h: best.volume?.h24 ?? null,
    mcap: best.marketCap ?? null,
    buys24h: best.txns?.h24?.buys ?? null,
    sells24h: best.txns?.h24?.sells ?? null,
    priceChange24h: best.priceChange?.h24 ?? null,
    poolAgeHours: best.pairCreatedAt ? (Date.now() - best.pairCreatedAt) / 3_600_000 : null,
    dexId: best.dexId ?? null,
  });

  // Einen frischeren RugCheck-Befund nicht mit reiner Heuristik überschreiben —
  // die RugCheck-Anreicherung läuft separat und rechnet die Heuristik mit ein.
  const existing = await prisma.safetyScore.findUnique({ where: { tokenId: token.id } });
  const rugcheckFresh =
    existing?.source === "rugcheck" &&
    Date.now() - existing.checkedAt.getTime() < RUGCHECK_TTL_MINUTES * 60_000;
  if (!rugcheckFresh) {
    await prisma.safetyScore.upsert({
      where: { tokenId: token.id },
      create: {
        tokenId: token.id,
        score: result.score,
        ampel: result.ampel,
        flags: JSON.stringify(result.flags),
        source: "heuristic",
      },
      update: {
        score: result.score,
        ampel: result.ampel,
        flags: JSON.stringify(result.flags),
        source: "heuristic",
        rugcheckScore: null,
        checkedAt: new Date(),
      },
    });
  }
}

async function enrichWithRugcheck(): Promise<number> {
  const cutoff = new Date(Date.now() - RUGCHECK_TTL_MINUTES * 60_000);
  // Scam-Schutz: geprüft wird, was relevant ist — Coins mit echter
  // Liquidität UND alle frischen Coins (< 24h), auch ohne Pool.
  // Neueste zuerst, damit gerade gelaunchte Coins schnell einen
  // RugCheck-Befund bekommen.
  const freshCutoff = new Date(Date.now() - 24 * 3_600_000);
  const candidates = await prisma.token.findMany({
    where: {
      chain: CHAIN,
      OR: [
        { pairs: { some: { liquidityUsd: { gte: RUGCHECK_MIN_LIQUIDITY } } } },
        { firstSeenAt: { gte: freshCutoff } },
      ],
      AND: {
        OR: [
          { safetyScore: { is: { source: "heuristic" } } },
          { safetyScore: { is: { checkedAt: { lt: cutoff } } } },
          { safetyScore: null },
        ],
      },
    },
    include: { pairs: { orderBy: { liquidityUsd: "desc" }, take: 1 } },
    orderBy: { firstSeenAt: "desc" },
    take: RUGCHECK_MAX_PER_CYCLE,
  });

  let count = 0;
  for (const token of candidates) {
    const summary = await fetchRugcheckSummary(token.address);
    if (!summary) continue;

    const pair = token.pairs[0];
    const heuristic = scoreFromDexData({
      liquidityUsd: pair?.liquidityUsd ?? null,
      volume24h: pair?.volume24h ?? null,
      mcap: pair?.mcap ?? null,
      buys24h: pair?.buys24h ?? null,
      sells24h: pair?.sells24h ?? null,
      priceChange24h: pair?.priceChange24h ?? null,
      poolAgeHours: pair?.pairCreatedAt
        ? (Date.now() - pair.pairCreatedAt.getTime()) / 3_600_000
        : null,
      dexId: pair?.dexId ?? null,
    });
    const merged = mergeRugcheck(heuristic, {
      scoreNormalised: summary.score_normalised,
      risks: summary.risks,
    });

    await prisma.token.update({
      where: { id: token.id },
      data: { contractFlags: JSON.stringify(extractContractFlags(summary.risks)) },
    });
    await prisma.safetyScore.upsert({
      where: { tokenId: token.id },
      create: {
        tokenId: token.id,
        score: merged.score,
        ampel: merged.ampel,
        flags: JSON.stringify(merged.flags),
        source: "rugcheck",
        rugcheckScore: summary.score_normalised,
      },
      update: {
        score: merged.score,
        ampel: merged.ampel,
        flags: JSON.stringify(merged.flags),
        source: "rugcheck",
        rugcheckScore: summary.score_normalised,
        checkedAt: new Date(),
      },
    });
    count++;
  }
  return count;
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
