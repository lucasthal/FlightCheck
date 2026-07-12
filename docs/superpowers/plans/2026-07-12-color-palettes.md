# Color Palette System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the amber-on-slate default with a Glass Cockpit cyan palette and add a 5-palette picker in Settings, per `docs/superpowers/specs/2026-07-12-color-palettes-design.md`.

**Architecture:** Split `--c-amber` into palette-varying `--c-accent*` tokens and fixed `--c-caution*` tokens. Palettes are root classes (`palette-*`) exactly like the existing `theme-*` classes; night mode is declared last so it always wins. New `color_palette` preference flows through the existing usePreferences localStorage+Supabase pipeline.

**Tech Stack:** Vite + React + TS + Tailwind (CSS-variable tokens), Supabase user_preferences, Python/PIL for asset regeneration.

## Global Constraints

- Palette values: `glass` (default) | `teal` | `flightdeck` | `titanium` | `indigo` — exact strings, used as class suffix, preference value, and DB value.
- Night mode (`theme-night`) must render identically regardless of palette.
- Aircraft-class category colors (`Turboprop: 'text-amber-400'`, `'from-amber-500 to-orange-500'` in FleetStrip, AircraftSelector, ChecklistView, VSpeedCard) are data categorization, NOT brand accent — never touch them.
- Checklist severity `caution` uses hardcoded `yellow-500` — never touch it. Severity `warning` uses amber → becomes `cockpit-caution`.
- No test infra exists; verification is `npm run build` (tsc + vite) plus grep sweeps.
- Supabase column `color_palette` is added manually by Louie (SQL below); code must work before the column exists (load falls back to default; update failures are already fire-and-forget).

```sql
alter table user_preferences add column color_palette text not null default 'glass';
```

---

### Task 1: CSS tokens + Tailwind config

**Files:**
- Modify: `src/index.css:5-50` (variable blocks) and `:84-142` (component classes)
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: CSS vars `--c-accent`, `--c-accent-dim`, `--c-accent-bright`, `--c-on-accent`, `--c-caution`, `--c-caution-dim`; root classes `palette-teal|flightdeck|titanium|indigo` (glass = `:root` default); Tailwind colors `cockpit-accent`, `cockpit-accent-dim`, `cockpit-accent-bright`, `cockpit-on-accent`, `cockpit-caution`, `cockpit-caution-dim`; shadow `accent-glow`; animation `pulse-accent`.
- Keeps (temporarily): `cockpit-amber` → `var(--c-caution)` and `cockpit-amber-dim` → `var(--c-caution-dim)` as deprecated aliases so the app stays amber-branded (not broken) until the Task 3 sweep removes them.

- [ ] **Step 1: Replace the variable blocks in `src/index.css` (lines 5–50) with:**

