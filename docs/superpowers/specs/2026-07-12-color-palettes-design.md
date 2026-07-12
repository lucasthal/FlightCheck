# Color Palettes — Design Spec

**Date:** 2026-07-12
**Status:** Approved direction from palette exploration (artifact review). Glass Cockpit cyan chosen as default.

## Goal

Replace the amber-on-slate default theme (reads as "Claude-made") with a Glass Cockpit cyan palette, and let users pick from five palettes in Settings. Day/Night/Dark mode selection stays a separate, adjacent control. Night-vision red mode is never affected by palette choice.

## Data model

Two independent preferences:

| Preference | Values | Default | Notes |
|---|---|---|---|
| `theme` (existing) | `dark` \| `night` \| `day` | `dark` | Unchanged |
| `color_palette` (new) | `glass` \| `teal` \| `flightdeck` \| `titanium` \| `indigo` | `glass` | New column in `user_preferences` + localStorage |

The current amber look is retired — no "classic" option. Existing users are migrated to `glass` by default.

**Supabase migration (run once in dashboard):**

```sql
alter table user_preferences add column color_palette text not null default 'glass';
```

Loading tolerates a missing column (falls back to default); `updatePreference` writes it like any other key.

## Token architecture

`--c-amber` is currently both the brand accent and the caution color. Split it:

| New token | Role | Varies by palette? |
|---|---|---|
| `--c-accent` | Brand: primary buttons, active/selected states, toggles, links, progress | Yes |
| `--c-accent-dim` | Muted accent (replaces `--c-amber-dim` accent uses) | Yes |
| `--c-accent-bright` | Hover state (replaces hardcoded `hover:bg-amber-400`) | Yes |
| `--c-on-accent` | Text/icon color on accent surfaces (replaces hardcoded `text-black`) | Yes (black on dark-mode accents, white on day-mode accents) |
| `--c-caution` | Checklist severity stripes, warnings, trial-ending notices | No — always amber |
| `--c-caution-dim` | Muted caution | No |

Tailwind: add `cockpit-accent`, `cockpit-accent-dim`, `cockpit-accent-bright`, `cockpit-on-accent`, `cockpit-caution`, `cockpit-caution-dim`; delete `cockpit-amber` / `cockpit-amber-dim` after the sweep. `amber-glow` shadow becomes `accent-glow` using `rgb(var(--c-accent) / 0.3)`. `pulse-amber` animation renamed `pulse-accent` (pure rename; it only animates opacity).

All ~100 `cockpit-amber` / `amber-400` / `orange-500` usages across 20 component files get classified: caution semantics (checklist item severity, trial-expiry warnings, Apple-subscription warning in delete flow) → `cockpit-caution`; everything else (buttons, selected states, toggles, brand text, logo) → accent tokens.

## CSS structure

Palette applied as a root class, same mechanism as themes: `palette-glass` (also the `:root` default), `palette-teal`, `palette-flightdeck`, `palette-titanium`, `palette-indigo`.

Cascade order (specificity by declaration order, all single-class):

1. `:root` — glass dark values (the default)
2. `.palette-*` — dark neutrals + dark accent for that palette
3. `.theme-day` — shared light neutrals; day accent variants defined per palette as `.palette-X.theme-day` (compound selector wins)
4. `.theme-night` — declared last; overrides everything including accent (red-on-black always wins)

### Dark-mode values per palette

