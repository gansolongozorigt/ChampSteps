// =============================================================================
// push — web push via Firebase Cloud Messaging (lazy: firebase/messaging is only
// downloaded when the user touches the reminder toggles or already has a token).
//   enablePush()  — permission (from a tap only) → FCM token on the PWA's own
//                   service worker → POST /api/push/register (admin SDK writes
//                   pushTokens/{token}; the collection stays closed to clients).
//   disablePush() — deleteToken + POST /api/push/unregister.
//   refreshPushToken() — at app start when a token exists: re-registers (lastSeenAt).
// The token is mirrored in localStorage only so disable/refresh know which one is ours.
// =============================================================================

import { firebaseApp, isFirebaseConfigured } from "./firebase";
import { isIOSBrowser, pushPlatform } from "./install";

const TOKEN_KEY = "champstep.pushToken";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export type PushState =
  | "ok"                 // can enable
  | "ios-not-installed"  // iOS Safari tab: add to home screen first
  | "unsupported"        // no Notification / PushManager / service worker
  | "denied"             // user blocked notifications in the browser
  | "not-configured";    // VITE_FIREBASE_VAPID_KEY missing on this deployment

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  // iOS tab first: "install the app" is the useful message there, whatever else is missing.
  if (isIOSBrowser()) return "ios-not-installed";
  if (!isFirebaseConfigured || !VAPID_KEY) return "not-configured";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

export function storedPushToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function rememberToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

async function messagingModule() {
  const mod = await import("firebase/messaging");
  if (!(await mod.isSupported())) throw new Error("unsupported");
  if (!firebaseApp) throw new Error("not-configured");
  return { mod, messaging: mod.getMessaging(firebaseApp) };
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
}

export type EnableResult = { ok: true } | { ok: false; reason: PushState | "permission-dismissed" | "error" };

/** Must be called from a user gesture (the toggle tap): requests permission + registers the token. */
export async function enablePush(getIdToken: () => Promise<string>, lang: string): Promise<EnableResult> {
  const state = pushState();
  if (state !== "ok") return { ok: false, reason: state };
  try {
    const perm = await Notification.requestPermission();
    if (perm === "denied") return { ok: false, reason: "denied" };
    if (perm !== "granted") return { ok: false, reason: "permission-dismissed" };
    const { mod, messaging } = await messagingModule();
    const reg = await navigator.serviceWorker.ready;
    const token = await mod.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: "error" };
    await post("/api/push/register", { idToken: await getIdToken(), token, platform: pushPlatform(), lang: lang.slice(0, 2) });
    rememberToken(token);
    return { ok: true };
  } catch (e) {
    console.warn("[push] enable failed:", e);
    return { ok: false, reason: "error" };
  }
}

/** Removes this device's token (server first, then FCM). Safe to call when there is none. */
export async function disablePush(getIdToken: () => Promise<string>): Promise<void> {
  const token = storedPushToken();
  if (!token) return;
  try { await post("/api/push/unregister", { idToken: await getIdToken(), token }); } catch (e) { console.warn("[push] unregister failed:", e); }
  try {
    const { mod, messaging } = await messagingModule();
    await mod.deleteToken(messaging);
  } catch { /* token already gone */ }
  rememberToken(null);
}

/** App start: if this device registered before and permission is still granted, refresh the token. */
export async function refreshPushToken(getIdToken: () => Promise<string>, lang: string): Promise<void> {
  if (!storedPushToken() || pushState() !== "ok" || Notification.permission !== "granted") return;
  try {
    const { mod, messaging } = await messagingModule();
    const reg = await navigator.serviceWorker.ready;
    const token = await mod.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;
    await post("/api/push/register", { idToken: await getIdToken(), token, platform: pushPlatform(), lang: lang.slice(0, 2) });
    rememberToken(token);
  } catch (e) {
    console.warn("[push] refresh failed:", e);
  }
}

/** A push that arrives while the app is open (FCM does not show it) → caller shows a toast. */
export async function onForegroundPush(cb: (data: { title?: string; body?: string; url?: string }) => void): Promise<() => void> {
  if (!storedPushToken() || pushState() !== "ok") return () => {};
  try {
    const { mod, messaging } = await messagingModule();
    return mod.onMessage(messaging, (payload) => cb(payload.data ?? {}));
  } catch {
    return () => {};
  }
}
