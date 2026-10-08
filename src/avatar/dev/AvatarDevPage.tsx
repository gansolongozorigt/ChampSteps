// src/avatar/dev/AvatarDevPage.tsx — /dev/avatar playground.
// Registered in main.tsx only when import.meta.env.DEV || VITE_AVATAR_DEV=1
// (dynamic import → no chunk in a flag-off production build). No sign-in.
// Plain CSS/inline styles only (see avatar.css header for why no Tailwind here).
import { useState } from "react";
import Avatar from "../Avatar";
import { useAvatar } from "../useAvatar";
import { AVATAR_EVENTS, type AvatarEvent } from "../types";

const GREEN = "#2F7D5B", GRAPHITE = "#18251D";

export default function AvatarDevPage() {
  const [override, setOverride] = useState<boolean | null>(null);
  const [energy, setEnergy] = useState(62);
  const [log, setLog] = useState<Array<{ event: AvatarEvent; at: string }>>([]);
  const { state, dispatch, reducedMotion } = useAvatar({ reducedMotion: override });

  const fire = (event: AvatarEvent) => {
    dispatch(event);
    setLog((l) => [{ event, at: new Date().toLocaleTimeString() }, ...l].slice(0, 5));
  };

  const btn: React.CSSProperties = { background: GREEN, color: "#fff", border: 0, borderRadius: 10, padding: "10px 14px", font: "600 13px/1 ui-sans-serif, system-ui, sans-serif", cursor: "pointer" };

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f4", color: GRAPHITE, font: "14px/1.5 ui-sans-serif, system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 20 }}>Avatar dev · Temuulen</h1>
          <p style={{ margin: "4px 0 0", color: "#5b6b62" }}>Branch prototype. State: <code data-testid="avatar-state">{state}</code> · reduced motion: <code data-testid="avatar-reduced">{String(reducedMotion)}</code></p>
        </header>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Avatar state={state} size={280} energy={energy} reducedMotion={reducedMotion} label="Temuulen" />
        </div>

        <section aria-label="events" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {AVATAR_EVENTS.map((e) => (
            <button key={e} type="button" style={btn} data-testid={`evt-${e.replace(":", "-")}`} onClick={() => fire(e)}>{e}</button>
          ))}
        </section>

        <section style={{ display: "grid", gap: 12, background: "#fff", borderRadius: 16, padding: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Эрч хүч: <b data-testid="energy-value">{energy}%</b></span>
            <input type="range" min={0} max={100} value={energy} data-testid="energy-slider" onChange={(ev) => setEnergy(Number(ev.target.value))} style={{ accentColor: GREEN }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" data-testid="reduced-toggle" checked={reducedMotion} onChange={(ev) => setOverride(ev.target.checked)} style={{ accentColor: GREEN }} />
            <span>prefers-reduced-motion (toggle overrides the OS setting)</span>
            {override !== null && <button type="button" onClick={() => setOverride(null)} style={{ ...btn, background: "#8a948e", padding: "6px 10px" }}>OS дагах</button>}
          </label>
        </section>

        <section style={{ background: "#fff", borderRadius: 16, padding: 16 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>Сүүлийн 5 event</h2>
          <ol data-testid="event-log" style={{ margin: 0, paddingLeft: 18 }}>
            {log.length === 0 && <li style={{ listStyle: "none", marginLeft: -18, color: "#8a948e" }}>—</li>}
            {log.map((l, i) => <li key={i}><code>{l.event}</code> <span style={{ color: "#8a948e" }}>{l.at}</span></li>)}
          </ol>
        </section>
      </div>
    </main>
  );
}
