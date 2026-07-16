"use client";

import { useState } from "react";

// KI-Copilot-Panel (Konzept 9.1): drei Aktionen, Antwort mit Lade-
// Indikator, festes Label unter jeder Antwort. Kein <form>, nur onClick.
export function CopilotPanel({ address, configured }: { address: string; configured: boolean }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(action: "why" | "briefing" | "ask") {
    if (loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, action, question: action === "ask" ? question : undefined }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) {
        setError(data.error ?? "Unbekannter Fehler");
      } else {
        setAnswer(data.answer);
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
      <h2 className="font-semibold">KI-Copilot</h2>
      {!configured && (
        <p className="text-sm text-muted">
          Nicht konfiguriert. Trage <code>ANTHROPIC_API_KEY</code> in die <code>.env</code> ein und
          starte die App neu, um Analysen zu aktivieren.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => ask("why")}
          disabled={loading || !configured}
          className="border border-line bg-surface-2 rounded-lg px-3 py-2 text-sm hover:border-accent transition-colors disabled:opacity-40 cursor-pointer"
        >
          Warum diese Bewertung?
        </button>
        <button
          onClick={() => ask("briefing")}
          disabled={loading || !configured}
          className="border border-line bg-surface-2 rounded-lg px-3 py-2 text-sm hover:border-accent transition-colors disabled:opacity-40 cursor-pointer"
        >
          Briefing
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && question.trim()) void ask("ask");
          }}
          placeholder="Frag die Daten — z. B. „Wie verteilt sich das Handelsvolumen?“"
          disabled={!configured}
          className="flex-1 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-40"
        />
        <button
          onClick={() => ask("ask")}
          disabled={loading || !configured || !question.trim()}
          className="bg-accent/15 border border-accent/40 text-accent rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 cursor-pointer"
        >
          Fragen
        </button>
      </div>

      {loading && <p className="text-sm text-muted animate-pulse">Analysiere On-Chain-Daten …</p>}
      {error && <p className="text-sm text-ampel-red">{error}</p>}
      {answer && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap border-t border-line pt-3">
          {answer}
        </div>
      )}
      {answer && (
        <p className="text-xs text-muted border-t border-line pt-2">
          KI-Analyse auf Basis aktueller On-Chain-Daten — keine Anlageberatung, keine Prognose.
        </p>
      )}
    </section>
  );
}
