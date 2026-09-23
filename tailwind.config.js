/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cks: {
          primary: "var(--color-cks-primary)",
          hover: "var(--color-cks-primary-hover)",
          pressed: "var(--color-cks-primary-pressed)",
          soft: "var(--color-cks-primary-soft)",
        },
        savt: {
          green: "var(--color-savt-reward)",
          dark: "var(--color-savt-reward-dark)",
          light: "var(--color-savt-reward-soft)",
          ink: "var(--color-text)",
        },
        app: {
          background: "var(--color-background)",
          surface: "var(--color-surface)",
          border: "var(--color-border)",
          ink: "var(--color-text)",
          muted: "var(--color-text-muted)",
          info: "var(--color-info)",
          warning: "var(--color-warning)",
          error: "var(--color-error)",
          success: "var(--color-success)",
        },
      },
      borderRadius: {
        control: "var(--radius-button)",
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        lift: "var(--shadow-lift)",
        button: "var(--shadow-button)",
        nav: "var(--shadow-navigation)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        "heading-large": [
          "var(--text-heading-large)",
          { lineHeight: "var(--leading-heading-large)" },
        ],
        heading: [
          "var(--text-heading)",
          { lineHeight: "var(--leading-heading)" },
        ],
        body: ["var(--text-body)", { lineHeight: "var(--leading-body)" }],
        meta: ["var(--text-meta)", { lineHeight: "var(--leading-meta)" }],
      },
    },
  },
  plugins: [],
};
