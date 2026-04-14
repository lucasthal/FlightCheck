# Phase Navigation & Banner Design

**Date:** 2026-04-13  
**Status:** Approved  

---

## Problem

On iPhone, checklist phases are only accessible via a hamburger menu. Users have no persistent visibility into where they are in the flight checklist sequence, and navigating between phases requires too many taps.

---

## Goals

1. Always-visible phase navigation on mobile — no hamburger required
2. Clear "you are here" indicator showing the current phase prominently at the top of the content area
3. At-a-glance situational awareness of the full flight checklist sequence (how many phases done, how many left)

---

## Out of Scope

- Swipe gestures on the content area (not needed — tap navigation is sufficient)
- Removing the hamburger menu on desktop (desktop sidebar stays as-is)
- Changes to checklist item rendering or the emergency panel

---

## Design

### 1. Phase Banner (top of content area)

Replaces the existing plain phase header (`<h2>` + radial progress circle + progress bar).

**Layout:** Left amber accent border · icon in a bordered box · phase name (bold) · monospace item count · amber % readout on the right.

```
┌─|  🔑  Startup                    27% ┐
   3 OF 11 ITEMS · IN PROGRESS
└───────────────────────────────────────┘
▓▓░░░░░░░░░  ← segmented bar (see §2)
```

**Visual details:**
- Left border uses the category accent color (sky=SEP, violet=MEP, amber=Turboprop, rose=Jet, emerald=Helicopter)
- Subtle matching gradient wash behind the banner (`rgba(accent, 0.06)`)
- Icon in a small bordered box (`border: 1px solid accent/30`, `background: accent/08`)
- Phase name: `font-weight: 800`, `text-cockpit-text-primary`
- Item count: monospace, dim (`X OF Y ITEMS · IN PROGRESS / COMPLETE`)
- Percentage: large monospace, category accent color

**State variants:**
- In progress: amber accent (or category color) + "IN PROGRESS"
- Complete: green accent + checkmark icon + "COMPLETE"

### 2. Segmented Phase Bar

Sits immediately below the phase banner (no gap), spanning the full content width.

- One thin segment (`height: 3px`) per normal phase
- Green (`#22c55e`) = phase complete
- Category accent color = active phase
- Dim (`#1a2535`) = not yet started
- No labels — purely visual, serves as a minimap of the flight

### 3. Bottom Phase Strip (mobile only, `lg:hidden`)

Replaces the existing mobile bottom bar entirely.

**Structure:**
```
┌─────────────────────────────────────┐
│  ⚠ EMERG          ↺ New Flight     │  ← actions row
├─────────────────────────────────────┤
│  ✓ Preflight  ● Startup  Taxi  …→  │  ← scrollable pill strip
└─────────────────────────────────────┘
```

**Actions row:** EMERG button (red, left) + New Flight reset (dim, right). No current phase label — that's now handled by the banner.

**Pill strip:**
- Horizontally scrollable (`overflow-x: auto`, `scrollbar-width: none`)
- Each pill: phase icon + phase name
- Done pill: green tint, green border, checkmark prefix
- Active pill: category accent color tint + border, bold label
- Upcoming pill: dim background, dim text
- Tapping a pill calls `selectPhase(id)` — same as the sidebar

**Safe area:** Bottom padding respects `env(safe-area-inset-bottom)` for iPhone home indicator.

### 4. Desktop (no change)

The `lg:` sidebar remains exactly as-is. The bottom phase strip is `lg:hidden` — desktop users continue using the sidebar. The phase banner and segmented bar render on all screen sizes, improving desktop too.

---

## Component Changes

| File | Change |
|------|--------|
| `src/components/ChecklistView.tsx` | Replace phase header section with `<PhaseBanner>`. Replace mobile bottom bar with `<PhaseStrip>`. |
| `src/components/PhaseBanner.tsx` | New component — banner + segmented bar |
| `src/components/PhaseStrip.tsx` | New component — actions row + scrollable pill strip |

The existing `PhaseNav.tsx` (sidebar item) is unchanged.

---

## Aesthetic Notes

- Fonts: existing IBM Plex Mono for data readouts, existing cockpit sans for labels
- Category accent colors already defined in `CATEGORY_ACCENT` / `CATEGORY_BORDER` in `ChecklistView.tsx` — reuse these
- Animations: Framer Motion `layoutId` transition on the active pill so it slides smoothly when the phase changes
- The segmented bar segments animate width from 0 on mount (`transition: width 0.4s ease`)
