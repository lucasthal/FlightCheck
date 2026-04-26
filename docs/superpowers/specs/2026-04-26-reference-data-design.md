# Reference Data: V-Speeds, Maneuvers & Performance Tables

**Date:** 2026-04-26  
**Status:** Approved — ready for implementation

## Goal

Add quick-reference data (V-speeds, maneuvers, performance tables, and other reference material) to all 19 aircraft in the app. Data is read-only — not interactive checklist items. Presentation must be super user-friendly for use during preflight and training.

---

## Data Model

### Changes to `src/types/index.ts`

Add two new fields to the `Aircraft` interface:

```ts
vSpeeds: Record<string, string>
referenceData: ReferenceSection[]
```

Add new types:

```ts
export type ReferenceSectionKind = 'speeds' | 'maneuver' | 'table' | 'keyval'

export type ReferenceSection =
  | { kind: 'speeds';   title: string; items: Record<string, string> }
  | { kind: 'maneuver'; title: string; steps: string[]; standards?: string[] }
  | { kind: 'table';    title: string; columns: string[]; rows: (string | number)[][]; notes?: string[] }
  | { kind: 'keyval';   title: string; items: Record<string, string> }
```

**`vSpeeds`** — flat key/value map of speed name to value string. Used by the V-speed card.  
Example: `{ Vr: '55 KIAS', Vx: '59 KIAS', Vy: '71 KIAS', Vno: '128 KIAS' }`

**`referenceData`** — ordered array of named sections rendered in the Reference tab. Each section has a `kind` that determines its render component:

| kind | use case | render |
|---|---|---|
| `speeds` | V-speeds reference (redundant) | two-column label/value grid |
| `maneuver` | Steep turns, slow flight, stalls, etc. | numbered steps + dimmed standards |
| `table` | Takeoff/landing distance, cruise performance | horizontally scrollable table, sticky first column |
| `keyval` | IMSAFE, NWKRAFT, formulas, SAFETY brief | two-column label/value grid |

### Aircraft file changes

Each `src/data/aircraft/*.ts` file gets `vSpeeds` and `referenceData` populated. No structural changes to existing `phases[]` data.

---

## UI Structure

### V-Speed Card (new)

**Location:** Pinned above the phase list in `ChecklistView`, always visible during checklist use.

**Layout:** Single horizontal scrollable row of speed pills.  
Format: `Vr 55 · Vx 59 · Vy 71 · Vno 128` — units are stripped in the pill (numeric only); the full value including units is shown in the popover.

**Interaction:** Tapping a pill shows a small popover with the full label and value (e.g. "Rotation Speed — 55 KIAS"). Dismisses on tap outside.

**Component:** `src/components/VSpeedCard.tsx`

### Reference Tab (new)

**Location:** Tab toggle in the checklist view header. Two tabs: **Checklist** | **Reference**. Switching tabs replaces the main content area — no new routes or pages.

**Content:** Scrollable list of `ReferenceSection` cards rendered by kind:

- **`speeds`** → two-column grid, label left / value right, monospace values
- **`maneuver`** → title, numbered steps, standards block below in muted style
- **`table`** → horizontally scrollable, header row sticky, first column sticky, alternating row shading
- **`keyval`** → two-column grid, same as speeds

**Component:** `src/components/ReferenceTab.tsx` — top-level renderer  
**Sub-components:** `src/components/reference/SpeedsCard.tsx`, `ManeuverCard.tsx`, `TableCard.tsx`, `KeyValCard.tsx`

---

## Data Sourcing

V-speeds, maneuver standards, and performance tables are sourced from POH/AFM references and FAA published data via web search during implementation. Each aircraft is populated in its source file at the time of implementation.

**Maneuver standards** follow FAA ACS/PTS unless the aircraft has specific POH guidance. Standard maneuvers included for training aircraft (SEP/MEP):
- Steep Turns, Slow Flight, Power-Off Stall, Power-On Stall, Accelerated Stall
- Ground Reference, Chandelle, Lazy 8s, Steep Spiral, 8s on Pylons (commercial)
- Emergency: Engine failure, forced landing

Turboprop/jet aircraft include type-specific maneuver parameters where standard training maneuvers differ. Helicopter (R44) uses helicopter-specific maneuvers.

---

## Implementation Plan (3 Sessions)

### Session 1 — Data model + Components + Cessna family
1. Update `types/index.ts` with new types
2. Build `VSpeedCard.tsx`
3. Build `ReferenceTab.tsx` and sub-components
4. Wire tab toggle into `ChecklistView`
5. Populate `cessna172.ts`, `cessna152.ts`, `cessna182.ts`

### Session 2 — Piper + Complex SEP
- `piperArcher.ts`, `piperWarrior.ts`, `piperSeminole.ts`
- `cirrusSR22.ts`, `diamondDA40.ts`, `mooneyM20.ts`, `beechBonanza.ts`

### Session 3 — Turboprops, MEP, Jets, Helicopter
- `baronG58.ts`, `kingAirC90.ts`, `kingAirB200.ts`
- `cessna208.ts`, `pilatusPC12.ts`, `tbm960.ts`
- `citationCJ4.ts`, `phenom300.ts`
- `robinsonR44.ts`

Each session is independently completable — partial progress is never wasted since aircraft files are self-contained.

---

## Edge Cases

- **Variant V-speeds** (e.g. 160HP vs 180HP on the 172): store as separate keys — `'Vx (160HP)': '59 KIAS', 'Vx (180HP)': '61 KIAS'`
- **Performance tables with notes**: add optional `notes: string[]` to the `table` kind
- **Aircraft with no published performance tables** (some older types): `referenceData` may omit `table` sections — no UI change needed, card simply doesn't render
- **Helicopter maneuvers**: R44 referenceData uses helicopter-specific section titles; same component renders them
