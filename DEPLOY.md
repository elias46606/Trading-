# Online stellen — komplett vom iPad aus (Railway)

Diese Anleitung funktioniert vollständig im Safari/Chrome-Browser, ohne PC.
Am Ende hast du einen echten Link wie `https://memecoin-screener.up.railway.app`,
der rund um die Uhr läuft — inklusive Telegram-Alerts aufs Handy.

**Kosten:** Railway Hobby-Plan ≈ 5 $/Monat (beinhaltet die Nutzung dieses Projekts).
Es gibt eine kostenlose Testphase mit Startguthaben.

---

## Schritt 1 — Railway-Account anlegen

1. Öffne [railway.com](https://railway.com) im Browser
2. **Login with GitHub** wählen (derselbe GitHub-Account, dem dieses Repo gehört)
3. Zugriff bestätigen

## Schritt 2 — Projekt aus GitHub deployen

1. **New Project** → **Deploy from GitHub repo**
2. Falls gefragt: GitHub-Zugriff für das Repo **Trading-** freigeben
3. Repo **elias46606/Trading-** auswählen → **Deploy Now**

Railway erkennt Next.js automatisch und baut die App (dauert ein paar Minuten).

## Schritt 3 — Volume für die Datenbank anlegen

Damit die SQLite-Datenbank Neustarts überlebt:

1. Im Projekt: Rechtsklick/Long-Press auf den Service → **Attach Volume**
   (oder Service öffnen → **Settings** → **Volumes**)
2. Mount Path: `/data`

## Schritt 4 — Umgebungsvariablen setzen

Service öffnen → Tab **Variables** → folgende Einträge anlegen:

| Variable | Wert |
|---|---|
| `DATABASE_URL` | `file:/data/prod.db` |
| `EMBEDDED_WORKER` | `true` |
| `TELEGRAM_BOT_TOKEN` | *(optional — dein Token von @BotFather)* |
| `TELEGRAM_CHAT_ID` | *(optional — deine Chat-ID)* |
| `ANTHROPIC_API_KEY` | *(optional — für den KI-Copilot)* |

`EMBEDDED_WORKER=true` startet den Daten-Worker direkt im Webserver mit —
du brauchst also nur diesen einen Service.

Nach dem Speichern deployt Railway automatisch neu.

## Schritt 5 — Öffentlichen Link erzeugen

1. Service öffnen → **Settings** → **Networking**
2. **Generate Domain** antippen
3. Fertig — der Link (z. B. `https://trading-production-xxxx.up.railway.app`)
   funktioniert auf iPad, Handy und überall sonst. Du kannst ihn dir in
   Safari auch als App-Icon auf den Homescreen legen
   (Teilen-Symbol → „Zum Home-Bildschirm").

## Prüfen, ob alles läuft

- Öffne `<dein-link>/api/status` — dort sollte `"tokenCount"` nach 1–2 Minuten
  größer als 0 sein und `lastIngestAt` ein aktuelles Datum zeigen
- Im Dashboard oben muss **„● Worker aktiv"** grün leuchten

## Häufige Probleme

| Problem | Lösung |
|---|---|
| „Worker inaktiv" im Dashboard | `EMBEDDED_WORKER=true` gesetzt? (Variables prüfen, neu deployen) |
| Fehler „no such table" | `DATABASE_URL` prüfen — muss exakt `file:/data/prod.db` sein, und das Volume muss auf `/data` gemountet sein |
| Daten weg nach Neustart | Volume fehlt (Schritt 3) |
| Keine Telegram-Nachrichten | Token/Chat-ID prüfen; dem Bot vorher 1× schreiben; Alerts erscheinen trotzdem immer in der App unter „Alerts" |

---

## Alternative: Render.com

Geht auch, aber: Im kostenlosen Tarif schläft die App nach 15 Minuten ein —
dann laufen **keine Alerts** mehr, bis jemand die Seite öffnet. Für ein
Alert-Tool ist das unbrauchbar; der dauerhaft laufende Tarif kostet dort
ähnlich viel wie Railway. Deshalb ist Railway hier die bessere Wahl.
