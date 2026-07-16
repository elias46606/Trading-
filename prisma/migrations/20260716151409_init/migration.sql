-- CreateTable
CREATE TABLE "tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'solana',
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "contractFlags" TEXT NOT NULL DEFAULT '[]',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "pairs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pairAddress" TEXT NOT NULL,
    "dexId" TEXT,
    "url" TEXT,
    "tokenId" INTEGER NOT NULL,
    "priceUsd" REAL,
    "liquidityUsd" REAL,
    "volume24h" REAL,
    "volume1h" REAL,
    "mcap" REAL,
    "fdv" REAL,
    "priceChange5m" REAL,
    "priceChange1h" REAL,
    "priceChange24h" REAL,
    "buys24h" INTEGER,
    "sells24h" INTEGER,
    "buys1h" INTEGER,
    "sells1h" INTEGER,
    "pairCreatedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pairs_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pair_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pairId" INTEGER NOT NULL,
    "priceUsd" REAL,
    "liquidityUsd" REAL,
    "volume24h" REAL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pair_snapshots_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "pairs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "safety_scores" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "ampel" TEXT NOT NULL,
    "flags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'heuristic',
    "rugcheckScore" REAL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "safety_scores_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "filterJson" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 360,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "alerts_sent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ruleId" INTEGER,
    "tokenId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deliveredTelegram" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_sent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "alerts_sent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "watchlist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "tokenId" INTEGER NOT NULL,
    "note" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watchlist_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_address_key" ON "tokens"("address");

-- CreateIndex
CREATE UNIQUE INDEX "pairs_pairAddress_key" ON "pairs"("pairAddress");

-- CreateIndex
CREATE INDEX "pairs_liquidityUsd_idx" ON "pairs"("liquidityUsd");

-- CreateIndex
CREATE INDEX "pairs_updatedAt_idx" ON "pairs"("updatedAt");

-- CreateIndex
CREATE INDEX "pair_snapshots_pairId_takenAt_idx" ON "pair_snapshots"("pairId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "safety_scores_tokenId_key" ON "safety_scores"("tokenId");

-- CreateIndex
CREATE INDEX "alerts_sent_tokenId_kind_sentAt_idx" ON "alerts_sent"("tokenId", "kind", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_tokenId_key" ON "watchlist"("tokenId");
