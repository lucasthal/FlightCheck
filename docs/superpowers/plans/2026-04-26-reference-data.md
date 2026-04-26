# Reference Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add V-speed pills, a Reference tab, and data (V-speeds, maneuvers, performance tables) to all 19 aircraft.

**Architecture:** Extend the `Aircraft` type with `vSpeeds` and `referenceData` fields. A `VSpeedCard` component renders pills above the checklist. A `ReferenceTab` renders typed section cards. Tab state lives in `ChecklistView`. Data is populated per-aircraft in each `.ts` file.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite (no test framework — verify via `npm run build` and dev server)

---

## File Map

**Modified:**
- `src/types/index.ts` — add `ReferenceSection` type, extend `Aircraft`
- `src/components/ChecklistView.tsx` — add tab state, tab bar, wire VSpeedCard + ReferenceTab
- `src/data/aircraft/cessna172.ts` — add `vSpeeds` + `referenceData`
- `src/data/aircraft/cessna152.ts` — add `vSpeeds` + `referenceData`
- `src/data/aircraft/cessna182.ts` — add `vSpeeds` + `referenceData`

**Created:**
- `src/components/VSpeedCard.tsx`
- `src/components/ReferenceTab.tsx`
- `src/components/reference/SpeedsCard.tsx`
- `src/components/reference/ManeuverCard.tsx`
- `src/components/reference/TableCard.tsx`
- `src/components/reference/KeyValCard.tsx`

---

## Task 1: Extend types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Add `ReferenceSection` type and extend `Aircraft`**

Replace the existing `Aircraft` interface and add new types in `src/types/index.ts`:

```ts
export type ItemSeverity = 'normal' | 'warning' | 'caution' | 'note'

export interface ChecklistItem {
  id: string
  action: string
  response?: string
  note?: string
  severity?: ItemSeverity
  subItems?: string[]
}

export type PhaseCategory =
  | 'preflight'
  | 'startup'
  | 'taxi'
  | 'runup'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'shutdown'
  | 'emergency'

export interface ChecklistPhase {
  id: string
  name: string
  category: PhaseCategory
  items: ChecklistItem[]
}

export type AircraftCategory = 'SEP' | 'MEP' | 'Turboprop' | 'Jet' | 'Helicopter'

export type ReferenceSection =
  | { kind: 'speeds';   title: string; items: Record<string, string> }
  | { kind: 'maneuver'; title: string; steps: string[]; standards?: string[] }
  | { kind: 'table';    title: string; columns: string[]; rows: (string | number)[][]; notes?: string[] }
  | { kind: 'keyval';   title: string; items: Record<string, string> }

export interface Aircraft {
  id: string
  name: string
  manufacturer: string
  model: string
  category: AircraftCategory
  description: string
  specs: {
    engines: number
    engineType: string
    maxSpeed?: string
    range?: string
    ceiling?: string
    seats: number
  }
  vSpeeds: Record<string, string>
  referenceData: ReferenceSection[]
  phases: ChecklistPhase[]
}

export interface ChecklistState {
  aircraftId: string
  phaseId: string
  checkedItems: Record<string, boolean>
  startedAt: string
  completedPhases: string[]
}

export type ViewMode = 'home' | 'checklist' | 'emergency'
```

- [ ] **Verify TypeScript compiles**

```bash
npm run build
```

Expected: build fails with errors on all aircraft files (missing `vSpeeds` and `referenceData`). This is expected — we haven't added the data yet. Check that the errors are only "Property 'vSpeeds' is missing" type errors, not anything else.

- [ ] **Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend Aircraft type with vSpeeds and referenceData"
```

---

## Task 2: VSpeedCard component

**Files:**
- Create: `src/components/VSpeedCard.tsx`

- [ ] **Create the component**

```tsx
import { useState } from 'react'
import type { AircraftCategory } from '../types'

