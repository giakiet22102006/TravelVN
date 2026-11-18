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
        "client-primary": "#4502C7",
        "admin-primary": "#4880FF",
        "admin-bg": "#F5F6FA",
        "admin-text": "#202224",
        "admin-border": "#E0E0E0",
      },
      fontFamily: {
        "be-vietnam": ["var(--font-be-vietnam)", "sans-serif"],
        "lexend-deca": ["var(--font-lexend-deca)", "sans-serif"],
        "nunito-sans": ["var(--font-nunito-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
