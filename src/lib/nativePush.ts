// =============================================================================
// nativePush — FCM inside the Capacitor app (@capacitor-firebase/messaging).
//   enable:  requestPermissions → getToken → POST /api/push/register (platform ios-native /
//            android-native). The server cron is unchanged.
//   refresh: tokenReceived listener re-registers; app start re-registers the stored token.
//   tap:     notificationActionPerformed → in-app "/today" (window event "champstep:navigate").
// iOS needs the aps-environment entitlement (Developer account): VITE_IOS_PUSH=0 disables it
// on iOS builds until then; Android is complete.
// =============================================================================

import { isIOSNative, pushPlatformId } from "./platform";

const TOKEN_KEY = "champstep.pushToken";
export const IOS_PUSH_ENABLED = import.meta.env.VITE_IOS_PUSH !== "0";

export type NativePushState = "ok" | "denied" | "not-configured";

export function nativePushState(): NativePushState {
  if (isIOSNative && !IOS_PUSH_ENABLED) return "not-configured";
  return "ok";
}

async function plugin() {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  return FirebaseMessaging;
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
}

function remember(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}
export function storedNativeToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function register(token: string, getIdToken: () => Promise<string>, lang: string) {
  await post("/api/push/register", { idToken: await getIdToken(), token, platform: pushPlatformId() ?? "desktop", lang: lang.slice(0, 2) });
  remember(token);
}

export type NativeEnableResult = { ok: true } | { ok: false; reason: NativePushState | "error" };

export async function nativeEnablePush(getIdToken: () => Promise<string>, lang: string): Promise<NativeEnableResult> {
  const state = nativePushState();
  if (state !== "ok") return { ok: false, reason: state };
  try {
    const fm = await plugin();
    const perm = await fm.requestPermissions();
    if (perm.receive !== "granted") return { ok: false, reason: "denied" };
    const { token } = await fm.getToken();
    if (!token) return { ok: false, reason: "error" };
    await register(token, getIdToken, lang);
    return { ok: true };
  } catch (e) {
    console.warn("[push:native] enable failed:", e);
    return { ok: false, reason: "error" };
  }
}

export async function nativeDisablePush(getIdToken: () => Promise<string>): Promise<void> {
  const token = storedNativeToken();
  if (!token) return;
  try { await post("/api/push/unregister", { idToken: await getIdToken(), token }); } catch (e) { console.warn("[push:native] unregister failed:", e); }
  try { await (await plugin()).deleteToken(); } catch { /* already gone */ }
  remember(null);
}

/** App start (signed in): re-register the token if one exists, listen for refreshes and taps. */
export async function initNativePush(getIdToken: () => Promise<string>, lang: string): Promise<() => void> {
  if (nativePushState() !== "ok") return () => {};
  const fm = await plugin();
  const subs = [
    await fm.addListener("tokenReceived", ({ token }) => { if (storedNativeToken()) void register(token, getIdToken, lang).catch(() => {}); }),
    await fm.addListener("notificationActionPerformed", (ev) => {
      const url = (ev.notification.data as { url?: string } | undefined)?.url || "/today";
      window.dispatchEvent(new CustomEvent("champstep:navigate", { detail: { url } }));
    }),
  ];
  if (storedNativeToken()) {
    try {
      const perm = await fm.checkPermissions();
      if (perm.receive === "granted") { const { token } = await fm.getToken(); if (token) await register(token, getIdToken, lang); }
    } catch (e) { console.warn("[push:native] refresh failed:", e); }
  }
  return () => { for (const s of subs) void s.remove(); };
}
