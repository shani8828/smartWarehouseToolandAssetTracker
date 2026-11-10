import type { Config } from "tailwindcss";

// Palette matched to the final presentation (BTP_Final_Presentation_updated.pptx):
// deep navy background #010638, royal title band #002191, electric-blue card
// gradient #1C2FE7 -> #1121C7 -> #010638, periwinkle highlight #6F86FF.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#002191",
          50: "#EEF1FF",
          100: "#DDE3FF",
          600: "#1121C7",
          700: "#1C2FE7",
          950: "#010638",
        },
        periwinkle: { DEFAULT: "#6F86FF" },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #1C2FE7 0%, #1121C7 45%, #010638 100%)",
        "brand-night":
          "radial-gradient(ellipse 70% 50% at 0% 75%, rgba(0,153,230,0.55), transparent 70%), radial-gradient(ellipse 40% 45% at 90% 0%, rgba(28,47,231,0.45), transparent 70%), linear-gradient(180deg, #010638 0%, #001a6e 60%, #010638 100%)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
