/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkbg: '#0D1117',
        darksurface: '#161B22',
        darkborder: '#30363D',
        primary: {
          DEFAULT: '#7C3AED',
          hover: '#6D28D9',
        },
        accent: {
          DEFAULT: '#06B6D4',
          hover: '#0891B2',
        },
        textmain: '#E6EDF3',
        textmuted: '#8B949E',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
