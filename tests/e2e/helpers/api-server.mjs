// Local stand-in for the Vercel function /api/ai-insight during E2E.
//   node tests/e2e/helpers/api-server.mjs   (port E2E_AI_PORT, default 5175)
// Runs the REAL handler (api/ai-insight.ts: token check, tier, ownership,
// Firestore reads, cache, rate limit) against the production Firebase project
// with AI_INSIGHT_MOCK=1, so Anthropic is never called: the handler echoes the
// prompt JSON as the insight. Vite proxies /api/ai-insight here (vite.config.ts).
import { createServer } from "node:http";
import { register } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const envPath = new URL("../../../.env", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
  console.error("[e2e api] FIREBASE_SERVICE_ACCOUNT_B64 missing");
  process.exit(2);
}
process.env.AI_INSIGHT_MOCK = "1";
delete process.env.VERCEL_ENV;

register("./ts-loader.mjs", import.meta.url);
const { default: handler } = await import("../../../api/ai-insight.ts");

const PORT = Number(process.env.E2E_AI_PORT ?? 5175);
createServer(async (req, res) => {
  if (req.url === "/health") { res.statusCode = 200; return res.end("ok"); }
  if (!req.url?.startsWith("/api/ai-insight")) { res.statusCode = 404; return res.end("not found"); }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
  req.query = {};
  req.cookies = {};
  res.status = (n) => { res.statusCode = n; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
  res.send = (s) => { res.end(typeof s === "string" ? s : JSON.stringify(s)); return res; };
  try { await handler(req, res); }
  catch (e) { console.error("[e2e api] handler threw:", e); if (!res.headersSent) res.status(500).json({ error: "crash" }); }
}).listen(PORT, "127.0.0.1", () => console.log(`[e2e api] mock ai-insight on http://127.0.0.1:${PORT}`));
