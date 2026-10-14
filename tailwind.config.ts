import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        nirmaan: {
          navy: "#0F172A",
          darkNavy: "#0B1120",
          cardNavy: "#1E293B",
          lightNavy: "#334155",
          aqua: "#0284C7",
          cyan: "#06B6D4",
          sky: "#38BDF8",
          ice: "#E0F2FE",
          surface: "#F8FAFC",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.08)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px -2px rgba(2, 132, 199, 0.35)",
        "glow-rose": "0 0 20px -2px rgba(244, 63, 94, 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
