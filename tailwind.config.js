/** @type {import('tailwindcss').Config} */
// Brand tokens — keep in sync with src/styles/tokens.css (docs/BRAND.md).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        bg: { DEFAULT: "#FFFFFF", soft: "#F4F7F2" },
        surface: { DEFAULT: "#FFFFFF", muted: "#EEF2EC" },
        ink: { DEFAULT: "#18251D", 2: "#3E4F46", 3: "#6E7D74" },
        line: { DEFAULT: "#DCE5DD", strong: "#B9C7BC" },
        primary: { DEFAULT: "#2F7D5B", hover: "#23634A", soft: "#DDF3E6", "soft-ink": "#1F5A42" },
        stage: { DEFAULT: "#18251D", 2: "#2A3D32", ink: "#FFFFFF", muted: "#C9D6CE" },
        gold: { DEFAULT: "#D4A24C", soft: "#FFF1C9" },
        silver: { DEFAULT: "#9CA3AF", soft: "#EEF0F2" },
        bronze: { DEFAULT: "#B45309", soft: "#FDE2C8" },
        warn: { DEFAULT: "#B45309", soft: "#FDE2C8" },
        error: { DEFAULT: "#B91C1C", soft: "#FEE2E2" },
      },
      borderRadius: {
        card: "16px",
        modal: "24px",
        input: "12px",
        image: "10px",
      },
      boxShadow: {
        float: "0 8px 24px rgba(28, 25, 23, 0.12)",
        none: "none",
      },
      transitionDuration: { DEFAULT: "180ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.2, 0.8, 0.25, 1)" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 180ms cubic-bezier(0.2,0.8,0.25,1) both",
      },
    },
  },
  plugins: [],
};
