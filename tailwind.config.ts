import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111113",
        subtle: "#6b6b70",
        border: "#e5e5e8",
        surface: "#fafafa",
        accent: "#111113",
        gold: "#b8860b",
        // RepHear brand purple — official gradient #7B4DFF → #4285F4,
        // sourced from the marketing poster renderer
        // (~/workspace/rephear-posters/render.py: HEAR_A/HEAR_B).
        brand: "#7B4DFF",
        "brand-deep": "#4285F4",
        "brand-soft": "#EFEAFF",
        "brand-ink": "#5B2EE5",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