```css
/* ─── Theme color variables ────────────────────────────────────── */
/* Default = dark mode, glass palette. .palette-* overrides neutrals+accent.
   .theme-day overrides neutrals; .palette-X.theme-day overrides accent.
   .theme-night is declared LAST and wins over any palette. */
:root {
  --c-bg:             10 12 16;
  --c-panel:          16 20 27;
  --c-card:           23 29 38;
  --c-border:         40 49 62;
  --c-text-primary:   230 237 243;
  --c-text-secondary: 139 152 169;
  --c-text-dim:       90 101 117;
  --c-accent:         34 211 238;
  --c-accent-dim:     14 116 144;
  --c-accent-bright:  103 232 249;
  --c-on-accent:      0 0 0;
  --c-caution:        245 158 11;
  --c-caution-dim:    180 83 9;
  --c-green:          34 197 94;
  --c-red:            239 68 68;
  --c-extrapolated:   167 139 250;
  --text-scale:       1;
}

.palette-teal {
  --c-accent:         43 200 217;
  --c-accent-dim:     15 118 110;
  --c-accent-bright:  94 234 212;
}

.palette-flightdeck {
  --c-bg:             11 18 32;
  --c-panel:          17 28 49;
  --c-card:           24 38 68;
  --c-border:         43 61 99;
  --c-text-primary:   227 233 244;
  --c-text-secondary: 147 163 189;
  --c-text-dim:       95 110 133;
  --c-accent:         91 155 255;
  --c-accent-dim:     36 86 179;
  --c-accent-bright:  147 190 255;
  --c-extrapolated:   100 175 225;
}

.palette-titanium {
  --c-bg:             15 14 12;
  --c-panel:          23 22 20;
  --c-card:           32 30 27;
  --c-border:         56 53 47;
  --c-text-primary:   234 232 228;
  --c-text-secondary: 160 155 147;
  --c-text-dim:       107 102 89;
  --c-accent:         45 212 143;
  --c-accent-dim:     4 120 87;
  --c-accent-bright:  110 231 183;
  --c-extrapolated:   100 175 225;
}

.palette-indigo {
  --c-bg:             14 15 30;
  --c-panel:          20 22 43;
  --c-card:           28 31 58;
  --c-border:         50 55 100;
  --c-text-primary:   228 230 245;
  --c-text-secondary: 154 160 196;
  --c-text-dim:       102 108 148;
  --c-accent:         139 147 248;
  --c-accent-dim:     79 70 229;
  --c-accent-bright:  179 184 251;
  --c-extrapolated:   100 175 225;
}

.theme-day {
  --c-bg:             238 242 247;
  --c-panel:          255 255 255;
  --c-card:           244 247 251;
  --c-border:         203 213 225;
  --c-text-primary:   15 23 42;
  --c-text-secondary: 55 65 81;
  --c-text-dim:       107 114 128;
  --c-accent:         8 145 178;
  --c-accent-dim:     21 94 117;
  --c-accent-bright:  6 166 206;
  --c-on-accent:      255 255 255;
  --c-caution:        217 119 6;
  --c-caution-dim:    146 64 14;
  --c-green:          21 128 61;
  --c-red:            220 38 38;
  --c-extrapolated:   29 100 190;
}
.palette-teal.theme-day       { --c-accent: 13 148 136; --c-accent-dim: 17 94 89;  --c-accent-bright: 15 176 159; }
.palette-flightdeck.theme-day { --c-accent: 37 99 235;  --c-accent-dim: 30 64 175; --c-accent-bright: 59 118 246; --c-extrapolated: 29 100 190; }
.palette-titanium.theme-day   { --c-accent: 5 150 105;  --c-accent-dim: 6 95 70;   --c-accent-bright: 8 178 126;  --c-extrapolated: 29 100 190; }
.palette-indigo.theme-day     { --c-accent: 79 70 229;  --c-accent-dim: 55 48 163; --c-accent-bright: 97 89 240;  --c-extrapolated: 29 100 190; }

/* Night vision: always wins — declared after all palette blocks, and
   accent/caution collapse to the same red-orange as everything else. */
.theme-night {
  --c-bg:             4 1 0;
  --c-panel:          8 2 0;
  --c-card:           16 4 0;
  --c-border:         45 12 0;
  --c-text-primary:   204 58 0;
  --c-text-secondary: 122 34 0;
  --c-text-dim:       61 16 0;
  --c-accent:         204 58 0;
  --c-accent-dim:     122 34 0;
  --c-accent-bright:  204 58 0;
  --c-on-accent:      0 0 0;
  --c-caution:        204 58 0;
  --c-caution-dim:    122 34 0;
  --c-green:          153 68 0;
  --c-red:            187 0 0;
  --c-extrapolated:   150 60 5;
}
```

