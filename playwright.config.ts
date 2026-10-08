import { defineConfig, devices } from "@playwright/test";

// E2E runs against the local Vite dev server + the PRODUCTION Firebase project
// (test accounts qa+<ts>@champstep.mn, cleaned up by Admin SDK afterwards).
// /api/* is proxied to production so promo/qpay endpoints answer.
// Uses the installed Google Chrome (channel: "chrome") — no Chromium download needed.
const PORT = 5174;
const AI_PORT = 5175;
/** Second Vite dev server built with VITE_AVATAR_DEV=1 (avatar prototype, branch avatar-prototype). */
const AVATAR_PORT = 5176;
export const AVATAR_FLAG_URL = `http://127.0.0.1:${AVATAR_PORT}`;
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
/** Local mock of /api/ai-insight (real handler, AI_INSIGHT_MOCK=1) — see tests/e2e/helpers/api-server.mjs. */
export const AI_API_URL = `http://127.0.0.1:${AI_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "scratch/qa-20261007/test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "scratch/qa-20261007/report" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "mn-MN",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 800 } }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : [
    {
      command: `E2E_AI_PORT=${AI_PORT} node tests/e2e/helpers/api-server.mjs`,
      url: `${AI_API_URL}/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `E2E_API_PROXY=https://www.champstep.mn E2E_AI_PROXY=${AI_API_URL} npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `VITE_AVATAR_DEV=1 E2E_API_PROXY=https://www.champstep.mn E2E_AI_PROXY=${AI_API_URL} npm run dev -- --host 127.0.0.1 --port ${AVATAR_PORT} --strictPort`,
      url: AVATAR_FLAG_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
