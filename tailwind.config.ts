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
        /* Client Brand & Surface Tokens (supports opacity modifiers like /10, /40, /90) */
        "client-primary": "rgb(var(--brand-primary-rgb) / <alpha-value>)",
        "client-primary-hover": "rgb(var(--brand-primary-hover-rgb) / <alpha-value>)",
        "client-deep": "rgb(var(--brand-deep-rgb) / <alpha-value>)",
        "client-soft": "rgb(var(--brand-soft-rgb) / <alpha-value>)",
        "client-border": "rgb(var(--brand-border-rgb) / <alpha-value>)",
        "client-accent": "rgb(var(--brand-accent-rgb) / <alpha-value>)",
        "client-accent-hover": "rgb(var(--brand-accent-hover-rgb) / <alpha-value>)",
        "client-sun": "rgb(var(--brand-sun-rgb) / <alpha-value>)",
        "client-star": "rgb(var(--brand-sun-rgb) / <alpha-value>)",
        "status-success": "rgb(var(--status-success-rgb) / <alpha-value>)",
        "status-success-bg": "rgb(var(--status-success-bg-rgb) / <alpha-value>)",
        "status-success-border": "rgb(var(--status-success-border-rgb) / <alpha-value>)",
        "status-warn": "rgb(var(--status-warn-rgb) / <alpha-value>)",
        "status-warn-bg": "rgb(var(--status-warn-bg-rgb) / <alpha-value>)",
        "status-warn-border": "rgb(var(--status-warn-border-rgb) / <alpha-value>)",
        "status-danger": "rgb(var(--status-danger-rgb) / <alpha-value>)",
        "status-danger-bg": "rgb(var(--status-danger-bg-rgb) / <alpha-value>)",
        "status-danger-border": "rgb(var(--status-danger-border-rgb) / <alpha-value>)",
        "surface-page": "rgb(var(--surface-page-rgb) / <alpha-value>)",
        "surface-muted": "rgb(var(--surface-muted-rgb) / <alpha-value>)",
        "border-subtle": "rgb(var(--border-subtle-rgb) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong-rgb) / <alpha-value>)",
        ink: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        "ink-muted": "rgb(var(--text-secondary-rgb) / <alpha-value>)",

        /* Admin Portal Tokens (kept strictly separate) */
        "admin-primary": "#4880FF",
        "admin-bg": "#F5F6FA",
        "admin-text": "#202224",
        "admin-border": "#E0E0E0",
      },
      borderColor: {
        subtle: "rgb(var(--border-subtle-rgb) / <alpha-value>)",
        strong: "rgb(var(--border-strong-rgb) / <alpha-value>)",
      },
      divideColor: {
        subtle: "rgb(var(--border-subtle-rgb) / <alpha-value>)",
        strong: "rgb(var(--border-strong-rgb) / <alpha-value>)",
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
