import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// ChampMascot — animated SVG trophy mascot
// Props:
//   size    — pixel size (default 32)
//   mood    — "idle" | "happy" | "excited" (default "idle")
//   animate — whether to play idle float animation (default false)
// =============================================================================
import { useEffect, useState } from "react";
export default function ChampMascot({ size = 32, mood = "idle", animate = false, className = "", }) {
    const [frame, setFrame] = useState(0);
    // Idle float: oscillate y offset
    useEffect(() => {
        if (!animate)
            return;
        const id = setInterval(() => setFrame((f) => f + 1), 600);
        return () => clearInterval(id);
    }, [animate]);
    const floatY = animate ? (frame % 2 === 0 ? -1.5 : 1.5) : 0;
    // Eyes by mood
    const eyes = {
        idle: (_jsxs(_Fragment, { children: [_jsx("circle", { cx: "18", cy: "19", r: "1.5", fill: "#1c1917" }), _jsx("circle", { cx: "26", cy: "19", r: "1.5", fill: "#1c1917" })] })),
        happy: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M16.5 19.5 Q18 17.5 19.5 19.5", stroke: "#1c1917", strokeWidth: "1.5", fill: "none", strokeLinecap: "round" }), _jsx("path", { d: "M24.5 19.5 Q26 17.5 27.5 19.5", stroke: "#1c1917", strokeWidth: "1.5", fill: "none", strokeLinecap: "round" })] })),
        excited: (_jsxs(_Fragment, { children: [_jsx("text", { x: "15.5", y: "21.5", fontSize: "5", fill: "#d97706", children: "\u2605" }), _jsx("text", { x: "23.5", y: "21.5", fontSize: "5", fill: "#d97706", children: "\u2605" })] })),
    };
    // Mouth by mood
    const mouth = {
        idle: _jsx("path", { d: "M19 23.5 Q22 25 25 23.5", stroke: "#1c1917", strokeWidth: "1.2", fill: "none", strokeLinecap: "round" }),
        happy: _jsx("path", { d: "M18.5 23 Q22 26.5 25.5 23", stroke: "#1c1917", strokeWidth: "1.4", fill: "none", strokeLinecap: "round" }),
        excited: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M18 23 Q22 27.5 26 23", stroke: "#1c1917", strokeWidth: "1.5", fill: "none", strokeLinecap: "round" }), _jsx("path", { d: "M18 23 Q22 27.5 26 23 Q22 27.5 18 23", fill: "#fde68a" })] })),
    };
    // Sparkles visible when excited
    const sparkles = mood === "excited" && (_jsxs(_Fragment, { children: [_jsx("text", { x: "2", y: "10", fontSize: "7", fill: "#fbbf24", style: { animation: "none" }, children: "\u2726" }), _jsx("text", { x: "34", y: "8", fontSize: "6", fill: "#fbbf24", children: "\u2726" }), _jsx("text", { x: "38", y: "20", fontSize: "5", fill: "#d97706", children: "\u2726" })] }));
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 44 44", fill: "none", className: className, style: {
            transform: `translateY(${floatY}px)`,
            transition: "transform 0.5s ease-in-out",
            display: "inline-block",
        }, "aria-hidden": "true", children: [sparkles, _jsx("path", { d: "M13 8 H31 L28 22 Q22 27 16 22 Z", fill: "url(#cg1)", stroke: "#d97706", strokeWidth: "0.8" }), _jsx("rect", { x: "19.5", y: "22", width: "5", height: "5", rx: "0.5", fill: "#d97706" }), _jsx("rect", { x: "15", y: "27", width: "14", height: "3", rx: "1.5", fill: "#fbbf24" }), _jsx("path", { d: "M13 10 Q7 13 9 18 Q11 21 14 20", stroke: "#fbbf24", strokeWidth: "2", fill: "none", strokeLinecap: "round" }), _jsx("path", { d: "M31 10 Q37 13 35 18 Q33 21 30 20", stroke: "#fbbf24", strokeWidth: "2", fill: "none", strokeLinecap: "round" }), _jsx("ellipse", { cx: "22", cy: "20", rx: "7", ry: "6.5", fill: "#fef3c7" }), eyes[mood], (mood === "happy" || mood === "excited") && (_jsxs(_Fragment, { children: [_jsx("ellipse", { cx: "16.5", cy: "22.5", rx: "2", ry: "1.2", fill: "#fca5a5", fillOpacity: "0.5" }), _jsx("ellipse", { cx: "27.5", cy: "22.5", rx: "2", ry: "1.2", fill: "#fca5a5", fillOpacity: "0.5" })] })), mouth[mood], _jsx("path", { d: "M16 9.5 L18 6.5 L20 9 L22 5 L24 9 L26 6.5 L28 9.5", stroke: "#fbbf24", strokeWidth: "1.5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("defs", { children: _jsxs("linearGradient", { id: "cg1", x1: "13", y1: "8", x2: "31", y2: "27", gradientUnits: "userSpaceOnUse", children: [_jsx("stop", { offset: "0%", stopColor: "#fbbf24" }), _jsx("stop", { offset: "100%", stopColor: "#d97706" })] }) })] }));
}
