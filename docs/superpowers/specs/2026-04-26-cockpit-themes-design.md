# Cockpit Theme Overhaul — Design Spec

**Date:** 2026-04-26
**Status:** Approved — ready for implementation

---

## Goal

Redesign the three cockpit themes (dark, night, day) using CSS custom properties so colors are pilot-optimized, visually cohesive, and free of the opacity-modifier bug that makes table headers invisible in day mode.

---

## Problem Statement

Two issues to solve together:

1. **Table header bug (day mode):** `bg-cockpit-panel/60` in `TableCard.tsx` uses a Tailwind opacity modifier. The current class-override theming (`.theme-day .bg-cockpit-panel`) only matches elements with the exact class `bg-cockpit-panel` — not `bg-cockpit-panel/60`. So table header cells keep the dark-theme color in day mode, making them invisible against a light background.

2. **Color cohesion:** The three themes don't feel like a family. Night mode amber is too yellow/bright (damages dark adaptation). Day mode pure-white causes glare on glossy iPad screens in direct sunlight. The themes share no structural token system.

---

## Architecture — CSS Custom Properties

### Why

Tailwind's `<alpha-value>` pattern allows CSS variables to participate in opacity modifiers. Once colors are defined as CSS variables, `bg-cockpit-panel/60` works correctly in every theme without any extra class overrides. All the `.theme-day .bg-cockpit-*` and `.theme-night .bg-cockpit-*` overrides in `index.css` are deleted.

### `tailwind.config.js` change

Replace static hex values with CSS variable references using the `rgb(var(--c-x) / <alpha-value>)` pattern:

```js
colors: {
  cockpit: {
    bg:             'rgb(var(--c-bg)             / <alpha-value>)',
    panel:          'rgb(var(--c-panel)          / <alpha-value>)',
    card:           'rgb(var(--c-card)           / <alpha-value>)',
    border:         'rgb(var(--c-border)         / <alpha-value>)',
    amber:          'rgb(var(--c-amber)          / <alpha-value>)',
    'amber-dim':    'rgb(var(--c-amber-dim)      / <alpha-value>)',
    green:          'rgb(var(--c-green)          / <alpha-value>)',
    red:            'rgb(var(--c-red)            / <alpha-value>)',
    'text-primary': 'rgb(var(--c-text-primary)   / <alpha-value>)',
    'text-secondary':'rgb(var(--c-text-secondary) / <alpha-value>)',
    'text-dim':     'rgb(var(--c-text-dim)       / <alpha-value>)',
  }
}
```

Variables must be declared as space-separated RGB channels (not hex) for the `/ <alpha-value>` syntax to work:

```css
:root { --c-bg: 10 14 26; }   /* #0a0e1a */
```

### `index.css` change

- Add `:root` block with dark-theme variable values (dark is the default)
- Add `.theme-night` block with night variable values
- Add `.theme-day` block with day variable values
- **Delete** all `.theme-night .bg-cockpit-*`, `.theme-night .text-cockpit-*`, `.theme-day .bg-cockpit-*`, `.theme-day .text-cockpit-*` overrides — no longer needed

---

## Color Palettes

### Dark (`:root` default) — Dusk / IMC / Instrument Flight

Navy-black palette. Unchanged except border gets marginally lighter for crisper card separation.

| Token | Hex | RGB channels |
|---|---|---|
| bg | `#0a0e1a` | `10 14 26` |
| panel | `#0f172a` | `15 23 42` |
| card | `#1e293b` | `30 41 59` |
| border | `#334155` | `51 65 85` |
| text-primary | `#e2e8f0` | `226 232 240` |
| text-secondary | `#94a3b8` | `148 163 184` |
| text-dim | `#475569` | `71 85 105` |
| amber | `#f59e0b` | `245 158 11` |
| amber-dim | `#b45309` | `180 83 9` |
| green | `#22c55e` | `34 197 94` |
| red | `#ef4444` | `239 68 68` |

---

### Night (`.theme-night`) — Dark Adaptation / Night Flight

