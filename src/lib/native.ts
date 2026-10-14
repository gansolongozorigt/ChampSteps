// =============================================================================
// native — shell behaviour that only exists inside the Capacitor app.
// Loaded lazily from main.tsx when isNative (the web bundle never imports the plugins).
//   • status bar / splash screen
//   • keyboard: <html data-keyboard="open"> hides the bottom nav (iOS)
//   • Android back button: close a modal → go back to the home screen → exit at root
//   • external links: open in the system browser (in-app routes stay in the WebView)
// =============================================================================

import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Keyboard } from "@capacitor/keyboard";
import { isAndroidNative } from "./platform";

/** App.tsx registers these so the back button can act on React state. */
export interface BackHandlers {
  /** Return true when a modal/sheet was closed. */
  closeTopModal(): boolean;
  /** Return true when the screen changed (e.g. back to the home tab). */
  goBack(): boolean;
}
let backHandlers: BackHandlers | null = null;
export function setBackHandlers(h: BackHandlers | null) { backHandlers = h; }

const APP_HOSTS = new Set(["www.champstep.mn", "champstep.mn"]);

export async function initNativeShell(): Promise<void> {
  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (isAndroidNative) await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
  } catch { /* plugin missing on this platform */ }

  Keyboard.addListener("keyboardWillShow", () => document.documentElement.setAttribute("data-keyboard", "open"));
  Keyboard.addListener("keyboardWillHide", () => document.documentElement.removeAttribute("data-keyboard"));

  CapApp.addListener("backButton", ({ canGoBack }) => {
    if (backHandlers?.closeTopModal()) return;
    if (backHandlers?.goBack()) return;
    if (canGoBack) { window.history.back(); return; }
    void CapApp.exitApp();
  });

  // Links to other sites (and absolute links to champstep.mn pages) open outside the app.
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const url = new URL(a.href, window.location.href);
    const external = url.origin !== window.location.origin && !(APP_HOSTS.has(url.host) && !url.pathname.startsWith("/privacy") && !url.pathname.startsWith("/terms"));
    if (!external && url.origin === window.location.origin) return;
    e.preventDefault();
    window.open(url.href, "_system");
  }, true);

  // The web app has rendered: drop the splash (launchAutoHide is the safety net).
  try { await SplashScreen.hide(); } catch { /* already hidden */ }
}
