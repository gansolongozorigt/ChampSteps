// Амжилт нэмэхэд баярын confetti цацрах эффект (сан ашиглахгүй)
// mega=true (алтан медаль) → брэндийн өнгө + медалийн алт, том дэлбэрэлт; үгүй → брэндийн ногоон/цагаан/graphite
export function celebrate(opts: { mega?: boolean } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const mega = !!opts.mega;
  // Brand confetti (docs/BRAND.md): green / soft green / white / graphite; gold medal adds the medal gold.
  const brandPalette = ["#2F7D5B", "#DDF3E6", "#FFFFFF", "#18251D"];
  const goldMedalPalette = [...brandPalette, "#D4A24C", "#FFF1C9"];
  const colors = mega ? goldMedalPalette : brandPalette;
  const count = mega ? 150 : 90;
  const spreadX = mega ? 36 : 24;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * (mega ? 9 : 7);
    const left = 50 + (Math.random() - 0.5) * spreadX;
    const round = Math.random() > 0.5;
    p.style.cssText =
      `position:absolute;top:42%;left:${left}%;width:${size}px;height:${size}px;` +
      `background:${colors[i % colors.length]};` +
      `border-radius:${round ? "50%" : "2px"};`;
    container.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const velocity = (mega ? 140 : 100) + Math.random() * (mega ? 260 : 200);
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity - (mega ? 200 : 140);
    const rot = (Math.random() - 0.5) * 720;

    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 380}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: (mega ? 1400 : 1200) + Math.random() * 700, easing: "cubic-bezier(.15,.6,.4,1)" }
    );
  }

  setTimeout(() => container.remove(), mega ? 2600 : 2200);
}
