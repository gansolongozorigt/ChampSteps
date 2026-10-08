// src/avatar/assets.ts — image set for the prototype character.
// Files: public/avatar/dev/temuulen/{state}.webp (512², built by scripts/avatar-build-assets.mjs,
// same scale, feet on y = 480/512). Original PNGs stay out of git (scratch/).
import type { AvatarState } from "./types";
import { AVATAR_STATES } from "./types";

export interface CharacterAssets {
  id: string;
  src: Record<AvatarState, string>;
  /** Eye line for the idle blink overlay, in % of the frame (measured on idle.webp). */
  eyeLine: { left: number; top: number; width: number; height: number };
  /** Where the feet are (fraction of the frame height) — used for the ground glow. */
  baseline: number;
}

export const TEMUULEN: CharacterAssets = {
  id: "temuulen",
  src: Object.fromEntries(AVATAR_STATES.map((s) => [s, `/avatar/dev/temuulen/${s}.webp`])) as Record<AvatarState, string>,
  eyeLine: { left: 48.6, top: 31.4, width: 7.6, height: 1.4 },
  baseline: 480 / 512,
};

let preloaded: Promise<void> | null = null;
/** Warm the browser cache for all six frames (called on app:open). Idempotent. */
export function preloadAvatarAssets(assets: CharacterAssets = TEMUULEN): Promise<void> {
  if (preloaded) return preloaded;
  if (typeof Image === "undefined") return Promise.resolve();
  preloaded = Promise.all(
    Object.values(assets.src).map(
      (src) => new Promise<void>((resolve) => { const img = new Image(); img.onload = img.onerror = () => resolve(); img.src = src; })
    )
  ).then(() => undefined);
  return preloaded;
}
