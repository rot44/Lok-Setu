/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          light: "#F9F7F2",
          DEFAULT: "#F2EFE6",
          dark: "#E8E4D8",
          border: "#D8D4C5",
        },
        neel: {
          dark: "#1A2A3F",
          DEFAULT: "#263C59",
          light: "#3A557A",
          muted: "#4F688C",
        },
        vermilion: {
          light: "#DE644B",
          DEFAULT: "#C84C32",
          hover: "#B03E26",
          dark: "#8F2E1A",
        },
        sage: {
          light: "#E5E7D8",
          DEFAULT: "#D7D9C5",
          dark: "#BFC2A8",
        },
        mustard: {
          light: "#F0C773",
          DEFAULT: "#E4B65A",
          dark: "#C6963B",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
      },
      boxShadow: {
        editorial: "0 2px 0 0 rgba(38, 60, 89, 0.08)",
        "editorial-lg": "0 6px 0 0 rgba(38, 60, 89, 0.12)",
        stamped: "0 0 0 1px #D8D4C5, 0 2px 4px rgba(38, 60, 89, 0.05)",
      },
    },
  },
  plugins: [],
};
