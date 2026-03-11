/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "progress-slide": {
          "0%":   { transform: "translateX(-166%)" },
          "100%": { transform: "translateX(266%)" },
        },
      },
      animation: {
        "progress-slide": "progress-slide 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