Note: `.theme-night` must come AFTER the `.palette-X.theme-day` rules (it replaces the old `.theme-night` block's position — the old block sat before `.theme-day`; move it below).

- [ ] **Step 2: Update the component classes in `src/index.css`:**

`.aircraft-card:hover` (was amber + hardcoded rgba):
```css
  .aircraft-card:hover {
    @apply border-cockpit-accent/30 -translate-y-0.5;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgb(var(--c-accent) / 0.1);
  }
```

`.phase-nav-btn.active`:
```css
  .phase-nav-btn.active {
    @apply bg-cockpit-accent/10 text-cockpit-accent;
    box-shadow: inset 0 0 0 1px rgb(var(--c-accent) / 0.2);
  }
```

`.check-item.severity-warning`:
```css
  .check-item.severity-warning {
    @apply border-l-2 border-l-cockpit-caution;
  }
```

- [ ] **Step 3: Update `tailwind.config.js` colors/shadows/animations:**

In `colors.cockpit`, replace the `amber`/`amber-dim` entries with:
```js
          accent:          'rgb(var(--c-accent)          / <alpha-value>)',
          'accent-dim':    'rgb(var(--c-accent-dim)      / <alpha-value>)',
          'accent-bright': 'rgb(var(--c-accent-bright)   / <alpha-value>)',
          'on-accent':     'rgb(var(--c-on-accent)       / <alpha-value>)',
          caution:         'rgb(var(--c-caution)         / <alpha-value>)',
          'caution-dim':   'rgb(var(--c-caution-dim)     / <alpha-value>)',
          /* deprecated aliases — removed in the sweep task */
          amber:           'rgb(var(--c-caution)         / <alpha-value>)',
          'amber-dim':     'rgb(var(--c-caution-dim)     / <alpha-value>)',
```

In `boxShadow`, replace `'amber-glow'` with:
```js
        'accent-glow': '0 0 12px rgb(var(--c-accent) / 0.3)',
        'amber-glow': '0 0 12px rgb(var(--c-accent) / 0.3)',  /* deprecated alias */
```

In `animation`/`keyframes`, rename `pulse-amber` → `pulse-accent` (grep first: `Grep animate-pulse-amber src/` — if any usages exist, update them in the same step).

- [ ] **Step 4: Build**

Run: `npm run build` — Expected: PASS (aliases keep existing classes working).

- [ ] **Step 5: Commit**

```bash
git add src/index.css tailwind.config.js
git commit -m "feat(theme): add palette token system with glass cockpit default"
```

---

### Task 2: Preference plumbing

**Files:**
- Modify: `src/types/index.ts:97-114`
- Modify: `src/hooks/usePreferences.tsx` (load block ~72-78, theme side effect ~110-118)

**Interfaces:**
- Produces: `type ColorPalette = 'glass' | 'teal' | 'flightdeck' | 'titanium' | 'indigo'`; `COLOR_PALETTES: ColorPalette[]`; `UserPreferences.color_palette: ColorPalette`; root class `palette-<value>` applied alongside theme classes.

- [ ] **Step 1: `src/types/index.ts` — after the `TextSize` line add:**

```ts
export type ColorPalette = 'glass' | 'teal' | 'flightdeck' | 'titanium' | 'indigo'
export const COLOR_PALETTES: ColorPalette[] = ['glass', 'teal', 'flightdeck', 'titanium', 'indigo']
```

Add `color_palette: ColorPalette` to `UserPreferences` and `color_palette: 'glass'` to `DEFAULT_PREFERENCES`.

- [ ] **Step 2: `usePreferences.tsx` — load + side effect:**

Import `COLOR_PALETTES` (and `type ColorPalette` if needed). In the Supabase load block add (with validation so an unknown DB value degrades to default):

```ts
            color_palette:       COLOR_PALETTES.includes(data.color_palette) ? data.color_palette : DEFAULT_PREFERENCES.color_palette,
```

Replace the theme side effect with one that also manages palette classes:

```ts
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'theme-night', 'theme-day')
    COLOR_PALETTES.forEach(p => root.classList.remove(`palette-${p}`))
    if (preferences.theme === 'dark' || preferences.theme === 'night') {
      root.classList.add('dark')
    }
    if (preferences.theme === 'night') root.classList.add('theme-night')
    if (preferences.theme === 'day')   root.classList.add('theme-day')
    root.classList.add(`palette-${preferences.color_palette}`)
  }, [preferences.theme, preferences.color_palette])
```

- [ ] **Step 3: Build** — `npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/usePreferences.tsx
git commit -m "feat(theme): add color_palette preference with glass default"
```

---

### Task 3: Accent/caution sweep

**Files:** Modify all 20 component files + remove aliases from `tailwind.config.js`.

**Interfaces:**
- Consumes: Tailwind classes from Task 1.
- Produces: zero occurrences of `cockpit-amber`, `shadow-amber-glow`, `hover:bg-amber-400`, `hover:text-amber-400`, `to-orange-500` (in gradients with accent), `text-black`-on-accent in `src/`.

**Classification — these EXACT locations become `cockpit-caution` (same opacity suffixes kept):**

| File | Lines | What |
|---|---|---|
| `src/components/ChecklistItems.tsx` | 50, 61, 75, 108, 129 | severity `warning` card bg/stripe/checkbox/icon/label |
| `src/components/OfflineBanner.tsx` | 19 | offline notice text |
| `src/components/ChecklistEditorView.tsx` | 78 | `text-amber-400/70` "No connection" → `text-cockpit-caution/70` |
| `src/components/SettingsSheet.tsx` | 180, 306 | trial-ends note; Apple-subscription delete warning |
| `src/components/ChecklistView.tsx` | 586, 626, 770, 771, 783 | reset/confirm warning dialogs + reset modal |

**Everything else `cockpit-amber*` → `cockpit-accent*`**, plus these mechanical rules everywhere:

- `hover:bg-amber-400` → `hover:bg-cockpit-accent-bright`
- `hover:text-amber-400` → `hover:text-cockpit-accent-bright` (Paywall:227)
- `from-cockpit-amber to-orange-500` → `from-cockpit-accent to-cockpit-accent-dim` (LoginScreen:70,114; Paywall:94; AircraftSelector:162,189; WelcomeScreen:14)
- `shadow-amber-glow` → `shadow-accent-glow`
- `text-black` immediately paired with `bg-cockpit-accent` (LoginScreen:96,230; Paywall:131; WelcomeScreen:45; SettingsSheet:135,197,217; AircraftSelector:189) → `text-cockpit-on-accent`
- `FeedbackModal.tsx:213` `text-cockpit-bg` on accent button → `text-cockpit-on-accent`
- `FeedbackButton.tsx:22` `hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]` → `hover:shadow-accent-glow`
- **DO NOT TOUCH** aircraft-class category colors: `FleetStrip.tsx:8`, `AircraftSelector.tsx:30,39`, `ChecklistView.tsx:39`, `VSpeedCard.tsx:7` (`text-amber-400`, `from-amber-500 to-orange-500` keyed by `Turboprop`).

- [ ] **Step 1: Apply the sweep file-by-file per the tables above.**
- [ ] **Step 2: Remove the deprecated `amber`, `amber-dim`, `amber-glow` aliases from `tailwind.config.js`.**
- [ ] **Step 3: Verify with grep** — `cockpit-amber|amber-glow|pulse-amber` in `src/` → 0 matches; `amber-400|amber-500|orange-500` matches ONLY the 5 category-color lines listed above.
- [ ] **Step 4: Build** — `npm run build` — Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add -A src/ tailwind.config.js
git commit -m "feat(theme): sweep amber to accent/caution tokens across components"
```

---

### Task 4: Settings Appearance section

**Files:**
- Modify: `src/components/SettingsSheet.tsx` (THEMES const ~16-20, Theme block ~187-205)

**Interfaces:**
- Consumes: `updatePreference('color_palette', value)`, `COLOR_PALETTES`, `type ColorPalette` from Task 2.

- [ ] **Step 1: Relabel + add palettes const:**

```tsx
const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark',  label: 'Dark' },
  { value: 'night', label: 'Night' },
  { value: 'day',   label: 'Day' },
]

