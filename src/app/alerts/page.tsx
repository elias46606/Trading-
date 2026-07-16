"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_FILTER } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

interface Rule {
  id: number;
  name: string;
  active: boolean;
  cooldownMinutes: number;
  filter: {
    minLiquidityUsd?: number;
    minVolMcapRatio?: number;
    maxPoolAgeHours?: number;
    minBuys24h?: number;
    requireGreen?: boolean;
  };
}

interface Alert {
  id: number;
  kind: string;
  message: string;
  sentAt: string;
  deliveredTelegram: boolean;
  token: { address: string; symbol: string; name: string | null };
  rule: { name: string } | null;
}

const KIND_LABEL: Record<string, string> = {
  SCREENER_MATCH: "Screener-Treffer",
  LIQUIDITY_DROP: "🚨 Liquiditäts-Drop",
  VOLUME_SPIKE: "📈 Volumen-Spike",
};

export default function AlertsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [form, setForm] = useState({
    name: "",
    minLiquidityUsd: DEFAULT_FILTER.minLiquidityUsd,
    minVolMcapRatio: Math.round(DEFAULT_FILTER.minVolMcapRatio * 100),
    maxPoolAgeHours: 24,
    minBuys24h: 50,
    cooldownMinutes: 360,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [rulesRes, alertsRes] = await Promise.all([
      fetch("/api/rules", { cache: "no-store" }),
      fetch("/api/alerts", { cache: "no-store" }),
    ]);
    if (rulesRes.ok) setRules((await rulesRes.json()).rules);
    if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function createRule() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          cooldownMinutes: form.cooldownMinutes,
          filter: {
            minLiquidityUsd: form.minLiquidityUsd,
            minVolMcapRatio: form.minVolMcapRatio / 100,
            maxPoolAgeHours: form.maxPoolAgeHours,
            minBuys24h: form.minBuys24h,
            requireGreen: true,
          },
        }),
      });
      setForm({ ...form, name: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    await load();
  }

  async function deleteRule(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Alert-Regeln</h1>
          <p className="text-sm text-muted mt-1">
            Der Dispatcher prüft alle ~45 Sekunden: Token erfüllt alle Filter <b>und</b> die
            Safety-Ampel ist grün → Push per Telegram. Jeder Treffer maximal einmal pro
            Cooldown-Fenster.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 flex flex-wrap items-end gap-4">
          <Field label="Regel-Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z. B. Frische Pools > $20k"
              className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:border-accent"
            />
          </Field>
          <NumberInput
            label="Min. Liquidität ($)"
            value={form.minLiquidityUsd}
            onChange={(v) => setForm({ ...form, minLiquidityUsd: v })}
          />
          <NumberInput
            label="Min. Vol/MCap (%)"
            value={form.minVolMcapRatio}
            onChange={(v) => setForm({ ...form, minVolMcapRatio: v })}
          />
          <NumberInput
            label="Max. Pool-Alter (h)"
            value={form.maxPoolAgeHours}
            onChange={(v) => setForm({ ...form, maxPoolAgeHours: v })}
          />
          <NumberInput
            label="Min. Käufe 24h"
            value={form.minBuys24h}
            onChange={(v) => setForm({ ...form, minBuys24h: v })}
          />
          <NumberInput
            label="Cooldown (Min.)"
            value={form.cooldownMinutes}
            onChange={(v) => setForm({ ...form, cooldownMinutes: v })}
          />
          <button
            onClick={createRule}
            disabled={!form.name.trim() || saving}
            className="bg-accent/15 border border-accent/40 text-accent rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Regel anlegen
          </button>
          <span className="w-full text-xs text-muted">
            Grüne Ampel ist bei Regeln immer Pflicht (Konzept 4.4).
          </span>
        </div>

        {rules.length > 0 && (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line/50">
            {rules.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${r.active ? "bg-ampel-green" : "bg-muted"}`} />
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted">
                  Liq ≥ ${(r.filter.minLiquidityUsd ?? 0).toLocaleString("de-DE")} · Vol/MCap ≥{" "}
                  {Math.round((r.filter.minVolMcapRatio ?? 0) * 100)} % · Alter ≤{" "}
                  {r.filter.maxPoolAgeHours || "∞"}h · Käufe ≥ {r.filter.minBuys24h ?? 0} · Cooldown{" "}
                  {r.cooldownMinutes} Min.
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <button
                    onClick={() => toggleRule(r)}
                    className="text-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    {r.active ? "Pausieren" : "Aktivieren"}
                  </button>
                  <button
                    onClick={() => deleteRule(r)}
                    className="text-ampel-red/70 hover:text-ampel-red transition-colors cursor-pointer"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Verlauf</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">
            Noch keine Alerts. Lege oben eine Regel an oder setze Tokens auf die Watchlist — der
            Worker (<code>npm run worker</code>) übernimmt den Rest.
          </p>
        ) : (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line/50">
            {alerts.map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs text-muted whitespace-nowrap">{fmtDateTime(a.sentAt)}</span>
                <span className="font-medium">{KIND_LABEL[a.kind] ?? a.kind}</span>
                <Link href={`/token/${a.token.address}`} className="text-accent hover:underline">
                  {a.token.symbol}
                </Link>
                {a.rule && <span className="text-xs text-muted">Regel: {a.rule.name}</span>}
                <span className="text-xs text-muted ml-auto">
                  {a.deliveredTelegram ? "→ Telegram ✓" : "nur in-App"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-accent"
      />
    </Field>
  );
}
