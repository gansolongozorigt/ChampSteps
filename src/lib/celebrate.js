// Амжилт нэмэхэд алтан очлол цацрах баярын эффект (сан ашиглахгүй)
export function celebrate() {
    if (typeof window === "undefined")
        return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        return;
    const colors = ["#fbbf24", "#f59e0b", "#d97706", "#fde68a", "#ffffff"];
    const container = document.createElement("div");
    container.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
    document.body.appendChild(container);
    const count = 90;
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        const size = 6 + Math.random() * 7;
        const left = 50 + (Math.random() - 0.5) * 24;
        const round = Math.random() > 0.5;
        p.style.cssText =
            `position:absolute;top:42%;left:${left}%;width:${size}px;height:${size}px;` +
                `background:${colors[i % colors.length]};` +
                `border-radius:${round ? "50%" : "2px"};`;
        container.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const velocity = 100 + Math.random() * 200;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity - 140;
        const rot = (Math.random() - 0.5) * 720;
        p.animate([
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            {
                transform: `translate(${dx}px, ${dy + 360}px) rotate(${rot}deg)`,
                opacity: 0,
            },
        ], { duration: 1200 + Math.random() * 700, easing: "cubic-bezier(.15,.6,.4,1)" });
    }
    setTimeout(() => container.remove(), 2200);
}
