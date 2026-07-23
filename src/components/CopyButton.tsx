"use client";

import { useState } from "react";

// Contract-Adresse kopieren → in der Fomo-App (oder jeder anderen
// Trading-App) in die Suche einfügen und direkt handeln.
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard nicht verfügbar (z.B. http) — Adresse steht daneben
    }
  }

  return (
    <button
      onClick={copy}
      className={`text-xs rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${
        copied
          ? "border-ampel-green/50 text-ampel-green"
          : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
      }`}
    >
      {copied ? "✓ Kopiert — in Fomo einfügen" : "CA kopieren für Fomo"}
    </button>
  );
}
