// Test fixture that collects console.error + uncaught errors for every page,
// ignoring Chrome-extension noise, and attaches them to the report.
import { test as base, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

export interface ConsoleEntry { page: string; type: string; text: string }
export const test = base.extend<{ consoleErrors: ConsoleEntry[] }>({
  consoleErrors: [async ({ context }, use, testInfo) => {
    const entries: ConsoleEntry[] = [];
    const hook = (p: import("@playwright/test").Page) => {
      p.on("console", (m) => {
        if (m.type() !== "error") return;
        const loc = m.location()?.url ?? "";
        if (loc.startsWith("chrome-extension://") || m.text().includes("chrome-extension://")) return;
        entries.push({ page: p.url(), type: "console.error", text: m.text().slice(0, 500) });
      });
      p.on("pageerror", (e) => entries.push({ page: p.url(), type: "pageerror", text: String(e).slice(0, 500) }));
    };
    context.pages().forEach(hook);
    context.on("page", hook);
    await use(entries);
    const dir = "scratch/qa-20261007/console";
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/${testInfo.titlePath.join(" › ").replace(/[^\wЀ-ӿ-]+/g, "_").slice(0, 120)}.json`;
    writeFileSync(file, JSON.stringify(entries, null, 2));
    if (entries.length) await testInfo.attach("console-errors", { body: JSON.stringify(entries, null, 2), contentType: "application/json" });
  }, { auto: true }],
});
export { expect };
