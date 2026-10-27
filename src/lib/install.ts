// =============================================================================
// install — "add to home screen" state for the install banner / settings button.
//   iOS:     no install API; we show a 3-step guide (Share → Add to Home Screen → Add)
//            from the SECOND visit on, unless installed (standalone) or snoozed 7 days.
//   Android: the browser fires `beforeinstallprompt`; we keep the event and call
//            prompt() from a user tap ("Суулгах").
// localStorage only — per device conveniences, never user data.
// =============================================================================

const OPEN_COUNT_KEY = "champstep.openCount";
const SNOOZE_KEY = "champstep.installSnoozedAt";
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Call once at startup (main.tsx) — the event fires early, before React mounts. */
export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    for (const l of listeners) l();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    for (const l of listeners) l();
  });
}

export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Android/Chrome: the browser offered an install prompt we can show. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = deferredPrompt;
  if (!ev) return "unavailable";
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === "accepted") deferredPrompt = null;
  for (const l of listeners) l();
  return outcome;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** iOS browser tab (not installed): push needs the home-screen app first. */
export function isIOSBrowser(): boolean {
  return isIOS() && !isStandalone();
}

let bumpedThisLoad: number | null = null;

/**
 * Increment and return the number of app opens on this device (1 on the first visit).
 * Counted once per page load: StrictMode double effects and dashboard remounts must not inflate it.
 */
export function bumpOpenCount(): number {
  if (bumpedThisLoad !== null) return bumpedThisLoad;
  try {
    const n = Number(localStorage.getItem(OPEN_COUNT_KEY) ?? 0) + 1;
    localStorage.setItem(OPEN_COUNT_KEY, String(n));
    bumpedThisLoad = n;
  } catch { bumpedThisLoad = 1; }
  return bumpedThisLoad;
}

export function isInstallSnoozed(now = Date.now()): boolean {
  try { return now - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < INSTALL_SNOOZE_MS; } catch { return false; }
}

export function snoozeInstall(now = Date.now()) {
  try { localStorage.setItem(SNOOZE_KEY, String(now)); } catch { /* private mode */ }
}

export type InstallKind = "ios" | "android" | "none";

/**
 * Which install banner (if any) to show. `openCount` comes from bumpOpenCount()
 * on this page load; the first visit never shows a banner.
 */
export function installBannerKind(openCount: number): InstallKind {
  if (isStandalone() || openCount < 2 || isInstallSnoozed()) return "none";
  if (isIOS()) return "ios";
  if (canPromptInstall()) return "android";
  return "none";
}

/** Reported to /api/push/register. */
export function pushPlatform(): "ios-pwa" | "android" | "desktop" {
  if (isIOS()) return "ios-pwa";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}
