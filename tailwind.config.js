/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg:              'rgb(var(--c-bg)              / <alpha-value>)',
          panel:           'rgb(var(--c-panel)           / <alpha-value>)',
          card:            'rgb(var(--c-card)            / <alpha-value>)',
          border:          'rgb(var(--c-border)          / <alpha-value>)',
          amber:           'rgb(var(--c-amber)           / <alpha-value>)',
          'amber-dim':     'rgb(var(--c-amber-dim)       / <alpha-value>)',
          green:           'rgb(var(--c-green)           / <alpha-value>)',
          red:             'rgb(var(--c-red)             / <alpha-value>)',
          blue:            '#3b82f6',
          'text-primary':  'rgb(var(--c-text-primary)    / <alpha-value>)',
          'text-secondary':'rgb(var(--c-text-secondary)  / <alpha-value>)',
          'text-dim':      'rgb(var(--c-text-dim)        / <alpha-value>)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-amber': 'pulse-amber 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'check-bounce': 'check-bounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      keyframes: {
        'pulse-amber': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'check-bounce': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        }
      },
      boxShadow: {
        'cockpit': '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        'amber-glow': '0 0 12px rgba(245,158,11,0.3)',
        'green-glow': '0 0 12px rgba(34,197,94,0.3)',
        'red-glow': '0 0 20px rgba(239,68,68,0.4)',
      }
    },
  },
  plugins: [],
}