Full shift to the red-orange spectrum (~620–640nm). Rod photoreceptors are nearly insensitive to these wavelengths, allowing eyes to stay adapted to the dark outside sky.

Three brightness levels maintain readable hierarchy without any blue or green light.

`green` becomes deep amber (`#994400`) because true green (#22c55e) stimulates rod-adjacent cones and damages adaptation. The "complete" semantic is preserved through icon + context.

`red` (emergency) uses true red (`#bb0000`) — slightly more alarming than the orange-red text, maintaining the urgency hierarchy.

| Token | Hex | RGB channels | Rationale |
|---|---|---|---|
| bg | `#040100` | `4 1 0` | Near-black, faintest red cast |
| panel | `#080200` | `8 2 0` | Very dark red-black |
| card | `#100400` | `16 4 0` | Dark red-black |
| border | `#2d0c00` | `45 12 0` | Dim red — card edge visibility |
| text-primary | `#cc3a00` | `204 58 0` | Deep orange-red, rod-safe, readable |
| text-secondary | `#7a2200` | `122 34 0` | Darker red — secondary info |
| text-dim | `#3d1000` | `61 16 0` | Very dim — truly muted |
| amber | `#cc3a00` | `204 58 0` | Active state = same as primary |
| amber-dim | `#7a2200` | `122 34 0` | — |
| green | `#994400` | `153 68 0` | Deep amber — "complete" state, rod-safe |
| red | `#bb0000` | `187 0 0` | Emergency — true red, more alarming than text |

---

### Day (`.theme-day`) — Bright Cockpit / Sunlight Readable

Neutral cool-light palette. Background is `#eef2f7` (not pure white) — the faint blue tint matches the dark theme's navy family and reduces glare on glossy iPad screens in direct sunlight. Accent colors shift one step darker to maintain contrast ratios on the light background (amber-600, green-700, red-600).

| Token | Hex | RGB channels | Rationale |
|---|---|---|---|
| bg | `#eef2f7` | `238 242 247` | Off-white, faint blue tint, no glare |
| panel | `#ffffff` | `255 255 255` | Pure white surfaces |
| card | `#f4f7fb` | `244 247 251` | Very light blue-gray for nested cards |
| border | `#cbd5e1` | `203 213 225` | Slate-300 — clean visible borders |
| text-primary | `#0f172a` | `15 23 42` | Same as dark theme panel — intentional inversion |
| text-secondary | `#374151` | `55 65 81` | Dark gray |
| text-dim | `#6b7280` | `107 114 128` | Medium gray |
| amber | `#d97706` | `217 119 6` | Amber-600 — darker for light-bg contrast |
| amber-dim | `#92400e` | `146 64 14` | Amber-800 |
| green | `#15803d` | `21 128 61` | Green-700 — darker for light-bg contrast |
| red | `#dc2626` | `220 38 38` | Red-600 — darker for light-bg contrast |

---

## Table Header Bug Fix

The bug (`bg-cockpit-panel/60` ignoring day theme) is fixed automatically by the CSS variable architecture — no TableCard changes needed. Once variables are declared correctly, `bg-cockpit-panel/60` computes to `rgb(var(--c-panel) / 0.6)` which resolves to the correct theme color in all three modes.

---

## Scope / Out of Scope

**In scope:**
- `tailwind.config.js` — cockpit color token definitions
- `src/index.css` — CSS variable declarations + removal of old class overrides
- Table header bug resolution (automatic via architecture)

**Out of scope:**
- Category accent colors (`text-sky-400`, `text-violet-400`, etc. for SEP/MEP/etc.) — these are Tailwind built-ins, not cockpit tokens. They remain bright in night mode for now; a future pass can add `.theme-night` overrides for them if desired.
- New theme modes beyond the existing three
- Any layout or component changes

---

## Files Changed

| File | Change |
|---|---|
| `tailwind.config.js` | Replace hex values with `rgb(var(--c-x) / <alpha-value>)` references |
| `src/index.css` | Add `:root`, `.theme-night`, `.theme-day` variable blocks; delete old class overrides |

No component files need to change.
