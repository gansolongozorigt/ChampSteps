// src/avatar/types.ts — avatar prototype (branch avatar-prototype, flag-gated)
export type AvatarState = "idle" | "wave" | "happy" | "celebrate" | "sleep" | "grow";

export type AvatarEvent =
  | "app:open"
  | "practice:added"
  | "achievement:added"
  | "streak:milestone"
  | "tier:grow"
  | "inactive:3d";

export const AVATAR_STATES: readonly AvatarState[] = ["idle", "wave", "happy", "celebrate", "sleep", "grow"];
export const AVATAR_EVENTS: readonly AvatarEvent[] = [
  "app:open", "practice:added", "achievement:added", "streak:milestone", "tier:grow", "inactive:3d",
];
