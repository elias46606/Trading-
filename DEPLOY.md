# Online stellen — komplett vom iPad aus

Alles hier funktioniert vollständig im Safari/Chrome-Browser, ohne PC.
Am Ende hast du einen echten Link wie `https://trading-xyz.vercel.app`,
der rund um die Uhr läuft — inklusive Telegram-Alerts aufs Handy.

Es gibt zwei Wege:

| | Weg A — **kostenlos** | Weg B — Railway |
|---|---|---|
| Kosten | **0 €** | ≈ 5 $/Monat |
| Dienste | Vercel + Neon + cron-job.org (3 Gratis-Accounts) | Railway (1 Account) |
| Wie oft laufen Alerts? | alle 1–2 Min. (Cron-Takt) | alle ~45 Sek. (Dauerprozess) |

---

# Weg A — Kostenlos (Vercel + Neon + cron-job.org)

**So funktioniert es:** Vercel hostet die App gratis, hat aber keine Dauerprozesse.
Deshalb ruft der Gratis-Dienst cron-job.org alle 1–2 Minuten die eingebaute Route
`/api/cron` auf — jeder Aufruf holt frische Daten und verschickt fällige Alerts.
Die Datenbank liegt kostenlos bei Neon.

## Schritt 1 — Datenbank bei Neon anlegen (~3 Min.)

1. [neon.tech](https://neon.tech) öffnen → **Sign up** → mit GitHub einloggen
2. Neues Projekt anlegen (Name egal, Region z. B. Frankfurt/EU)
3. Auf dem Dashboard den **Connection String** kopieren — er sieht so aus:
   `postgresql://user:passwort@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
4. Irgendwo zwischenspeichern (Notizen-App) — den brauchst du gleich

## Schritt 2 — App bei Vercel deployen (~5 Min.)

1. [vercel.com](https://vercel.com) öffnen → **Sign up** → **Continue with GitHub**
   (Hobby-Plan wählen — der ist kostenlos)
2. **Add New… → Project** → dein Repo **Trading-** importieren
   (falls gefragt: GitHub-Zugriff für das Repo freigeben)
3. Vor dem Deploy: **Environment Variables** aufklappen und eintragen:

   | Name | Wert |
   |---|---|
   | `DATABASE_URL` | dein Neon-Connection-String aus Schritt 1 |
   | `CRON_SECRET` | ein selbst ausgedachtes Passwort, z. B. `blauerElefant42` |
   | `TELEGRAM_BOT_TOKEN` | *(optional — Token von @BotFather)* |
   | `TELEGRAM_CHAT_ID` | *(optional — deine Chat-ID)* |
   | `ANTHROPIC_API_KEY` | *(optional — für den KI-Copilot)* |

4. **Deploy** antippen und ~2 Minuten warten
5. Fertig ist dein Link: `https://<projektname>.vercel.app` 🎉
   (Beim Deploy werden die Datenbanktabellen automatisch angelegt.)

## Schritt 3 — Zeitschaltuhr bei cron-job.org einrichten (~3 Min.)

1. [cron-job.org](https://cron-job.org) öffnen → kostenlosen Account anlegen
2. **Cronjob anlegen** (Create cronjob):
   - **URL:** `https://<projektname>.vercel.app/api/cron?key=blauerElefant42`
     *(dein Vercel-Link + dein CRON_SECRET aus Schritt 2)*
   - **Ausführung:** alle **2 Minuten** (oder jede Minute)
3. Speichern. In der Historie des Cronjobs sollte nach kurzer Zeit
   **Status 200** mit einer Antwort wie `{"ingest":"ok","dispatch":"ok"}` stehen

## Prüfen, ob alles läuft

- `https://<projektname>.vercel.app/api/status` öffnen — `tokenCount` > 0
  und `lastIngestAt` aktuell?
- Im Dashboard muss **„● Worker aktiv"** grün leuchten
- Den Link per Teilen-Symbol → **„Zum Home-Bildschirm"** als App-Icon aufs iPad legen

## Häufige Probleme (Weg A)

| Problem | Lösung |
|---|---|
| Build schlägt fehl mit DB-Fehler | `DATABASE_URL` in Vercel prüfen (kompletter Neon-String inkl. `?sslmode=require`) |
| Cronjob zeigt Status 401 | `key=` in der Cron-URL muss exakt dem `CRON_SECRET` in Vercel entsprechen |
| „Worker inaktiv" im Dashboard | Läuft der Cronjob? (Historie bei cron-job.org prüfen) |
| Keine Telegram-Nachrichten | Token/Chat-ID prüfen; dem Bot vorher 1× schreiben; Alerts erscheinen trotzdem in der App unter „Alerts" |

**Hinweise:** Der Vercel-Hobby-Plan ist für private, nicht-kommerzielle Nutzung
gedacht — genau unser Fall. Neon gratis bis 0,5 GB (reicht hier locker, alte
Snapshots werden automatisch nach 72 h gelöscht).

---

# Weg B — Railway (~5 $/Monat, dafür Dauerprozess)

1. [railway.com](https://railway.com) → **Login with GitHub**
2. **New Project → Deploy from GitHub repo** → **Trading-** wählen
3. Im Projekt: **Create → Database → Add PostgreSQL**
4. Beim App-Service unter **Variables** eintragen:
   - `DATABASE_URL` → Reference auf `${{Postgres.DATABASE_URL}}`
   - `EMBEDDED_WORKER` → `true` *(startet den Dauer-Worker im Webserver mit)*
   - optional `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`
5. **Settings → Networking → Generate Domain** → das ist dein Link

Ein Cron-Dienst ist bei Weg B nicht nötig — der Worker läuft permanent mit.
