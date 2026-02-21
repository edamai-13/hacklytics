import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chord: {
          C: "#ef4444",
          D: "#f97316",
          Dm: "#fb923c",
          E: "#eab308",
          Em: "#84cc16",
          F: "#22c55e",
          G: "#06b6d4",
          A: "#3b82f6",
          Am: "#8b5cf6",
          B7: "#ec4899",
        },
      },
    },
  },
  plugins: [],
};

export default config;