const PALETTES: { value: ColorPalette; label: string; dot: string }[] = [
  { value: 'glass',      label: 'Glass',      dot: '#22D3EE' },
  { value: 'teal',       label: 'Teal',       dot: '#2BC8D9' },
  { value: 'flightdeck', label: 'Flight Deck', dot: '#5B9BFF' },
  { value: 'titanium',   label: 'Titanium',   dot: '#2DD48F' },
  { value: 'indigo',     label: 'Indigo',     dot: '#8B93F8' },
]
```

(`import type { Theme, TextSize, ColorPalette } from '../types'`)

- [ ] **Step 2: Replace the "Theme" block with an Appearance section — Mode row + Color row:**

```tsx
          {/* Appearance */}
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-cockpit-text-primary">Mode</p>
              <div className="flex gap-2">
                {THEMES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => updatePreference('theme', value)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      preferences.theme === value
                        ? 'bg-cockpit-accent text-cockpit-on-accent'
                        : 'bg-cockpit-card text-cockpit-text-primary border border-cockpit-border'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-cockpit-text-primary">Color</p>
              <div className="flex flex-wrap gap-2">
                {PALETTES.map(({ value, label, dot }) => (
                  <button
                    key={value}
                    onClick={() => updatePreference('color_palette', value)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${
                      preferences.color_palette === value
                        ? 'border-cockpit-accent bg-cockpit-accent/10 text-cockpit-text-primary'
                        : 'border-cockpit-border bg-cockpit-card text-cockpit-text-secondary'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: dot }} />
                    {label}
                  </button>
                ))}
              </div>
              {preferences.theme === 'night' && (
                <p className="text-xs text-cockpit-text-dim">
                  Night mode overrides colors for night vision.
                </p>
              )}
            </div>
          </div>
```

- [ ] **Step 3: Build** — `npm run build` — Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsSheet.tsx
git commit -m "feat(settings): appearance section with mode and color palette picker"
```

---

### Task 5: App icon + IAP promo regeneration

**Files:**
- Create: `assets/recolor_icon.py`
- Modify: `assets/icon-source.png`, `assets/generate_promo.py`, `assets/iap-promo-1024.png`, `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`

- [ ] **Step 1: Write `assets/recolor_icon.py`** — extracts the white mark via the blue channel (orange bg has low blue; white mark has 255), rebuilds the background as a cyan→teal diagonal gradient, composites:

```python
from PIL import Image

SRC = 'assets/icon-source.png'
TOP = (0x22, 0xD3, 0xEE)   # cyan
BOT = (0x0E, 0x74, 0x90)   # deep teal

src = Image.open(SRC).convert('RGB')
w, h = src.size

# Diagonal gradient built small then upscaled for smoothness
g = Image.new('RGB', (256, 256))
px = g.load()
for y in range(256):
    for x in range(256):
        t = (x + y) / 510
        px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOT))
bg = g.resize((w, h), Image.BICUBIC)

# White-mark alpha from the blue channel (bg orange: low blue; mark: 255)
b = src.split()[2]
alpha = b.point(lambda v: 0 if v < 120 else min(255, round((v - 120) * 255 / 135)))
white = Image.new('RGB', (w, h), (255, 255, 255))
bg.paste(white, (0, 0), alpha)
bg.save(SRC)
bg.resize((1024, 1024), Image.LANCZOS).save(
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
print('icon regenerated', w, h)
```

- [ ] **Step 2: Run it** — `python assets/recolor_icon.py` — then Read both output PNGs to visually confirm: white mark intact, cyan→teal gradient, no orange halo at mark edges.
- [ ] **Step 3: Update `assets/generate_promo.py` colors** — read the script first; replace the palette constants: background → `#0A0C10`, card → `#171D26`, checkbox fill → `#22D3EE`, check mark stroke → `#000000`, placeholder lines → `#8B98A9` / `#5A6575`, any amber accents → `#22D3EE`. Rerun `python assets/generate_promo.py` and Read `assets/iap-promo-1024.png` to confirm.
- [ ] **Step 4: Commit**

```bash
git add assets/ ios/App/App/Assets.xcassets/
git commit -m "feat(brand): regenerate app icon and IAP promo art in glass cockpit palette"
```

---

## Manual step for Louie (after merge, before next release)

Run in the Supabase SQL editor:

```sql
alter table user_preferences add column color_palette text not null default 'glass';
```

Until then, palette choice works and persists locally on every device; cross-device sync of the palette starts when the column exists.
