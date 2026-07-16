// Anzeige-Formatierung (client-sicher, keine DB-Imports).

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)} Mrd.`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)} Mio.`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(n < 1 ? 6 : 2)}`;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)} %`;
}

export function fmtRatioAsPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${(n * 100).toFixed(0)} %`;
}

export function fmtAge(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} Min.`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} Tage`;
}

export function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}
