import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    // Poster-gradient class names (e.g. "from-rose-500 to-red-800") live in the
    // data/provider layer as strings — scan it too so JIT doesn't purge them.
    "./src/lib/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // Warm coral-amber accent — cinematic, not "safety orange".
        brand: {
          50: "#fff6ed",
          100: "#ffe9d5",
          200: "#fecfaa",
          300: "#fdad74",
          400: "#fb8039",
          500: "#f75f16",
          600: "#e8470c",
          700: "#c0330d",
          800: "#992b13",
          900: "#7c2713",
        },
        // Deep warm charcoal for dark surfaces.
        ink: {
          950: "#0c0a10",
          900: "#141019",
          800: "#1d1826",
          700: "#2a2334",
          600: "#3a3245",
        },
        // Warm-tinted neutral surface used across light UI.
        sand: {
          50: "#faf8f5",
          100: "#f4f1ec",
          200: "#e8e3da",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,19,34,0.04), 0 8px 24px -12px rgba(16,19,34,0.14)",
        "card-hover": "0 8px 20px -8px rgba(16,19,34,0.18), 0 24px 48px -20px rgba(16,19,34,0.22)",
        glow: "0 6px 20px rgba(247,95,22,0.4)",
      },
      keyframes: {
        "float-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "float-in": "float-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
