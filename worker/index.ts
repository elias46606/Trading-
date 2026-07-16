// Eigenständiger Worker-Prozess:  npm run worker
// (Beim Single-Service-Hosting stattdessen EMBEDDED_WORKER=true setzen —
//  dann startet src/instrumentation.ts dieselben Loops im Webserver.)

try {
  process.loadEnvFile?.(".env");
} catch {
  // keine .env vorhanden — Defaults nutzen
}

import("./runner").then(({ startWorkerLoops }) => startWorkerLoops());
