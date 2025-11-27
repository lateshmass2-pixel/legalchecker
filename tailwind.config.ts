import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        foreground: "#ededed",
        card: {
          DEFAULT: "#111111",
          foreground: "#ededed",
        },
        popover: {
          DEFAULT: "#111111",
          foreground: "#ededed",
        },
        primary: {
          DEFAULT: "#0066ff",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#1a1a1a",
          foreground: "#ededed",
        },
        muted: {
          DEFAULT: "#1a1a1a",
          foreground: "#888888",
        },
        accent: {
          DEFAULT: "#1a1a1a",
          foreground: "#ededed",
        },
        destructive: {
          DEFAULT: "#ff4444",
          foreground: "#ffffff",
        },
        border: "#222222",
        input: "#222222",
        ring: "#0066ff",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
