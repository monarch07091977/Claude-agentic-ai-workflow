import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEECF9",
          100: "#DBD7F1",
          200: "#B9B0E3",
          400: "#7C6DC4",
          600: "#4C3F91",
          700: "#3B3172",
          900: "#211C43",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
