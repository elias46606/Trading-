import { TokenTable } from "@/components/TokenTable";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted mt-1">
          Beobachtete Tokens. Der Dispatcher überwacht sie auf Liquiditäts-Drops (Rug-Frühwarnung)
          und Volumen-Spikes — Treffer landen unter Alerts bzw. in Telegram.
        </p>
      </div>
      <TokenTable endpoint="/api/watchlist" />
    </div>
  );
}
