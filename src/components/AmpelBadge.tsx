import type { Ampel } from "@/lib/types";

const STYLES: Record<Ampel, { dot: string; text: string; label: string }> = {
  GREEN: { dot: "bg-ampel-green", text: "text-ampel-green", label: "Grün" },
  YELLOW: { dot: "bg-ampel-yellow", text: "text-ampel-yellow", label: "Gelb" },
  RED: { dot: "bg-ampel-red", text: "text-ampel-red", label: "Rot" },
};

export function AmpelBadge({ ampel, score }: { ampel: Ampel | null; score: number | null }) {
  if (!ampel) {
    return <span className="text-muted text-xs">ungeprüft</span>;
  }
  const s = STYLES[ampel];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}
      title="Kein grüner Score ist eine Garantie — nur: kein sofortiges Rug-Signal erkennbar."
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
      {score !== null && <span className="text-muted font-normal">{score}/100</span>}
    </span>
  );
}
