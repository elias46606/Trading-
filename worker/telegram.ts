// Telegram-Bot-Versand (Konzept 4.4).
// Ohne TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID werden Alerts nur in der
// DB geloggt und in der Web-App angezeigt — kein Crash, kein Spam.

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text: string): Promise<boolean> {
  if (!telegramConfigured()) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      console.warn(`[telegram] sendMessage fehlgeschlagen: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[telegram] Fehler:", err);
    return false;
  }
}
