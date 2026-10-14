/// <reference lib="webworker" />
// =============================================================================
// Service worker (vite-plugin-pwa, injectManifest) — ONE worker does both jobs:
//   1. app shell precache + SPA navigation fallback (Workbox); Firestore / Storage
//      requests are never cached here (Firestore has its own IndexedDB cache).
//   2. Firebase Cloud Messaging background handler: the cron sends DATA-ONLY
//      messages, this worker renders exactly one notification and a click opens
//      the in-app path (`/today` for the daily reminder).
// The page registers this worker (vite-plugin-pwa injects registerSW) and passes
// the same registration to FCM getToken() (src/lib/push.ts), so there is no
// second firebase-messaging-sw.js and no scope conflict.
// =============================================================================

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

declare let self: ServiceWorkerGlobalScope;

// registerType: "autoUpdate" semantics
self.skipWaiting();
clientsClaim();

// ---- app shell ---------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA: every navigation (/, /today, ...) is served from the precached index.html,
// so deep links work offline. /api/* is never a navigation target.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

for (const [name, pattern, maxEntries] of [
  ["google-fonts-stylesheets", /^https:\/\/fonts\.googleapis\.com\/.*/i, 10],
  ["google-fonts-webfonts", /^https:\/\/fonts\.gstatic\.com\/.*/i, 30],
] as const) {
  registerRoute(
    pattern,
    new CacheFirst({
      cacheName: name,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      ],
    })
  );
}

// ---- push --------------------------------------------------------------------
const DEFAULT_URL = "/today";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  try {
    const messaging = getMessaging(initializeApp(firebaseConfig));
    onBackgroundMessage(messaging, (payload) => {
      const d = payload.data ?? {};
      const title = d.title || "ChampStep";
      void self.registration.showNotification(title, {
        body: d.body ?? "",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: d.tag || "champstep",
        data: { url: d.url || DEFAULT_URL },
      });
    });
  } catch (e) {
    // Messaging is unsupported in this browser; the app shell still works.
    console.warn("[sw] messaging unavailable:", e);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string } | undefined)?.url || DEFAULT_URL;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const target = new URL(url, self.location.origin).href;
      for (const c of list) {
        if (new URL(c.url).origin !== self.location.origin) continue;
        // Already open: tell the page to switch screens, then bring it to front.
        c.postMessage({ type: "navigate", url });
        await c.focus();
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
