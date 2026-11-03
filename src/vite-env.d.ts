/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  /** Web Push certificate public key (Firebase Console → Cloud Messaging). Optional: push UI shows "not configured" without it. */
  readonly VITE_FIREBASE_VAPID_KEY?: string
  readonly VITE_QPAY_SANDBOX?: string
  /** "1" = dev server talks to the local Firebase emulators (E2E only) */
  readonly VITE_USE_EMULATORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** package.json version, injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string | undefined
