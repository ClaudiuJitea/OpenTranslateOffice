import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#F5F2EE",
        stone: "#C8B8A2",
        accent: "#E84C3D"
      },
      borderRadius: {
        none: "0px"
      },
      fontFamily: {
        sans: ["Inter Tight", "Inter", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
