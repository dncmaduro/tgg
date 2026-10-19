import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d13",
        panel: "#11151f",
        line: "#252b38",
        mint: "#9ff3c7",
        coral: "#ff8066",
        lavender: "#b7a7ff",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(159,243,199,.14), 0 16px 70px rgba(0,0,0,.34)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-7px)" } },
        pulseSoft: { "0%, 100%": { opacity: "0.55" }, "50%": { opacity: "1" } },
      },
      animation: {
        float: "float 5s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