const CATEGORY_ACCENT: Record<AircraftCategory, string> = {
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

interface Props {
  vSpeeds: Record<string, string>
  category: AircraftCategory
}

export function VSpeedCard({ vSpeeds, category }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const accentColor = CATEGORY_ACCENT[category]

  const numericPart = (value: string) => value.split(' ')[0]

  return (
    <div className="relative mb-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(vSpeeds).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setActive(active === key ? null : key)}
            className={`flex-shrink-0 flex items-baseline gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap transition-colors
              ${active === key
                ? 'bg-cockpit-card/80 border-cockpit-border text-cockpit-text-primary'
                : 'bg-cockpit-card/40 border-cockpit-border/60 text-cockpit-text-secondary hover:border-cockpit-border'
              }`}
          >
            <span className="text-cockpit-text-dim">{key}</span>
            <span className={`font-bold ${active === key ? accentColor : ''}`}>{numericPart(value)}</span>
          </button>
        ))}
      </div>

      {active && vSpeeds[active] && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setActive(null)}
          />
          <div className="absolute top-full left-0 mt-1.5 z-20 bg-cockpit-panel border border-cockpit-border rounded-xl px-4 py-2.5 shadow-cockpit text-sm flex items-center gap-2 whitespace-nowrap">
            <span className={`font-mono font-bold text-base ${accentColor}`}>{vSpeeds[active]}</span>
            <span className="text-cockpit-text-dim">·</span>
            <span className="text-cockpit-text-secondary">{active}</span>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/VSpeedCard.tsx
git commit -m "feat: add VSpeedCard component with popover"
```

---

## Task 3: Reference sub-components

**Files:**
- Create: `src/components/reference/SpeedsCard.tsx`
- Create: `src/components/reference/ManeuverCard.tsx`
- Create: `src/components/reference/TableCard.tsx`
- Create: `src/components/reference/KeyValCard.tsx`

- [ ] **Create SpeedsCard**

```tsx
// src/components/reference/SpeedsCard.tsx
interface Props {
  title: string
  items: Record<string, string>
}

