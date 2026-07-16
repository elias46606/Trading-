"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_FILTER, type ScreenerFilter } from "@/lib/types";

// Screening-Filter (Konzept 4.2) — Defaults aus Profi-Faustregeln,
// alle Werte einstellbar. Änderungen landen in der URL (teilbar).
export function FilterBar({ initial }: { initial: ScreenerFilter }) {
  const router = useRouter();
  const [filter, setFilter] = useState(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function apply(next: ScreenerFilter, immediate = false) {
    setFilter(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const push = () => {
      const q = new URLSearchParams();
      if (next.minLiquidityUsd !== DEFAULT_FILTER.minLiquidityUsd)
        q.set("minLiquidityUsd", String(next.minLiquidityUsd));
      if (next.minVolMcapRatio !== DEFAULT_FILTER.minVolMcapRatio)
        q.set("minVolMcapRatio", String(next.minVolMcapRatio));
      if (next.maxPoolAgeHours !== DEFAULT_FILTER.maxPoolAgeHours)
        q.set("maxPoolAgeHours", String(next.maxPoolAgeHours));
      if (next.minBuys24h !== DEFAULT_FILTER.minBuys24h)
        q.set("minBuys24h", String(next.minBuys24h));
      if (next.requireGreen !== DEFAULT_FILTER.requireGreen)
        q.set("requireGreen", String(next.requireGreen));
      router.replace(q.size > 0 ? `/?${q.toString()}` : "/", { scroll: false });
    };
    if (immediate) push();
    else debounceRef.current = setTimeout(push, 450);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 flex flex-wrap items-end gap-4">
      <NumberField
        label="Min. Liquidität ($)"
        title="Darunter ist ein Exit oft unmöglich / Slippage brutal"
        value={filter.minLiquidityUsd}
        step={1000}
        onChange={(v) => apply({ ...filter, minLiquidityUsd: v })}
      />
      <NumberField
        label="Min. Vol/MCap (%)"
        title="24h-Volumen ÷ Market Cap — zeigt echtes Handelsinteresse statt totem Chart"
        value={Math.round(filter.minVolMcapRatio * 100)}
        step={5}
        onChange={(v) => apply({ ...filter, minVolMcapRatio: v / 100 })}
      />
      <NumberField
        label="Max. Pool-Alter (h, 0 = egal)"
        title="Ganz frische Pools = mehr Upside, mehr Rug-Risiko"
        value={filter.maxPoolAgeHours}
        step={1}
        onChange={(v) => apply({ ...filter, maxPoolAgeHours: v })}
      />
      <NumberField
        label="Min. Käufe 24h"
        title="Fake-Volume-Schutz (Proxy für Unique Buyers)"
        value={filter.minBuys24h}
        step={10}
        onChange={(v) => apply({ ...filter, minBuys24h: v })}
      />
      <label className="flex items-center gap-2 text-sm pb-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filter.requireGreen}
          onChange={(e) => apply({ ...filter, requireGreen: e.target.checked }, true)}
          className="accent-[var(--green)] h-4 w-4"
        />
        Nur grüne Ampel
      </label>
      <button
        onClick={() => apply(DEFAULT_FILTER, true)}
        className="ml-auto text-xs text-muted hover:text-foreground border border-line rounded-lg px-3 py-2 transition-colors cursor-pointer"
      >
        Zurücksetzen
      </button>
    </div>
  );
}

function NumberField({
  label,
  title,
  value,
  step,
  onChange,
}: {
  label: string;
  title: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted" title={title}>
      {label}
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-foreground w-36 focus:outline-none focus:border-accent"
      />
    </label>
  );
}
