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
    },
  },
  plugins: [],
};