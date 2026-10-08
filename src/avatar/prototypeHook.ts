// src/avatar/prototypeHook.ts — everything the avatar prototype needs from App,
// as ONE hook that App.tsx calls behind the build-time flag:
//
//   if (__AVATAR_DEV__) useAvatarPrototype({...})   // App.tsx
//
// The condition is a build-time literal, so the hook order never changes at
// runtime (React is fine with that) and a flag-off build drops the statement,
// this import and every avatar chunk — the production bundle stays byte-identical
// to main. No production component is touched: the slot is rendered into a host
// <div> inserted right after the achievements header (a separate React root).
//   app:open     — once on mount
//   energy       — 10 % with no practice, +15 % per log in the last 30 days (cap 100)
//   inactive:3d  — once per child when the newest practice log is ≥ 3 days old
// Memory only; nothing is written anywhere.
import { createElement, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { PracticeLog } from "../types";
import { emitAvatarEnergy, emitAvatarEvent } from "./bus";

const DAY = 86_400_000;

export function energyFromLogs(dates: string[], now: Date = new Date()): number {
  if (dates.length === 0) return 10;
  const cutoff30 = new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10);
  const last30 = dates.filter((d) => d >= cutoff30).length;
  return Math.min(100, 10 + last30 * 15);
}

export function daysSince(date: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(date + "T00:00:00").getTime()) / DAY;
}

export interface AvatarPrototypeArgs {
  childId: string | undefined;
  childName: string | undefined;
  practiceLogs: PracticeLog[];
  /** App's active section; the slot exists only on "achievements". */
  section: string;
  /** false while the achievements list is still loading (header may be replaced). */
  ready: boolean;
}

export function useAvatarPrototype({ childId, childName, practiceLogs, section, ready }: AvatarPrototypeArgs): void {
  const inactiveFor = useRef<string | null>(null);

  useEffect(() => { emitAvatarEvent("app:open"); }, []);

  useEffect(() => {
    if (!childId) return;
    const dates = practiceLogs.map((l) => l.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    emitAvatarEnergy(energyFromLogs(dates));
    const last = dates[dates.length - 1];
    if (last && inactiveFor.current !== childId && daysSince(last) >= 3) {
      inactiveFor.current = childId;
      emitAvatarEvent("inactive:3d");
    }
  }, [childId, practiceLogs]);

  // Mount <AvatarSlot> under the achievements header (lazy chunk, own React root).
  useEffect(() => {
    if (!childId || section !== "achievements" || !ready) return;
    const header = document.querySelector("main header");
    if (!header) return;
    const host = document.createElement("div");
    host.dataset.avatarHost = childId;
    header.insertAdjacentElement("afterend", host);
    const root = createRoot(host);
    let alive = true;
    import("./AvatarSlot").then(({ default: AvatarSlot }) => {
      if (alive) root.render(createElement(AvatarSlot, { childName: childName ?? "", size: 200 }));
    });
    return () => {
      alive = false;
      // unmount asynchronously: React forbids unmounting a root during another root's render/commit
      queueMicrotask(() => { root.unmount(); host.remove(); });
    };
  }, [childId, childName, section, ready]);
}
