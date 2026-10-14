// =============================================================================
// platform — the ONE place that knows whether we run inside the native shell.
//   isNative: Capacitor iOS / Android app (bundled web assets).
//   platform: "ios" | "android" | "web".
// Everything web-only (PWA install banner, service-worker push, purchase UI) checks here.
// =============================================================================

import { Capacitor } from "@capacitor/core";

export type AppPlatform = "ios" | "android" | "web";

export const isNative: boolean = Capacitor.isNativePlatform();
export const platform: AppPlatform = (Capacitor.getPlatform() as AppPlatform) ?? "web";
export const isIOSNative = platform === "ios" && isNative;
export const isAndroidNative = platform === "android" && isNative;

/** Value stored in pushTokens.platform (api/_lib/push.ts PLATFORMS). */
export function pushPlatformId(): "ios-native" | "android-native" | null {
  if (isIOSNative) return "ios-native";
  if (isAndroidNative) return "android-native";
  return null;
}