| Token | glass (default) | teal | flightdeck | titanium | indigo |
|---|---|---|---|---|---|
| bg | `#0A0C10` | `#0A0C10` | `#0B1220` | `#0F0E0C` | `#0E0F1E` |
| panel | `#10141B` | `#10141B` | `#111C31` | `#171614` | `#14162B` |
| card | `#171D26` | `#171D26` | `#182644` | `#201E1B` | `#1C1F3A` |
| border | `#28313E` | `#28313E` | `#2B3D63` | `#38352F` | `#323764` |
| text-primary | `#E6EDF3` | `#E6EDF3` | `#E3E9F4` | `#EAE8E4` | `#E4E6F5` |
| text-secondary | `#8B98A9` | `#8B98A9` | `#93A3BD` | `#A09B93` | `#9AA0C4` |
| text-dim | `#5A6575` | `#5A6575` | `#5F6E85` | `#6B6659` | `#666C94` |
| accent | `#22D3EE` | `#2BC8D9` | `#5B9BFF` | `#2DD48F` | `#8B93F8` |
| accent-dim | `#0E7490` | `#0F766E` | `#2456B3` | `#047857` | `#4F46E5` |
| accent-bright | `#67E8F9` | `#5EEAD4` | `#93BEFF` | `#6EE7B7` | `#B3B8FB` |
| on-accent | `#000000` | `#000000` | `#000000` | `#000000` | `#000000` |
| extrapolated | `#A78BFA` | `#A78BFA` | `#64AFE1` | `#64AFE1` | `#64AFE1` |

Caution (all palettes, dark): `#F59E0B`, dim `#B45309`. Green `#22C55E`, red `#EF4444` unchanged. Extrapolated shifts to soft violet in the two cyan palettes so extrapolated table data doesn't read as accent-colored.

### Day-mode accents per palette

Neutrals shared (existing `.theme-day` values). Per-palette day accents, all ≥4.5:1 on white:

| | glass | teal | flightdeck | titanium | indigo |
|---|---|---|---|---|---|
| accent | `#0891B2` | `#0D9488` | `#2563EB` | `#059669` | `#4F46E5` |
| accent-dim | `#155E75` | `#115E59` | `#1E40AF` | `#065F46` | `#3730A3` |
| accent-bright | `#06A6CE` | `#0FB09F` | `#3B76F6` | `#08B27E` | `#6159F0` |
| on-accent | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |

Day caution: `#D97706`, dim `#92400E` (current values, unchanged).

### Night mode

Unchanged values. Adds `--c-accent*: same red-orange as current --c-amber night values`, `--c-on-accent: black`, `--c-caution: same`, so components using new tokens render identically to today's night mode.

## Settings UI

Replace the current standalone "Theme" block with an **Appearance** section containing two adjacent controls:

1. **Mode** — existing three segmented buttons, relabeled: Dark / Night / Day (was "Default/Night/Day")
2. **Color** — five tappable chips in a wrap row; each chip = colored dot (the palette's dark accent) + short name: Glass, Teal, Flight Deck, Titanium, Indigo. Selected chip gets accent border + accent-tinted background.

When Mode = Night, the Color row stays enabled (choice persists and applies on leaving night) with a one-line hint: "Night mode overrides colors for night vision."

Selected-state styling in Settings (currently `bg-cockpit-amber text-black`) becomes `bg-cockpit-accent text-cockpit-on-accent`, so the sheet itself reflects the chosen palette.

## Special cases

- **Paywall logo gradient** `from-cockpit-amber to-orange-500`: becomes `from-cockpit-accent to-cockpit-accent-dim`.
- **App icon & promo art** (`assets/`): out of scope; stays amber until a separate icon-refresh task (App Store asset).
- **Autofill/caret CSS** in index.css uses text tokens only — no change.
- **`cockpit-blue`** (hardcoded `#3b82f6` in Tailwind): left as-is; audit later if it clashes with flightdeck accent.

## Error handling

- Unknown/missing `color_palette` value (older local storage, failed sync) → treated as `glass`.
- If the Supabase column doesn't exist yet when a signed-in user changes palette, the local update still applies (updates are fire-and-forget already); sync starts working after the migration runs.

## Testing

- Build + typecheck; grep proves zero remaining `cockpit-amber`/`amber-400`/`orange-500` in `src/`.
- Manual: cycle all 5 palettes × 3 modes; verify night mode is byte-identical red regardless of palette; verify caution stripes stay amber in every palette; verify Settings chips, toggles, Paywall CTA, checklist active item, progress bar all follow accent.
- Contrast spot-checks: accent-on-bg and on-accent-on-accent pairs listed above.
