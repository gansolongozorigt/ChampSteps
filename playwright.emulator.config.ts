// E2E against the LOCAL Firebase emulators (auth + firestore + storage, demo project) instead of
// production: `npm run test:e2e:emu`. Rules come from the working tree (firestore.rules /
// storage.rules), so new rules are tested before they are deployed, and no production data is
// created or deleted. Needs Java (Firestore emulator).
//
// Not covered here (they need the deployed /api or production credentials): subscription*,
// ai-insight, delete, install.mobile — run those with the default config (playwright.config.ts).
import { defineConfig, devices } from "@playwright/test";

const PORT = 5176; // never reuse a dev server that talks to production (5174)
const PROJECT = "demo-champstep";
const BASE_URL = `http://127.0.0.1:${PORT}`;
/** Specs that call the deployed /api (payments, AI, server-side deletion) or install prompts. */
const NEEDS_API = [/subscription/, /ai-insight/, /delete\.spec/, /install\.mobile/];

// Test-runner side (helpers/admin.ts): Admin SDK → emulators, no credentials.
process.env.E2E_EMULATORS = "1";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

export default defineConfig({
  testDir: "tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "scratch/e2e-emu/test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "scratch/e2e-emu/report" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "mn-MN",
  },
  projects: [
    // project-level testIgnore replaces a top-level one, so the /api-dependent specs are listed here
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 800 } }, testIgnore: [/mobile\.spec/, ...NEEDS_API] },
    { name: "mobile", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, testMatch: /mobile\.spec/, testIgnore: NEEDS_API },
  ],
  webServer: [
    {
      command: `npx firebase emulators:start --only auth,firestore,storage --project ${PROJECT}`,
      url: "http://127.0.0.1:9099",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      // process env wins over .env in Vite: the app gets a demo project and connects to the emulators
      env: {
        VITE_USE_EMULATORS: "1",
        VITE_FIREBASE_API_KEY: "demo-key",
        VITE_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
        VITE_FIREBASE_PROJECT_ID: PROJECT,
        VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`,
        VITE_FIREBASE_MESSAGING_SENDER_ID: "0",
        VITE_FIREBASE_APP_ID: "1:0:web:demo",
        VITE_FIREBASE_MEASUREMENT_ID: "",
        VITE_FIREBASE_VAPID_KEY: "",
      },
    },
  ],
});
