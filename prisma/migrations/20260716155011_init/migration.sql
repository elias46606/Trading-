-- CreateTable
CREATE TABLE "tokens" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'solana',
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "contractFlags" TEXT NOT NULL DEFAULT '[]',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairs" (
    "id" SERIAL NOT NULL,
    "pairAddress" TEXT NOT NULL,
    "dexId" TEXT,
    "url" TEXT,
    "tokenId" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "liquidityUsd" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "volume1h" DOUBLE PRECISION,
    "mcap" DOUBLE PRECISION,
    "fdv" DOUBLE PRECISION,
    "priceChange5m" DOUBLE PRECISION,
    "priceChange1h" DOUBLE PRECISION,
    "priceChange24h" DOUBLE PRECISION,
    "buys24h" INTEGER,
    "sells24h" INTEGER,
    "buys1h" INTEGER,
    "sells1h" INTEGER,
    "pairCreatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair_snapshots" (
    "id" SERIAL NOT NULL,
    "pairId" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION,
    "liquidityUsd" DOUBLE PRECISION,
    "volume24h" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pair_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_scores" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "ampel" TEXT NOT NULL,
    "flags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'heuristic',
    "rugcheckScore" DOUBLE PRECISION,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "filterJson" TEXT NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 360,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts_sent" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER,
    "tokenId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deliveredTelegram" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_sent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "tokenId" INTEGER NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_snapshots" ADD CONSTRAINT "pair_snapshots_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "pairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_scores" ADD CONSTRAINT "safety_scores_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts_sent" ADD CONSTRAINT "alerts_sent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts_sent" ADD CONSTRAINT "alerts_sent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
