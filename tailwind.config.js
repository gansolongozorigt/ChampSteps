/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        serif: ["Source Serif Pro", "Georgia", "ui-serif", "serif"],
      },
      colors: {
        // ChampSteps Slate+Gold design tokens
        cs: {
          slate: {
            950: "#1c1917",
            900: "#2c2825",
            600: "#57534e",
            400: "#a8a29e",
            200: "#e7e5e4",
             50: "#fafaf8",
          },
          gold: {
            600: "#d97706",
            400: "#fbbf24",
             50: "#fffbeb",
          },
          ai: "#4f46e5",
        },
      },
      // ── Анимэйшний суурь (ChampStep "амь оруулах") ──
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%":   { opacity: "0", transform: "scale(0.8)" },
          "60%":  { opacity: "1", transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.2,0.8,0.25,1) both",
        pop:       "pop 0.4s cubic-bezier(0.2,0.8,0.25,1) both",
      },
    },
  },
  plugins: [],
};