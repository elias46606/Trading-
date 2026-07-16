// Next.js-Instrumentation-Hook: läuft einmal beim Serverstart.
// Mit EMBEDDED_WORKER=true laufen Ingest + Alert-Dispatcher direkt im
// Webserver mit — so reicht beim Hosting (z.B. Railway) ein einziger
// Dienst. Lokal bleibt der Standard: Worker separat via `npm run worker`.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.EMBEDDED_WORKER === "true") {
    const { startWorkerLoops } = await import("../worker/runner");
    startWorkerLoops();
  }
}
