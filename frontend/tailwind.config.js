/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"Geist"', '"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Geist"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // GitHub Primer dark palette
        gh: {
          canvas:      '#0d1117',
          canvasInset: '#010409',
          canvasOverlay:'#161b22',
          canvasSubtle:'#161b22',
          border:      '#30363d',
          borderMuted: '#21262d',
          fg:          '#e6edf3',
          fgMuted:     '#8b949e',
          fgSubtle:    '#6e7681',
          // Accents
          accentFg:    '#58a6ff',
          accentEmphasis: '#1f6feb',
          successFg:   '#3fb950',
          successEmphasis: '#238636',
          dangerFg:    '#f85149',
          dangerEmphasis: '#da3633',
          warningFg:   '#d29922',
          attentionFg: '#d29922',
          doneFg:      '#a371f7',
          sponsorFg:   '#db61a2',
        },
        // Keep surface aliases for backward compat
        surface: {
          800: '#161b22',
          900: '#0d1117',
          950: '#010409',
        },
        brand: {
          400: '#58a6ff',
          500: '#1f6feb',
          600: '#1158c7',
        },
        accent: {
          400: '#3fb950',
          500: '#238636',
        }
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'slide-in':  'slideIn 0.2s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'shimmer':   'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn:  { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.4)', opacity: 0.6 } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'overlay': '0 8px 24px rgba(1,4,9,0.75)',
        'input':   '0 0 0 3px rgba(31,111,235,0.3)',
      }
    }
  },
  plugins: [],
}
