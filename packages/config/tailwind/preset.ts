import type { Config } from "tailwindcss";

const glassPreset = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        glass: {
          surface: "hsl(var(--glass-surface) / <alpha-value>)",
          edge: "hsl(var(--glass-edge) / <alpha-value>)",
          glow: "hsl(var(--glass-glow) / <alpha-value>)",
          reflection: "hsl(var(--glass-reflection) / <alpha-value>)",
        },
      },
      borderRadius: {
        glass: "var(--radius-glass)",
        control: "var(--radius-control)",
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        "glass-soft": "var(--shadow-glass-soft)",
        "inner-glass": "var(--shadow-inner-glass)",
      },
      backdropBlur: {
        glass: "22px",
        "glass-strong": "34px",
      },
      backgroundImage: {
        "jposta-gradient":
          "radial-gradient(circle at 18% 12%, hsl(var(--gradient-a) / 0.35), transparent 34%), radial-gradient(circle at 82% 4%, hsl(var(--gradient-b) / 0.22), transparent 32%), linear-gradient(135deg, hsl(var(--gradient-c)), hsl(var(--gradient-d)))",
        "glass-highlight":
          "linear-gradient(145deg, hsl(var(--glass-reflection) / 0.34), hsl(var(--glass-surface) / 0.08) 45%, transparent 100%)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
} satisfies Partial<Config>;

export default glassPreset;
