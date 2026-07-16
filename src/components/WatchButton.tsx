"use client";

import { useState } from "react";

export function WatchButton({
  address,
  watchlisted,
  onChange,
}: {
  address: string;
  watchlisted: boolean;
  onChange?: (watchlisted: boolean) => void;
}) {
  const [active, setActive] = useState(watchlisted);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !active;
    setActive(next); // optimistisch
    try {
      const res = await fetch("/api/watchlist", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onChange?.(next);
    } catch {
      setActive(!next); // zurückrollen
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={active ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}
      className={`text-lg leading-none transition-colors cursor-pointer disabled:opacity-50 ${
        active ? "text-ampel-yellow" : "text-muted hover:text-foreground"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
