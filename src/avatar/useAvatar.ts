// src/avatar/useAvatar.ts — React state for one avatar: current state,
// dispatch(event), auto-return to idle after the hold, reduced-motion flag.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AvatarEvent, AvatarState } from "./types";
import { INITIAL_STATE, afterHold, motionFor, resolveReducedMotion, transition, type Motion } from "./stateMachine";
import { preloadAvatarAssets } from "./assets";

export interface UseAvatarOptions {
  /** Dev toggle: true/false forces reduced motion; undefined follows the OS setting. */
  reducedMotion?: boolean | null;
  initial?: AvatarState;
}

export interface UseAvatarResult {
  state: AvatarState;
  dispatch: (event: AvatarEvent) => void;
  reducedMotion: boolean;
  motion: Readonly<Motion>;
  lastEvent: AvatarEvent | null;
}

const QUERY = "(prefers-reduced-motion: reduce)";

export function useSystemReducedMotion(): boolean {
  const [pref, setPref] = useState<boolean>(() => typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const on = () => setPref(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return pref;
}

export function useAvatar(opts: UseAvatarOptions = {}): UseAvatarResult {
  const [state, setState] = useState<AvatarState>(opts.initial ?? INITIAL_STATE);
  const [lastEvent, setLastEvent] = useState<AvatarEvent | null>(null);
  const timer = useRef<number | null>(null);
  const system = useSystemReducedMotion();
  const reducedMotion = resolveReducedMotion(system, opts.reducedMotion);

  const clear = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };

  const dispatch = useCallback((event: AvatarEvent) => {
    if (event === "app:open") void preloadAvatarAssets();
    setLastEvent(event);
    setState((current) => {
      const { next, holdMs } = transition(current, event);
      clear();
      if (holdMs !== null) timer.current = window.setTimeout(() => { timer.current = null; setState((s) => afterHold(s)); }, holdMs);
      return next;
    });
  }, []);

  useEffect(() => () => clear(), []);

  return { state, dispatch, reducedMotion, motion: motionFor(reducedMotion), lastEvent };
}
