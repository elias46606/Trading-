import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getTokenMetrics } from "@/lib/screening";

export const dynamic = "force-dynamic";

// KI-Copilot (Konzept 4.5 + 9): Analyst, kein Orakel.
// Grounding-Pflicht: Der Prompt enthält ausschließlich die DB-Metriken
// des Tokens; der System-Prompt verbietet Prognosen und Empfehlungen.

// System-Prompt exakt aus Konzept 9.2 — nicht verändern.
const SYSTEM_PROMPT = `Du bist ein nüchterner On-Chain-Analyst für Solana-Tokens.

REGELN (nicht verhandelbar):
- Antworte AUSSCHLIESSLICH auf Basis der JSON-Metriken in der User-Message.
- Triff KEINE Preisprognosen. Sage nie, ob ein Token steigen oder fallen wird.
- Gib KEINE Kauf-, Verkaufs- oder Halteempfehlung. Keine Anlageberatung.
- Fehlt eine Information in den Daten, sage klar "aus den Daten nicht ableitbar".
  Rate oder ergänze niemals aus Allgemeinwissen.
- Bleib neutral und knapp. Beschreibe Ist-Zustand und Risiko, nicht Zukunft.
- Ein grüner Safety-Score bedeutet nur "kein sofortiges Rug-Signal erkennbar",
  niemals "sicher". Formuliere entsprechend.

AUFGABE:
Erkläre die Risiken und den aktuellen Zustand des Tokens verständlich.
Nenne die konkreten Metriken, auf die du dich stützt (z. B. Holder-Anteil,
Lock-Status, Liquidität), damit der Nutzer die Einschätzung selbst nachvollziehen
und überprüfen kann.`;

const ACTION_PROMPTS: Record<string, string> = {
  why: "Erkläre die aktuelle Risk-Bewertung.",
  briefing: "Gib ein 3-Satz-Briefing zu diesem Token.",
};

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Copilot nicht konfiguriert — ANTHROPIC_API_KEY in .env setzen." },
      { status: 503 },
    );
  }

  let body: { address?: string; action?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request" }, { status: 400 });
  }

  const { address, action, question } = body;
  if (!address || !action) {
    return NextResponse.json({ error: "address und action sind Pflicht" }, { status: 400 });
  }

  const userFrage =
    action === "ask" ? question?.trim() : ACTION_PROMPTS[action];
  if (!userFrage) {
    return NextResponse.json({ error: "Frage fehlt oder Aktion unbekannt" }, { status: 400 });
  }

  const metrics = await getTokenMetrics(address);
  if (!metrics) {
    return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });
  }

  // Grounding: exakt die Metriken, die auch das UI zeigt.
  const tokenMetrics = {
    symbol: metrics.symbol,
    name: metrics.name,
    liquidity: metrics.liquidityUsd,
    volume24h: metrics.volume24h,
    mcap: metrics.mcap,
    volMcapRatio: metrics.volMcapRatio,
    poolAgeHours: metrics.poolAgeHours,
    buys24h: metrics.buys24h,
    sells24h: metrics.sells24h,
    priceChange1h: metrics.priceChange1h,
    priceChange24h: metrics.priceChange24h,
    contractFlags: metrics.contractFlags,
    safetyScore: metrics.safetyScore,
    ampel: metrics.ampel,
    safetyFlags: metrics.safetyFlags,
    rugcheckScoreNormalised: metrics.rugcheckScore,
  };

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      // Modell laut Konzept 9.1
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Frage: ${userFrage}\n\nToken-Metriken:\n${JSON.stringify(tokenMetrics, null, 2)}`,
        },
      ],
    });

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ answer });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "API-Key ungültig." }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate-Limit erreicht — bitte kurz warten." },
        { status: 429 },
      );
    }
    console.error("[copilot] Anthropic-Fehler:", err);
    return NextResponse.json(
      { error: "KI-Analyse momentan nicht verfügbar. Bitte später erneut versuchen." },
      { status: 502 },
    );
  }
}
