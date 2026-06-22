export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: "var(--tg-theme-bg-color, #111318)",
          text: "var(--tg-theme-text-color, #f5f7fb)",
          hint: "var(--tg-theme-hint-color, #8f98a8)",
          button: "var(--tg-theme-button-color, #2f7cf6)",
          buttonText: "var(--tg-theme-button-text-color, #ffffff)",
          secondary: "var(--tg-theme-secondary-bg-color, #1b1f2a)"
        }
      }
    }
  },
  plugins: []
};
