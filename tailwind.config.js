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
          accent:          'rgb(var(--c-accent)          / <alpha-value>)',
          'accent-dim':    'rgb(var(--c-accent-dim)      / <alpha-value>)',
          'accent-bright': 'rgb(var(--c-accent-bright)   / <alpha-value>)',
          'on-accent':     'rgb(var(--c-on-accent)       / <alpha-value>)',
          caution:         'rgb(var(--c-caution)         / <alpha-value>)',
          'caution-dim':   'rgb(var(--c-caution-dim)     / <alpha-value>)',
          'caution-soft':  'rgb(var(--c-caution-soft)    / <alpha-value>)',
          red:             'rgb(var(--c-red)             / <alpha-value>)',
          extrapolated:    'rgb(var(--c-extrapolated)    / <alpha-value>)',
          'cat-sep':       'rgb(var(--c-cat-sep)         / <alpha-value>)',
          'cat-sep-deep':  'rgb(var(--c-cat-sep-deep)    / <alpha-value>)',
          'cat-mep':       'rgb(var(--c-cat-mep)         / <alpha-value>)',
          'cat-mep-deep':  'rgb(var(--c-cat-mep-deep)    / <alpha-value>)',
          'cat-tp':        'rgb(var(--c-cat-tp)          / <alpha-value>)',
          'cat-tp-deep':   'rgb(var(--c-cat-tp-deep)     / <alpha-value>)',
          'cat-jet':       'rgb(var(--c-cat-jet)         / <alpha-value>)',
          'cat-jet-deep':  'rgb(var(--c-cat-jet-deep)    / <alpha-value>)',
          'cat-heli':      'rgb(var(--c-cat-heli)        / <alpha-value>)',
          'cat-heli-deep': 'rgb(var(--c-cat-heli-deep)   / <alpha-value>)',
          info:            'rgb(var(--c-info)            / <alpha-value>)',
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
        'pulse-accent': 'pulse-accent 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'check-bounce': 'check-bounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      keyframes: {
        'pulse-accent': {
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
        'accent-glow': '0 0 12px rgb(var(--c-accent) / 0.3)',
        'red-glow': '0 0 20px rgb(var(--c-red) / 0.4)',
      }
    },
  },
  plugins: [],
}
