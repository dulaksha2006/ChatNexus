/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Image-extracted palette
        cn: {
          bg:       '#252b2b',   // darkest bg
          surface:  '#2d3333',   // card/sidebar bg
          border:   '#3a4040',   // borders
          borderSub:'#323838',   // subtle borders
          fg:       '#ffffff',   // primary text
          fgMuted:  '#a8b4b4',   // muted text
          fgSubtle: '#6b7878',   // subtle text
          green:    '#22b14c',   // success / primary action
          greenHov: '#1d9e42',   // green hover
          greenDim: 'rgba(34,177,76,0.12)',
          blue:     '#1474d4',   // info / secondary action
          blueHov:  '#1266be',
          blueDim:  'rgba(20,116,212,0.12)',
          red:      '#e05050',
          redDim:   'rgba(224,80,80,0.12)',
          amber:    '#d4a017',
          amberDim: 'rgba(212,160,23,0.12)',
        },
        // Aliases for existing code
        surface: { 800: '#2d3333', 900: '#252b2b', 950: '#1c2020' },
        brand:   { 400: '#4d9fe0', 500: '#1474d4', 600: '#1266be' },
        accent:  { 400: '#2dcc5e', 500: '#22b14c' },
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.22s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-dot':'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(-6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.4)', opacity: 0.6 } },
      },
      boxShadow: {
        overlay: '0 8px 32px rgba(0,0,0,0.5)',
        input:   '0 0 0 3px rgba(20,116,212,0.25)',
        green:   '0 0 0 3px rgba(34,177,76,0.25)',
      }
    }
  },
  plugins: [],
}
