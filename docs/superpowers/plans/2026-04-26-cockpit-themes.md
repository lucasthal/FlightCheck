# Cockpit Theme Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static hex cockpit color tokens with CSS custom properties so all three themes (dark/night/day) work correctly with Tailwind opacity modifiers, fixing the invisible table-header bug and landing pilot-optimized palettes.

**Architecture:** CSS variables declared on `:root` (dark default), `.theme-night`, and `.theme-day` replace the static hex values in `tailwind.config.js`. Tailwind generates `rgb(var(--c-x) / <alpha-value>)` utilities that resolve correctly in every theme, including opacity-modifier variants like `bg-cockpit-panel/60`. All old hand-rolled class overrides in `index.css` are deleted — no longer needed.

**Tech Stack:** Tailwind CSS v3 (CSS variable + `<alpha-value>` pattern), plain CSS custom properties, Vite (build/dev server)

---

## File Map

| File | Change |
|---|---|
| `tailwind.config.js` | Replace 11 hex cockpit tokens with `rgb(var(--c-x) / <alpha-value>)` references; keep `cockpit.blue` as static hex (used in ChecklistItems.tsx, not themed) |
| `src/index.css` | Add `:root`, `.theme-night`, `.theme-day` variable blocks; delete the entire Night/Day theme overrides section (lines 23–41) |

---

## Task 1: Migrate tailwind.config.js to CSS variable tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace the cockpit color block**

Open `tailwind.config.js`. Find the `cockpit:` object (lines 8–21) and replace it with:

```js
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
```

Note: `blue` keeps its static hex — it's used in `ChecklistItems.tsx` and is intentionally not themed differently across modes.

The full resulting `tailwind.config.js`:

```js
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
```

- [ ] **Step 2: Verify the build passes**

```bash
npm run build
```

