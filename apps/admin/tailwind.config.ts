import glassPreset from "@jposta/config/tailwind/preset";
import type { Config } from "tailwindcss";

const config = {
  presets: [glassPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;

export default config;
