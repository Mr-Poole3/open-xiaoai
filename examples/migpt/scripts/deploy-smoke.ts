/**
 * Post-deploy WebSocket smoke test.
 * Usage: SMOKE_WS_URL=ws://host:4399?token=xxx npx tsx scripts/deploy-smoke.ts
 */
import WebSocket from "ws";

const url = process.env.SMOKE_WS_URL;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? "8000");

if (!url) {
  console.error("SMOKE_WS_URL is required");
  process.exit(1);
}

await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => {
    ws.terminate();
    reject(new Error(`smoke timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  const ws = new WebSocket(url);

  ws.on("open", () => {
    clearTimeout(timer);
    ws.close();
    resolve();
  });

  ws.on("error", (err) => {
    clearTimeout(timer);
    reject(err);
  });
});

console.log("✅ WebSocket smoke OK:", url.replace(/token=[^&]+/, "token=***"));
