#!/usr/bin/env node
// =============================================================================
// scripts/ai-insight-sample.mjs — real-quality check of the AI insight prompt.
//   node scripts/ai-insight-sample.mjs --email you@example.com [--lang mn] [--out scratch/ai-samples.md]
// READ-ONLY: loads the parent's children + achievements + practiceLogs +
// reflections count with the Admin SDK, builds the exact prompt the API builds
// (api/_lib/aiInsight.ts), calls Anthropic once per child and writes the texts
// to a markdown file. Nothing is written to Firestore (no cache, no usage).
// Auth: FIREBASE_SERVICE_ACCOUNT_B64 + ANTHROPIC_API_KEY (or VITE_ANTHROPIC_API_KEY) from .env
// =============================================================================
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { register } from "node:module";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const envPath = new URL("../.env", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const email = arg("--email"), uidArg = arg("--uid");
const language = arg("--lang", "mn");
const out = arg("--out", "scratch/ai-samples.md");
if (!email && !uidArg) { console.error("usage: --email <parent email> | --uid <uid> [--lang mn|en|ru] [--out file]"); process.exit(2); }
const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
if (!b64) { console.error("FIREBASE_SERVICE_ACCOUNT_B64 missing"); process.exit(2); }
if (!apiKey) { console.error("ANTHROPIC_API_KEY missing"); process.exit(2); }

register("../tests/e2e/helpers/ts-loader.mjs", import.meta.url);
const { anthropicRequestBody, buildInsightInput, computeDataHash, extractText, normalizeLanguage, resolveModel } =
  await import("../api/_lib/aiInsight.ts");

const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();
const uid = uidArg ?? (await getAuth().getUserByEmail(email)).uid;
const lang = normalizeLanguage(language);
const model = resolveModel();

const kids = await db.collection("children").where("parentId", "==", uid).get();
if (kids.empty) { console.error("no children for this parent"); process.exit(1); }
const docs = async (col, childId) => (await db.collection(col).where("childId", "==", childId).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const lines = [`# AI insight samples — ${new Date().toISOString()}`, ``, `model: \`${model}\` · language: ${lang} · parent uid: ${uid.slice(0, 6)}… · read-only (no Firestore writes)`, ``];
for (const k of kids.docs) {
  const child = k.data();
  const [achievements, practiceLogs, refl] = await Promise.all([
    docs("achievements", k.id), docs("practiceLogs", k.id),
    db.collection("reflections").where("childId", "==", k.id).count().get(),
  ]);
  const input = buildInsightInput({ childId: k.id, child, achievements, practiceLogs, reflectionsCount: refl.data().count, language: lang });
  const hash = computeDataHash({ childId: k.id, child, achievements, practiceLogs });
  const body = anthropicRequestBody(model, lang, input);
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  if (!r.ok) { console.error(`${child.name}: Anthropic ${r.status}`, await r.text()); process.exit(1); }
  const data = await r.json();
  const textOut = extractText(data);
  const words = textOut.split(/\s+/).filter(Boolean).length;
  console.log(`\n=== ${child.name} (${input.achievements.length} achievements, ${input.practiceLogs.count} logs) · ${ms} ms · stop=${data.stop_reason} · ${words} words · in ${data.usage?.input_tokens} / out ${data.usage?.output_tokens} tok ===\n${textOut}\n`);
  lines.push(`## ${child.name}`, ``,
    `- input: ${input.achievements.length} achievements (of ${achievements.length}), practiceLogs ${JSON.stringify(input.practiceLogs)}, reflections ${input.reflectionsCount}, age ${input.child.age}`,
    `- dataHash \`${hash}\` · stop_reason \`${data.stop_reason}\` · ${words} words · tokens in ${data.usage?.input_tokens} / out ${data.usage?.output_tokens} (cache read ${data.usage?.cache_read_input_tokens ?? 0}) · ${ms} ms`,
    ``, "```", textOut, "```", ``);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"));
console.log(`\nwritten → ${out}`);
