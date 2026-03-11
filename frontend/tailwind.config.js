/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:  ["'DM Sans'", 'sans-serif'],
        mono:  ["'Space Mono'", 'monospace'],
        display: ["'Space Mono'", 'monospace'],
      },
    }
  },
  plugins: [],
}
