// src/avatar/Avatar.tsx — <Avatar state size energy />: graphite stage card
// (radius 24), green energy ring, the character frame with a 250 ms crossfade,
// idle breathing + blink, sleep "z", celebrate sparks. Everything stops under
// prefers-reduced-motion (data-reduced) — see avatar.css.
import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "./types";
import { TEMUULEN, type CharacterAssets } from "./assets";
import "./avatar.css";

export interface AvatarProps {
  state: AvatarState;
  /** Card edge in px (square). */
  size?: number;
  /** Energy ring 0–100. */
  energy?: number;
  reducedMotion?: boolean;
  assets?: CharacterAssets;
  className?: string;
  /** Visible label for assistive tech, e.g. the child's name. */
  label?: string;
}

const SPARKS = [
  { dx: "-34%", dy: "-30%" }, { dx: "30%", dy: "-34%" }, { dx: "-40%", dy: "4%" },
  { dx: "40%", dy: "2%" }, { dx: "-20%", dy: "-44%" }, { dx: "18%", dy: "-46%" },
];

export default function Avatar({ state, size = 240, energy = 0, reducedMotion = false, assets = TEMUULEN, className, label }: AvatarProps) {
  const [prev, setPrev] = useState<AvatarState | null>(null);
  const lastState = useRef<AvatarState>(state);
  const crossfadeMs = reducedMotion ? 0 : 250;

  // Crossfade: keep the previous frame under the new one for 250 ms.
  useEffect(() => {
    if (lastState.current === state) return;
    const from = lastState.current;
    lastState.current = state;
    if (crossfadeMs === 0) { setPrev(null); return; }
    setPrev(from);
    const t = window.setTimeout(() => setPrev(null), crossfadeMs);
    return () => window.clearTimeout(t);
  }, [state, crossfadeMs]);

  const pct = Math.max(0, Math.min(100, Math.round(energy)));
  const r = 46, c = 2 * Math.PI * r;
  const eye = assets.eyeLine;

  return (
    <div
      className={["av-card", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, fontSize: size / 12 }}
      data-state={state}
      data-reduced={reducedMotion ? "true" : "false"}
      data-energy={pct}
      data-testid="avatar-stage"
      role="img"
      aria-label={`${label ?? assets.id}: ${state}, energy ${pct}%`}
    >
      <svg className="av-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="av-ring-track" cx="50" cy="50" r={r} strokeWidth="2.5" />
        <circle
          className="av-ring-value" cx="50" cy="50" r={r} strokeWidth="2.5"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="av-ground" style={{ top: `${3 + 92 * assets.baseline}%` }} aria-hidden="true" />
      <div className="av-figure">
        {prev && <img key={`out-${prev}`} className="av-img av-img-out" src={assets.src[prev]} alt="" aria-hidden="true" draggable={false} />}
        <div className="av-wrap">
          <img key={`in-${state}`} className="av-img av-img-in" src={assets.src[state]} alt="" draggable={false} />
          {state === "idle" && (
            <span className="av-blink" aria-hidden="true" style={{ left: `${eye.left}%`, top: `${eye.top}%`, width: `${eye.width}%`, height: `${eye.height}%` }} />
          )}
        </div>
        {state === "sleep" && (
          <div className="av-zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
        )}
        {state === "celebrate" && (
          <div className="av-sparks" aria-hidden="true" key={`sparks-${state}`}>
            {SPARKS.map((s, i) => <span key={i} className="av-spark" style={{ ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, animationDelay: `${i * 40}ms` }} />)}
          </div>
        )}
      </div>
      <div className="av-energy-label" aria-hidden="true">⚡ <b>{pct}%</b></div>
    </div>
  );
}