export function SpeedsCard({ title, items }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-2 min-w-0">
            <span className="text-sm text-cockpit-text-secondary truncate">{key}</span>
            <span className="text-sm font-mono font-semibold text-cockpit-text-primary flex-shrink-0">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Create ManeuverCard**

```tsx
// src/components/reference/ManeuverCard.tsx
interface Props {
  title: string
  steps: string[]
  standards?: string[]
}

export function ManeuverCard({ title, steps, standards }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <ol className="space-y-1.5 mb-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cockpit-panel border border-cockpit-border text-xs font-mono font-bold text-cockpit-text-dim flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span className="text-cockpit-text-secondary leading-snug">{step}</span>
          </li>
        ))}
      </ol>
      {standards && standards.length > 0 && (
        <div className="border-t border-cockpit-border/50 pt-2.5 mt-1">
          <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider mb-1.5">Standards</p>
          {standards.map((s, i) => (
            <p key={i} className="text-xs text-cockpit-text-dim leading-snug">{s}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Create TableCard**

```tsx
// src/components/reference/TableCard.tsx
interface Props {
  title: string
  columns: string[]
  rows: (string | number)[][]
  notes?: string[]
}

export function TableCard({ title, columns, rows, notes }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs font-mono">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`py-1.5 px-2 text-left font-bold text-cockpit-text-dim bg-cockpit-panel/60
                    ${i === 0 ? 'sticky left-0 bg-cockpit-card z-10' : ''}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-cockpit-panel/20' : ''}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`py-1.5 px-2 text-cockpit-text-secondary
                      ${ci === 0 ? 'sticky left-0 bg-cockpit-card font-semibold text-cockpit-text-primary z-10' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {notes.map((note, i) => (
            <p key={i} className="text-xs text-cockpit-text-dim leading-snug">* {note}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Create KeyValCard**

```tsx
// src/components/reference/KeyValCard.tsx
interface Props {
  title: string
  items: Record<string, string>
}

export function KeyValCard({ title, items }: Props) {
  return (
    <div className="bg-cockpit-card border border-cockpit-border rounded-2xl p-4 mb-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-cockpit-text-dim mb-3">{title}</h3>
      <div className="space-y-2">
        {Object.entries(items).map(([key, value]) => (
          <div key={key} className="flex gap-3">
            <span className="text-sm font-semibold text-cockpit-text-primary flex-shrink-0 w-24">{key}</span>
            <span className="text-sm text-cockpit-text-secondary leading-snug">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/reference/
git commit -m "feat: add reference sub-components (speeds, maneuver, table, keyval)"
```

---

## Task 4: ReferenceTab component

**Files:**
- Create: `src/components/ReferenceTab.tsx`

- [ ] **Create ReferenceTab**

```tsx
// src/components/ReferenceTab.tsx
import type { ReferenceSection } from '../types'
import { SpeedsCard } from './reference/SpeedsCard'
import { ManeuverCard } from './reference/ManeuverCard'
import { TableCard } from './reference/TableCard'
import { KeyValCard } from './reference/KeyValCard'

interface Props {
  sections: ReferenceSection[]
}

export function ReferenceTab({ sections }: Props) {
  if (sections.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-cockpit-text-dim text-sm">
        No reference data available for this aircraft.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
      {sections.map((section, i) => {
        if (section.kind === 'speeds') return <SpeedsCard key={i} title={section.title} items={section.items} />
        if (section.kind === 'maneuver') return <ManeuverCard key={i} title={section.title} steps={section.steps} standards={section.standards} />
        if (section.kind === 'table') return <TableCard key={i} title={section.title} columns={section.columns} rows={section.rows} notes={section.notes} />
        if (section.kind === 'keyval') return <KeyValCard key={i} title={section.title} items={section.items} />
        return null
      })}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/ReferenceTab.tsx
git commit -m "feat: add ReferenceTab component"
```

---

## Task 5: Wire into ChecklistView

**Files:**
- Modify: `src/components/ChecklistView.tsx`

- [ ] **Add tab state and imports at top of ChecklistView**

Add these imports after the existing imports:

```tsx
import { VSpeedCard } from './VSpeedCard'
import { ReferenceTab } from './ReferenceTab'
```

Add tab state inside the `ChecklistView` function, after the existing `useState` declarations:

```tsx
const [activeTab, setActiveTab] = useState<'checklist' | 'reference'>('checklist')
```

- [ ] **Add tab bar to header**

In the `<header>` element, add a tab bar after the existing progress bar `<div className="h-0.5 ...">`:

```tsx
{/* Tab bar */}
<div className="flex border-t border-cockpit-border/40">
  {(['checklist', 'reference'] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors
        ${activeTab === tab
          ? `${accentColor} border-b-2 border-current`
          : 'text-cockpit-text-dim hover:text-cockpit-text-secondary border-b-2 border-transparent'
        }`}
    >
      {tab === 'checklist' ? 'Checklist' : 'Reference'}
    </button>
  ))}
</div>
```

- [ ] **Replace main content area**

Find the `<main ref={contentRef} ...>` block. Replace its contents with:

```tsx
<main ref={contentRef} className="flex-1 overflow-y-auto">
  {activeTab === 'reference' ? (
    <ReferenceTab sections={aircraft.referenceData} />
  ) : activePhase ? (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
      {/* V-speed card */}
      {Object.keys(aircraft.vSpeeds).length > 0 && (
        <VSpeedCard vSpeeds={aircraft.vSpeeds} category={aircraft.category} />
      )}

      <PhaseBanner
        phase={activePhase}
        checked={phaseChecked}
        total={phaseTotal}
        isComplete={isPhaseComplete(activePhaseId)}
        normalPhases={normalPhases}
        activePhaseId={activePhaseId}
        isPhaseComplete={isPhaseComplete}
        category={aircraft.category}
      />

      <ChecklistItems
        phase={activePhase}
        isItemChecked={isItemChecked}
        onToggle={toggleItem}
      />

      <div className="mt-6">
        <button
          onClick={handleCompletePhase}
          disabled={!phaseAllChecked}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-200
            ${phaseAllChecked
              ? 'bg-cockpit-green/15 border-cockpit-green/40 text-cockpit-green hover:bg-cockpit-green/25 shadow-green-glow active:scale-98'
              : 'bg-cockpit-card/30 border-cockpit-border/30 text-cockpit-text-dim cursor-not-allowed'
            }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {isPhaseComplete(activePhaseId) ? 'Phase Complete ✓' : 'Mark Phase Complete & Advance'}
        </button>

        {!phaseAllChecked && phaseTotal > 0 && (
          <p className="text-center text-xs text-cockpit-text-dim mt-2">
            {phaseTotal - phaseChecked} item{phaseTotal - phaseChecked !== 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full text-cockpit-text-dim">
      Select a phase to begin
    </div>
  )}
</main>
```

- [ ] **Verify build compiles**

```bash
npm run build
```

Expected: Still fails on aircraft data files (missing `vSpeeds`/`referenceData`). No new TypeScript errors in component files.

- [ ] **Commit**

```bash
git add src/components/ChecklistView.tsx
git commit -m "feat: wire VSpeedCard and ReferenceTab into ChecklistView"
```

---

## Task 6: Populate cessna172.ts

**Files:**
- Modify: `src/data/aircraft/cessna172.ts`

- [ ] **Add vSpeeds and referenceData to cessna172**

Add these two fields to the `cessna172` object, before `phases:`. Use the FWE Mk3.3 reference sheet data exactly:

```ts
vSpeeds: {
  'Vr':           '55 KIAS',
  'Vx (160HP)':   '59 KIAS',
  'Vx (180HP)':   '61 KIAS',
  'Vy (160HP)':   '71 KIAS',
  'Vy (180HP)':   '73 KIAS',
  'Vs':           '47 KIAS',
  'Vso':          '41 KIAS',
  'Vg':           '65 KIAS',
  'Va (2100lb)':  '92 KIAS',
  'Va (2550lb)':  '105 KIAS',
  'Vno':          '128 KIAS',
  'Vne':          '168 KIAS',
  'Vfe (10°)':    '110 KIAS',
  'Vfe (Full)':   '85 KIAS',
  'Xwind':        '15 KTS',
},
referenceData: [
  {
    kind: 'speeds',
    title: 'V-Speeds Reference',
    items: {
      'Vr — Rotation':             '55 KIAS',
      'Vx — Best Angle (160HP)':   '59 KIAS',
      'Vx — Best Angle (180HP)':   '61 KIAS',
      'Vy — Best Rate (160HP)':    '71 KIAS',
      'Vy — Best Rate (180HP)':    '73 KIAS',
      'Vs — Stall Clean':          '47 KIAS',
      'Vso — Stall Landing':       '41 KIAS',
      'Vg — Best Glide':           '65 KIAS',
      'Va (2100 lb)':              '92 KIAS',
      'Va (2550 lb)':              '105 KIAS',
      'Vno — Max Structural':      '128 KIAS',
      'Vne — Never Exceed':        '168 KIAS',
      'Vfe — Flaps 10°':           '110 KIAS',
      'Vfe — Flaps Full':          '85 KIAS',
      'Xwind Max Demo':            '15 KTS',
    },
  },
  {
    kind: 'keyval',
    title: 'Cruise Performance (MGTOW, 4k PA, 20°C > STD)',
    items: {
      '2100 RPM': '92 KTAS',
      '2200 RPM': '98 KTAS',
      '2300 RPM': '104 KTAS',
      '2400 RPM': '109 KTAS',
      '2500 RPM': '115 KTAS',
      '2550 RPM': '118 KTAS',
    },
  },
  {
    kind: 'table',
    title: 'Takeoff Distance — Short Field, Max Weight 2300 lb',
    columns: ['Press Alt', 'Grnd Roll', 'Total 50 ft OBS'],
    rows: [
      ['S.L.', 720, 1300],
      ['1000', 790, 1420],
      ['2000', 860, 1530],
      ['3000', 950, 1710],
      ['4000', 1045, 1880],
      ['5000', 1155, 2075],
      ['6000', 1265, 2305],
      ['7000', 1400, 2665],
      ['8000', 1550, 2870],
    ],
    notes: [
      'Conditions: Flaps up, full throttle prior to brake release, paved/level/dry runway, zero wind.',
      'Decrease distances 10% for each 9 kts headwind.',
      'For grass runway, increase distances 15% of ground roll figure.',
    ],
  },
  {
    kind: 'table',
    title: 'Landing Distance — Short Field, Max Weight 2300 lb',
    columns: ['Press Alt', 'Grnd Roll', 'Total 50 ft OBS'],
    rows: [
      ['S.L.', 445, 1205],
      ['1000', 510, 1265],
      ['2000', 530, 1300],
      ['3000', 550, 1335],
      ['4000', 570, 1370],
      ['5000', 595, 1415],
      ['6000', 615, 1455],
      ['7000', 640, 1490],
      ['8000', 665, 1500],
    ],
    notes: [
      'Conditions: Flaps 40°, power off, maximum braking, paved/level/dry runway, zero wind.',
      'Decrease distances 10% for each 9 kts headwind.',
      'For grass runway, increase distances 45% of ground roll figure.',
    ],
  },
  {
    kind: 'keyval',
    title: 'PA / DA / VA / CG Formulas',
    items: {
      'Pressure Alt':  '(29.92 – Altimeter Setting) × 1000 + Field Elevation',
      'Density Alt':   'PA + (120 × (OAT °C – ISA °C))',
      'Va (adj)':      '√(Current Weight ÷ MGTOW) × Va MGTOW',
      'CG':            'Total Moment ÷ Total Weight',
    },
  },
  {
    kind: 'keyval',
    title: 'IMSAFE — Crew Check',
    items: {
      'I — Illness':    'Are we feeling good to fly?',
      'M — Medication': 'Are we on any FAA-prohibited medications?',
      'S — Stress':     'Acute and chronic stressors?',
      'A — Alcohol':    '8 hrs bottle-to-throttle, <0.04 BAC, no effects',
      'F — Fatigue':    'Fatigue level — acute or chronic?',
      'E — Eating':     'Have we eaten and fueled our bodies?',
    },
  },
  {
    kind: 'keyval',
    title: 'SAFETY — Passenger Brief',
    items: {
      'S — Seatbelts':   'Demonstrate operation; when to wear',
      'A — Air vents':   'Demonstrate; discuss aeromedical considerations',
      'F — Fire ext':    'Identify location and how to operate',
      'E — Exits':       'Door/window operation, egress, emergency considerations',
      'T — Talking':     'Critical phases, traffic, 3-way exchange of controls',
      'Y — Your items':  'Talk-out, radio freqs, additional safety equipment',
    },
  },
  {
    kind: 'keyval',
    title: 'NWKRAFT — Flight Planning',
    items: {
      'N — NOTAMs':      'Check for relevant NOTAMs',
      'W — Weather':     'Current and forecast weather',
      'K — Known ATC':   'Known ATC delays',
      'R — Runway':      'Runway distances at landing points',
      'A — Alternates':  'Alternate airports required?',
      'F — Fuel':        'Fuel required (VFR: +45 min; IFR: +45 min at alternate)',
      'T — Takeoff':     'Takeoff and landing performance calculated',
    },
  },
  {
    kind: 'maneuver',
    title: 'Steep Turns',
    steps: [
      'Establish reference point and heading',
      'Set throttle 2300 RPM, airspeed 95 KIAS (at or below Va)',
      'Roll to 45° bank (50° for commercial)',
      'Apply two turns of back-pressure trim',
      'Adjust power as required to maintain altitude',
      'Complete 360° turn, roll out on entry heading',
      'Repeat in opposite direction',
    ],
    standards: [
      'Private: ±100 ft altitude, ±10° heading, ±10 KIAS, ±10° bank',
      'Commercial: ±100 ft altitude, ±10° heading, ±10 KIAS, ±5° bank',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Slow Flight',
    steps: [
      'Clear the area (90/180/90 or 360° turn)',
      'Establish reference point and heading',
      'Reduce throttle to 1500 RPM, apply carb heat',
      'Lower flaps as airspeed permits (Vfe: 110/85 KIAS)',
      'Maintain 50 KIAS, adjust throttle as required',
      'Perform turns, climbs, and descents as directed',
    ],
    standards: [
      'Private: ±100 ft altitude, ±10° heading, +10/-0 KIAS',
      'Commercial: ±50 ft altitude, ±10° heading, +10/-0 KIAS',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Power-Off Stall',
    steps: [
      'Clear the area — entry from slow flight',
      'Set throttle 1600 RPM + carb heat, 55–60 KIAS with rate of descent',
      'Reduce throttle to idle',
      'Pitch level, increase back pressure, hold altitude — no sink',
      'Call out: Stall horn → Buffet → Control degradation → Stall (break)',
      'Recover on first indication: full throttle, flaps 20°, Vx, establish climb',
      'Retract flaps 10° at a time',
    ],
    standards: [
      'Private: ±100 ft entry altitude, ±10° heading, recover ≤secondary stall',
      'Commercial: same ±100 ft / ±10° / ±5° bank',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Power-On Stall',
    steps: [
      'Clear the area',
      'Set trim to takeoff, throttle 1200 RPM + carb heat, 55 KIAS',
      'Apply full power, pitch 18–22° (max 25°)',
      'Call out: Stall horn → Buffet → Control degradation → Stall (break)',
      'Recover on first indication: reduce AOA, pitch to Vx, establish climb',
    ],
    standards: [
      'Private: ±100 ft entry altitude, ±10° heading, recover ≤secondary stall',
      'Commercial: same ±100 ft / ±10° / ±5° bank',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Chandelle',
    steps: [
      'Entry airspeed 95–105 KIAS',
      'Establish reference / heading (90° reference)',
      'Apply full throttle',
      'First 90°: roll to 30° bank while slowly increasing pitch to 15°',
      'Second 90°: hold 15° pitch constant, smoothly reduce bank to wings-level',
      'Complete at minimum controllable airspeed on the 180° point',
    ],
    standards: [
      'Commercial only: ±100 ft entry altitude, ±10° heading, ±10 KIAS entry, ±5° bank',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Lazy 8s',
    steps: [
      'Establish 45°, 90°, 135° reference points',
      'Set 2300 RPM, entry airspeed 95–105 KIAS',
      'Constant simultaneous change in pitch, roll, and airspeed throughout',
      'At 45° point: max pitch up, 15° bank',
      'At 90° point: wings-level pitch attitude, max bank 30°',
      'At 135° point: max pitch down, 15° bank',
      'At 180° point: wings-level, entry airspeed, entry altitude',
    ],
    standards: [
      'Commercial only: ±100 ft altitude at 180°, ±10° heading, entry AS ±10 KIAS, ±5° bank',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Steep Spiral',
    steps: [
      'Establish reference point and heading',
      'Enter at +5000 AGL (3 turns at 1000 ft per turn, exit 1500 AGL)',
      'Smoothly reduce throttle to idle',
      'Establish Vg (65 KIAS)',
      'Enter on downwind leg, 45° bank',
      'Complete 3 turns, clearing engine every turn',
      'Roll out on entry heading at 1500 AGL',
    ],
    standards: [
      'Commercial only: ±100 ft altitude, ±10° heading, ±10 KIAS, bank not to exceed 60°',
    ],
  },
  {
    kind: 'maneuver',
    title: 'Accelerated Stall',
    steps: [
      'Clear the area (Alt NLT 3000 AGL)',
      'Set throttle 1600 RPM + carb heat, 75 KIAS, 45° bank',
      'Smoothly and firmly increase back pressure',
      'Recover on first indication: reduce AOA, full power, establish Vx climb',
    ],
    standards: [
      'Commercial: recover ≤secondary stall, ±5° bank at recovery',
    ],
  },
  {
    kind: 'maneuver',
    title: '8s on Pylons',
    steps: [
      'Establish reference points and determine wind direction',
      'Set throttle 2200 RPM',
      'Enter at pivotal altitude for current groundspeed',
      'Bank not to exceed 40°',
      'Adjust bank to keep wingtip on pylon reference line',
    ],
    standards: [
      'Commercial only. Pivotal Alt (ft AGL) = GS(kts)² ÷ 11.3',
      'GS 87→670 ft | 91→735 ft | 96→810 ft | 100→885 ft | 104→960 ft | 109→1050 ft | 113→1130 ft',
    ],
  },
],
```

- [ ] **Verify build passes**

```bash
npm run build
```

Expected: Still fails — cessna152 and cessna182 still missing the new fields. No new errors in cessna172.ts.

- [ ] **Commit**

```bash
git add src/data/aircraft/cessna172.ts
git commit -m "feat: add vSpeeds and referenceData to Cessna 172 (FWE Mk3.3)"
```

---

## Task 7: Populate cessna152.ts

**Files:**
- Modify: `src/data/aircraft/cessna152.ts`

- [ ] **Read the current file to understand its structure**

Read `src/data/aircraft/cessna152.ts` and note the object structure before adding fields.

- [ ] **Web-search Cessna 152 V-speeds and performance data**

Search: `"Cessna 152" POH V-speeds Vr Vx Vy Vno Vne Vfe KIAS`  
Search: `"Cessna 152" takeoff distance short field performance table`

Expected key values (verify against search results):
- Vr: ~54 KIAS, Vx: 67 KIAS, Vy: 73 KIAS, Vs: 43 KIAS, Vso: 35 KIAS
- Vno: 111 KIAS, Vne: 149 KIAS, Vfe (Full): 85 KIAS

- [ ] **Add vSpeeds and referenceData**

Add the fields using the same pattern as cessna172.ts. Include:
- `vSpeeds`: key V-speeds (Vr, Vx, Vy, Vs, Vso, Vno, Vne, Vfe, Va, Vg)
- `referenceData`: `speeds` section, cruise performance `keyval`, takeoff/landing `table` sections, maneuvers matching those in cessna172 (same FAA standards apply — reuse the maneuver steps exactly from Task 6, adjusting any 172-specific RPM/airspeed values for the 152's 110 HP engine)

- [ ] **Commit**

```bash
git add src/data/aircraft/cessna152.ts
git commit -m "feat: add vSpeeds and referenceData to Cessna 152"
```

---

## Task 8: Populate cessna182.ts

**Files:**
- Modify: `src/data/aircraft/cessna182.ts`

- [ ] **Read the current file**

Read `src/data/aircraft/cessna182.ts`.

- [ ] **Web-search Cessna 182 V-speeds and performance**

Search: `"Cessna 182" Skylane POH V-speeds performance data KIAS`

Expected key values (verify against search):
- Vr: ~55 KIAS, Vx: 65 KIAS, Vy: 80 KIAS, Vs: 50 KIAS, Vso: 43 KIAS
- Vno: 140 KIAS, Vne: 175 KIAS, Vfe: 85/100 KIAS, Va: ~111 KIAS

- [ ] **Add vSpeeds and referenceData**

Same pattern as cessna172.ts. Include V-speeds, cruise performance, takeoff/landing tables, and maneuvers (same FAA maneuver standards, 182-specific RPM/airspeed values).

- [ ] **Verify full build passes**

```bash
npm run build
```

Expected: Build fails only for remaining aircraft files (piperArcher, etc.) — all three Cessnas and all components should be clean.

- [ ] **Commit**

```bash
git add src/data/aircraft/cessna182.ts
git commit -m "feat: add vSpeeds and referenceData to Cessna 182"
```

---

## Task 9: Visual verification

- [ ] **Start dev server**

```bash
npm run dev
```

- [ ] **Open Cessna 172 in browser and verify:**
  1. V-speed pills appear above the checklist content
  2. Tapping a pill shows a popover with full label and value; tapping outside dismisses it
  3. Pills scroll horizontally when they overflow
  4. **Reference** tab appears in the header tab bar
  5. Switching to Reference tab shows all sections (V-Speeds, Cruise, Takeoff table, Landing table, formulas, IMSAFE, SAFETY, NWKRAFT, all maneuvers)
  6. Performance tables scroll horizontally; first column stays sticky
  7. Switching back to **Checklist** tab restores the checklist view

- [ ] **Verify on Cessna 152 and 182** — same checks

- [ ] **Check an aircraft that hasn't been updated yet** (e.g. Piper Archer) — the build should fail TypeScript before reaching this point; this step is a reminder that all remaining aircraft must be updated before a production build passes

---

## Session 2 — Piper + Complex SEP (Tasks 10–16)

**Repeat the pattern from Tasks 7–8 for each aircraft:**

For each file — read current, web-search V-speeds + performance, add `vSpeeds` + `referenceData`, commit.

| Task | File | Key search terms |
|---|---|---|
| 10 | `piperArcher.ts` | "Piper Archer PA-28-181" POH V-speeds performance |
| 11 | `piperWarrior.ts` | "Piper Warrior PA-28-161" POH V-speeds |
| 12 | `piperSeminole.ts` | "Piper Seminole PA-44" multi-engine V-speeds Vmc |
| 13 | `cirrusSR22.ts` | "Cirrus SR22" POH V-speeds CAPS |
| 14 | `diamondDA40.ts` | "Diamond DA40" POH V-speeds |
| 15 | `mooneyM20.ts` | "Mooney M20" POH V-speeds retractable |
| 16 | `beechBonanza.ts` | "Beechcraft Bonanza A36" POH V-speeds |

**Note for piperSeminole.ts:** Add Vmc to vSpeeds — critical for multi-engine. Include OEI (One Engine Inoperative) climb performance as a `keyval` section.

---

## Session 3 — Turboprops, MEP, Jets, Helicopter (Tasks 17–25)

| Task | File | Key search terms | Notes |
|---|---|---|---|
| 17 | `baronG58.ts` | "Beechcraft Baron G58" POH V-speeds | Add Vmc |
| 18 | `kingAirC90.ts` | "King Air C90" POH V-speeds turboprop | PT6 engine limits |
| 19 | `kingAirB200.ts` | "King Air B200" POH V-speeds | Higher performance tables |
| 20 | `cessna208.ts` | "Cessna 208 Caravan" POH V-speeds | Single turboprop |
| 21 | `pilatusPC12.ts` | "Pilatus PC-12" POH V-speeds | |
| 22 | `tbm960.ts` | "TBM 960" POH V-speeds | Very high cruise performance |
| 23 | `citationCJ4.ts` | "Citation CJ4" POH V-speeds jet | Include V1, Vr, V2 |
| 24 | `phenom300.ts` | "Phenom 300E" POH V-speeds | Include V1, Vr, V2 |
| 25 | `robinsonR44.ts` | "Robinson R44" POH V-speeds helicopter | Use hover/autorotation data instead of fixed-wing maneuvers |

**Note for jets (Tasks 23–24):** Add `V1` (decision speed), `V2` (takeoff safety speed) to vSpeeds. Maneuvers section should reflect type-specific procedures rather than FAA ACS fixed-wing maneuvers.

**Note for robinsonR44.ts:** Replace fixed-wing maneuver sections with: Hover (OGE/IGE), Autorotation, Hovering Autorotation, Simulated Engine Failure at altitude.

---

## Final Task: Full build verification

After all 19 aircraft are populated:

- [ ] **Full TypeScript build**

```bash
npm run build
```

Expected: Clean build, zero TypeScript errors.

- [ ] **Commit**

```bash
git add src/data/aircraft/
git commit -m "feat: complete reference data for all 19 aircraft"
```