Expected: build completes with no errors. If you see "Cannot read CSS variable" or "unknown utility", the variable syntax is wrong — check that `<alpha-value>` is typed literally (Tailwind replaces it at build time).

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: migrate cockpit color tokens to CSS variable references"
```

---

## Task 2: Add CSS variable declarations and remove old theme overrides

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the CSS variable blocks**

Add the following three blocks immediately after `@tailwind utilities;` (before `@layer base {`). These declare space-separated RGB channels — NOT hex values. Tailwind's `rgb(var(--c-x) / <alpha-value>)` pattern requires this format.

```css
/* ─── Theme color variables ────────────────────────────────────── */
:root {
  --c-bg:             10 14 26;
  --c-panel:          15 23 42;
  --c-card:           30 41 59;
  --c-border:         51 65 85;
  --c-text-primary:   226 232 240;
  --c-text-secondary: 148 163 184;
  --c-text-dim:       71 85 105;
  --c-amber:          245 158 11;
  --c-amber-dim:      180 83 9;
  --c-green:          34 197 94;
  --c-red:            239 68 68;
}

.theme-night {
  --c-bg:             4 1 0;
  --c-panel:          8 2 0;
  --c-card:           16 4 0;
  --c-border:         45 12 0;
  --c-text-primary:   204 58 0;
  --c-text-secondary: 122 34 0;
  --c-text-dim:       61 16 0;
  --c-amber:          204 58 0;
  --c-amber-dim:      122 34 0;
  --c-green:          153 68 0;
  --c-red:            187 0 0;
}

.theme-day {
  --c-bg:             238 242 247;
  --c-panel:          255 255 255;
  --c-card:           244 247 251;
  --c-border:         203 213 225;
  --c-text-primary:   15 23 42;
  --c-text-secondary: 55 65 81;
  --c-text-dim:       107 114 128;
  --c-amber:          217 119 6;
  --c-amber-dim:      146 64 14;
  --c-green:          21 128 61;
  --c-red:            220 38 38;
}
```

- [ ] **Step 2: Delete the old Night/Day theme overrides section**

Remove lines 23–41 from `src/index.css` — the entire block between `/* ─── Night / Day theme overrides */` and the `/* ─── Aircraft cards */` comment. This is the block being deleted:

```css
  /* ─── Night / Day theme overrides ──────────────────────────────── */
  .theme-night .text-cockpit-text-primary  { color: #f0a820; }
  .theme-night .text-cockpit-text-secondary{ color: #c07818; }
  .theme-night .text-cockpit-text-dim      { color: #6b4a10; }
  .theme-night .bg-cockpit-bg              { background-color: #050300; }
  .theme-night .bg-cockpit-panel           { background-color: #080500; }
  .theme-night .bg-cockpit-card            { background-color: #0d0800; }
  .theme-night .border-cockpit-border      { border-color: #3a2000; }
  .theme-night .stroke-cockpit-card        { stroke: #1a1000; }

  .theme-day body                          { @apply bg-slate-50; }
  .theme-day .bg-cockpit-bg               { background-color: #f1f5f9; }
  .theme-day .bg-cockpit-panel            { background-color: #ffffff; }
  .theme-day .bg-cockpit-card             { background-color: #f8fafc; }
  .theme-day .text-cockpit-text-primary   { color: #0f172a; }
  .theme-day .text-cockpit-text-secondary { color: #334155; }
  .theme-day .text-cockpit-text-dim       { color: #64748b; }
  .theme-day .border-cockpit-border       { border-color: #e2e8f0; }
  .theme-day .stroke-cockpit-card         { stroke: #e2e8f0; }
```

After deletion the `@layer components {` block should open directly with `/* ─── Aircraft cards ───`.

- [ ] **Step 3: Verify the full resulting index.css**

The file should look like this after both edits:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Theme color variables ────────────────────────────────────── */
:root {
  --c-bg:             10 14 26;
  --c-panel:          15 23 42;
  --c-card:           30 41 59;
  --c-border:         51 65 85;
  --c-text-primary:   226 232 240;
  --c-text-secondary: 148 163 184;
  --c-text-dim:       71 85 105;
  --c-amber:          245 158 11;
  --c-amber-dim:      180 83 9;
  --c-green:          34 197 94;
  --c-red:            239 68 68;
}

.theme-night {
  --c-bg:             4 1 0;
  --c-panel:          8 2 0;
  --c-card:           16 4 0;
  --c-border:         45 12 0;
  --c-text-primary:   204 58 0;
  --c-text-secondary: 122 34 0;
  --c-text-dim:       61 16 0;
  --c-amber:          204 58 0;
  --c-amber-dim:      122 34 0;
  --c-green:          153 68 0;
  --c-red:            187 0 0;
}

.theme-day {
  --c-bg:             238 242 247;
  --c-panel:          255 255 255;
  --c-card:           244 247 251;
  --c-border:         203 213 225;
  --c-text-primary:   15 23 42;
  --c-text-secondary: 55 65 81;
  --c-text-dim:       107 114 128;
  --c-amber:          217 119 6;
  --c-amber-dim:      146 64 14;
  --c-green:          21 128 61;
  --c-red:            220 38 38;
}

@layer base {
  html {
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body {
    @apply bg-cockpit-bg text-cockpit-text-primary font-sans;
    min-height: 100dvh;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { @apply bg-cockpit-border rounded-full; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-cockpit-text-dim; }
}

@layer components {

  /* ─── Aircraft cards ──────────────────────────────────────────── */
  .aircraft-card {
    @apply relative flex flex-col p-4 rounded-2xl cursor-pointer
           bg-cockpit-card border border-cockpit-border
           transition-all duration-200;
  }
  .aircraft-card:hover {
    @apply border-cockpit-amber/30 -translate-y-0.5;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(245,158,11,0.1);
  }
  .aircraft-card:active { @apply scale-[0.98]; }

  /* ─── Phase navigation buttons ───────────────────────────────── */
  .phase-nav-btn {
    @apply relative flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm
           transition-all duration-150 text-cockpit-text-secondary
           hover:text-cockpit-text-primary hover:bg-white/5;
  }
  .phase-nav-btn.active {
    @apply bg-cockpit-amber/10 text-cockpit-amber;
    box-shadow: inset 0 0 0 1px rgba(245,158,11,0.2);
  }
  .phase-nav-btn.completed {
    @apply text-cockpit-green;
  }

  /* ─── Emergency button ───────────────────────────────────────── */
  .emergency-btn {
    @apply flex items-center gap-1.5 px-3 py-2 rounded-xl
           bg-red-500/10 border border-red-500/30
           text-red-400 font-semibold text-xs
           hover:bg-red-500/20 hover:border-red-500/40
           active:scale-95 transition-all duration-150;
  }

  /* ─── Checklist items ────────────────────────────────────────── */
  .check-item {
    @apply relative flex items-start gap-3 px-3.5 py-3 rounded-xl cursor-pointer
           border border-transparent
           transition-all duration-150
           hover:border-cockpit-border hover:bg-white/[0.03];
  }
  .check-item.checked {
    @apply border-cockpit-green/15 bg-cockpit-green/[0.04];
  }
  .check-item.severity-warning {
    @apply border-l-2 border-l-cockpit-amber;
  }

  /* ─── Glass panel ────────────────────────────────────────────── */
  .glass-panel {
    @apply bg-cockpit-panel/80 backdrop-blur-sm border border-cockpit-border/50;
  }

  /* ─── Scale utilities ────────────────────────────────────────── */
  .active\:scale-98:active { transform: scale(0.98); }
}

@layer utilities {
  .safe-top    { padding-top:    env(safe-area-inset-top,    0px); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-left   { padding-left:   env(safe-area-inset-left,   0px); }
  .safe-right  { padding-right:  env(safe-area-inset-right,  0px); }
  .touch-target { min-height: 44px; min-width: 44px; }
  .scrollbar-none { scrollbar-width: none; }
  .scrollbar-none::-webkit-scrollbar { display: none; }
}
```

- [ ] **Step 4: Verify the build passes**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Visual verification**

Start the dev server and open the app in a browser:

```bash
npm run dev
```

The theme cycles via the theme icon button in the app header (implemented in `App.tsx` — it calls `setTheme` which adds `.theme-night` or `.theme-day` to the `<html>` element). Tap it to cycle through all three themes and verify each:

**Dark (default):** Navy-black background, light text. Visually unchanged from before.

**Night:** Near-black with a faint red cast. All text is deep orange-red. Phase "complete" indicators appear in deep amber (not green). Emergency indicators appear in true red (slightly more alarming than the body text).

**Day:** Off-white background (`#eef2f7` — not pure white). Dark navy text. Open the Cessna 172 checklist → Reference tab → any table section. Table header cells should now show the correct light-mode background instead of dark-navy. This confirms the `bg-cockpit-panel/60` opacity-modifier bug is fixed.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "feat: add CSS theme variables, fix opacity-modifier theming bug"
```
