import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          deep: "#08111f",
        },
        ice: {
          DEFAULT: "#cfe8ff",
        },
        glass: {
          blue: "#a0cdff",
          border: "#c8e4ff",
        },
        // Logo gradient pastel ring colors
        pastel: {
          gold: "#f5d061",
          pink: "#f3a6b6",
          blue: "#a2d2ff",
          purple: "#b388ff",
        },
        // Sky Blue theme color tokens
        sky: {
          page: "#d7e9fc",      // page background wash
          topbar: "#e9f3fe",    // header background
          sidebarTop: "#bfdcfb",
          sidebarBot: "#a8cdf7",
          border: "#a8cdf7",
          cardBorder: "#bcdcfb",
        },
        ink: {
          DEFAULT: "#153a63",
          dim: "#3f6690",
          icon: "#2c5f96",
        },
        ursb: {
          DEFAULT: "#1f6fc4",
          dark: "#155a94",
        },
        badge: {
          greenBg: "#dcf6e8",
          greenText: "#1a8a53",
          blueBg: "#dbeafe",
          blueText: "#1f6fc4",
          amberBg: "#fdf0d4",
          amberText: "#a5720c",
          roseBg: "#fde3e3",
          roseText: "#c23b3b",
          greyBg: "#eef2f7",
          greyText: "#5c7290",
        },
        stat: {
          amberChip: "#fff1d6",
          amberIcon: "#a5720c",
          greenChip: "#d9f6e6",
          greenIcon: "#188a55",
          blueChip: "#dbeafe",
          blueIcon: "#1f6fc4",
          roseChip: "#fde3e3",
          roseIcon: "#c23b3b",
          purpleChip: "#ede9fe",
          purpleIcon: "#7c3aed",
          tealChip: "#ccfbf1",
          tealIcon: "#0d9488",
          indigoChip: "#e0e7ff",
          indigoIcon: "#4f46e5",
        },
        white: {
          DEFAULT: "#ffffff",
        },
        red: {
          400: "#f87171",
          500: "#ef4444",
        },
        emerald: {
          200: "#a7f3d0",
          400: "#34d399",
          500: "#10b981",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      keyframes: {
        kenburns: {
          "0%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1.16)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(-2deg)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        statIn: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        kenburns: "kenburns 6s linear forwards",
        float: "float 4.5s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-out forwards",
        statIn: "statIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      transitionDuration: {
        "350": "350ms",
      },
      animationDelay: {
        "75": "75ms",
        "150": "150ms",
        "200": "200ms",
        "300": "300ms",
        "500": "500ms",
        "700": "700ms",
      },
    },
  },
  plugins: [
    function ({ matchUtilities, theme }: { matchUtilities: (utils: Record<string, (value: string) => Record<string, string>>, config: { values: Record<string, string> }) => void; theme: (path: string) => Record<string, string> }) {
      matchUtilities(
        {
          "anim-delay": (value: string) => ({
            animationDelay: value,
          }),
        },
        { values: theme("animationDelay") },
      );
    },
  ],
  corePlugins: {
    preflight: false,
  },
} satisfies Config;
