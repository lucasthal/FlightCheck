# Phase Nav & Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain phase header and mobile hamburger-only navigation with an EFIS-style phase banner and a persistent scrollable phase strip at the bottom of the screen.

**Architecture:** Two new components (`PhaseBanner`, `PhaseStrip`) are extracted from `ChecklistView`. `PhaseBanner` renders at the top of the content area and replaces the existing `<h2>` + radial progress block. `PhaseStrip` renders as the mobile bottom bar and replaces the existing `lg:hidden` bottom bar. `ChecklistView` wires them in. No other files change.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, existing cockpit theme CSS variables, lucide-react icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/PhaseBanner.tsx` | Phase banner (accent border, icon, name, count, %) + segmented phase bar |
| Create | `src/components/PhaseStrip.tsx` | Mobile bottom nav — actions row (EMERG + reset) + scrollable phase pill strip |
| Modify | `src/components/ChecklistView.tsx` | Import new components; remove old phase header block and old mobile bottom bar; remove unused `Clock` import |
| Modify | `src/index.css` | Add `.scrollbar-none` utility class |

---

## Task 1: Add `.scrollbar-none` CSS utility

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add utility to `src/index.css`**

In the `@layer utilities` block (after the existing safe-area utilities at the bottom of the file), add:

```css
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/Louie/.local/bin/PilotChecklist
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add scrollbar-none utility class"
```

---

## Task 2: Create `PhaseBanner` component

**Files:**
- Create: `src/components/PhaseBanner.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/PhaseBanner.tsx
import { CheckCircle2 } from 'lucide-react'
import type { AircraftCategory, ChecklistPhase } from '../types'

const PHASE_ICONS: Record<string, string> = {
  preflight: '🔍',
  startup: '🔑',
  taxi: '🛞',
  runup: '⚙️',
  takeoff: '↑',
  climb: '📈',
  cruise: '✈',
  descent: '📉',
  approach: '🎯',
  landing: '⬇',
  shutdown: '🔒',
  emergency: '🚨',
}

const ACCENT_HEX: Record<AircraftCategory, string> = {
  SEP:        '#38bdf8',
  MEP:        '#a78bfa',
  Turboprop:  '#f59e0b',
  Jet:        '#fb7185',
  Helicopter: '#34d399',
}

interface Props {
  phase: ChecklistPhase
  checked: number
  total: number
  isComplete: boolean
  normalPhases: ChecklistPhase[]
  activePhaseId: string
  getPhaseProgress: (id: string) => { checked: number; total: number }
  isPhaseComplete: (id: string) => boolean
  category: AircraftCategory
}

export function PhaseBanner({
  phase,
  checked,
  total,
  isComplete,
  normalPhases,
  activePhaseId,
  getPhaseProgress,
  isPhaseComplete,
  category,
}: Props) {
  const hex = ACCENT_HEX[category]
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const icon = PHASE_ICONS[phase.category] ?? '📋'

  return (
    <div className="mb-5">
      {/* Banner */}
      <div
        className="rounded-r-xl px-3 py-3 flex items-center gap-3 relative overflow-hidden"
        style={{
          border: '1px solid #1e3a5f',
          borderLeft: `3px solid ${hex}`,
          background: `linear-gradient(90deg, ${hex}0f 0%, transparent 70%)`,
        }}
      >
        {/* Phase icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{
            border: `1px solid ${hex}4d`,
            background: `${hex}14`,
          }}
        >
          {icon}
        </div>

        {/* Name + item count */}
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-base text-cockpit-text-primary leading-tight truncate">
            {phase.name}
          </div>
          <div className="font-mono text-xs mt-0.5 uppercase tracking-wide">
            {isComplete ? (
              <span className="flex items-center gap-1 text-cockpit-green">
                <CheckCircle2 className="w-3 h-3" />
                {checked} of {total} · complete
              </span>
            ) : (
              <span className="text-cockpit-text-dim">
                {checked} of {total} items · in progress
              </span>
            )}
          </div>
        </div>

        {/* Percentage / complete mark */}
        <div
          className="font-mono font-bold text-2xl flex-shrink-0 tabular-nums"
          style={{ color: isComplete ? '#22c55e' : hex }}
        >
          {isComplete ? '✓' : `${pct}%`}
        </div>
      </div>

      {/* Segmented phase bar */}
      <div className="flex gap-0.5 mt-1.5">
        {normalPhases.map(p => {
          const complete = isPhaseComplete(p.id)
          const active = p.id === activePhaseId
          return (
            <div
              key={p.id}
              className="flex-1 h-0.5 rounded-full transition-all duration-500"
              style={{
                background: complete ? '#22c55e' : active ? hex : '#1e293b',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/Louie/.local/bin/PilotChecklist
npx tsc --noEmit
```

Expected: no output (clean). If errors, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/components/PhaseBanner.tsx
git commit -m "feat: add PhaseBanner component with segmented phase bar"
```

---

## Task 3: Create `PhaseStrip` component

**Files:**
- Create: `src/components/PhaseStrip.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/PhaseStrip.tsx
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { AircraftCategory, ChecklistPhase } from '../types'

const PHASE_ICONS: Record<string, string> = {
  preflight: '🔍',
  startup: '🔑',
  taxi: '🛞',
  runup: '⚙️',
  takeoff: '↑',
  climb: '📈',
  cruise: '✈',
  descent: '📉',
  approach: '🎯',
  landing: '⬇',
  shutdown: '🔒',
  emergency: '🚨',
}

const ACCENT_HEX: Record<AircraftCategory, string> = {
  SEP:        '#38bdf8',
  MEP:        '#a78bfa',
  Turboprop:  '#f59e0b',
  Jet:        '#fb7185',
  Helicopter: '#34d399',
}

interface Props {
  normalPhases: ChecklistPhase[]
  emergencyPhases: ChecklistPhase[]
  activePhaseId: string
  isPhaseComplete: (id: string) => boolean
  onSelectPhase: (id: string) => void
  onEmergency: () => void
  onReset: () => void
  category: AircraftCategory
}

export function PhaseStrip({
  normalPhases,
  emergencyPhases,
  activePhaseId,
  isPhaseComplete,
  onSelectPhase,
  onEmergency,
  onReset,
  category,
}: Props) {
  const hex = ACCENT_HEX[category]

  return (
    <div className="lg:hidden safe-bottom flex-shrink-0 bg-cockpit-panel border-t border-cockpit-border z-10">
      {/* Actions row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-cockpit-border/40">
        {emergencyPhases.length > 0 && (
          <button onClick={onEmergency} className="emergency-btn flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <span>EMERG</span>
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Flight
        </button>
      </div>

      {/* Scrollable phase pill strip */}
      <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none">
        {normalPhases.map(phase => {
          const complete = isPhaseComplete(phase.id)
          const active = phase.id === activePhaseId
          const icon = PHASE_ICONS[phase.category] ?? '📋'

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 text-xs font-medium border transition-all duration-200 active:scale-95"
              style={
                active
                  ? { background: `${hex}1a`, borderColor: `${hex}59`, color: hex }
                  : complete
                  ? { background: '#22c55e12', borderColor: '#22c55e33', color: '#22c55e' }
                  : { background: 'transparent', borderColor: '#1e3a5f', color: '#475569' }
              }
            >
              <span className="text-sm leading-none">{icon}</span>
              <span>{complete ? `✓ ${phase.name}` : phase.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/Users/Louie/.local/bin/PilotChecklist
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/PhaseStrip.tsx
git commit -m "feat: add PhaseStrip mobile bottom nav component"
```

---

## Task 4: Wire new components into `ChecklistView`

**Files:**
- Modify: `src/components/ChecklistView.tsx`

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `ChecklistView.tsx`. Remove `Clock` (no longer used after the bottom bar is replaced). Keep `CheckCircle2` — it is still used in the "Mark Phase Complete" CTA button. Add imports for `PhaseBanner` and `PhaseStrip`.

Change this:
```tsx
import {
  ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2, Clock,
  Moon, Sun, Lightbulb,
} from 'lucide-react'
```

To this:
```tsx
import {
  ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
  Moon, Sun, Lightbulb,
} from 'lucide-react'
import { PhaseBanner } from './PhaseBanner'
import { PhaseStrip } from './PhaseStrip'
```

- [ ] **Step 2: Remove the unused `phaseProgress` variable**

After removing the phase header in Step 3, `phaseProgress` becomes dead code. Remove it now so TypeScript stays clean. Find this line near the top of the `ChecklistView` function body:

```tsx
const phaseProgress = phaseTotal > 0 ? (phaseChecked / phaseTotal) * 100 : 0
```

Delete that line entirely. `phaseChecked`, `phaseTotal`, and `phaseAllChecked` are still used — only `phaseProgress` is removed.

- [ ] **Step 3: Replace the phase header block with `<PhaseBanner>`**

Find this block inside the `activePhase ? (...)` branch (the `{/* Phase header */}` comment and the `<div className="mb-5">` that follows it, ending before `{/* Checklist items */}`):

```tsx
              {/* Phase header */}
              <div className="mb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-cockpit-text-primary leading-tight">{activePhase.name}</h2>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-sm text-cockpit-text-secondary font-mono">
                        {phaseChecked}/{phaseTotal} items
                      </span>
                      {isPhaseComplete(activePhaseId) && (
                        <span className="flex items-center gap-1 text-xs text-cockpit-green font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Complete
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phase radial progress */}
                  <div className="relative flex-shrink-0 w-14 h-14">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-cockpit-card" />
                      <circle
                        cx="18" cy="18" r="15.5"
                        fill="none" strokeWidth="2.5"
                        strokeLinecap="round"
                        stroke={phaseAllChecked ? '#22c55e' : '#f59e0b'}
                        strokeDasharray={`${phaseProgress} 100`}
                        style={{ transition: 'stroke-dasharray 0.4s ease' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-cockpit-text-primary tabular-nums">
                      {Math.round(phaseProgress)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-1 bg-cockpit-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${phaseProgress}%`,
                      background: phaseAllChecked ? '#22c55e' : '#f59e0b',
                    }}
                  />
                </div>
              </div>
```

Replace with:

```tsx
              <PhaseBanner
                phase={activePhase}
                checked={phaseChecked}
                total={phaseTotal}
                isComplete={isPhaseComplete(activePhaseId)}
                normalPhases={normalPhases}
                activePhaseId={activePhaseId}
                getPhaseProgress={getPhaseProgress}
                isPhaseComplete={isPhaseComplete}
                category={aircraft.category}
              />
```

- [ ] **Step 4: Replace the mobile bottom bar with `<PhaseStrip>`**

Find this block (after the Reset modal, before the closing `</div>` of the outer flex column):

```tsx
      {/* Mobile bottom bar */}
      <div className="lg:hidden safe-bottom flex-shrink-0 bg-cockpit-panel border-t border-cockpit-border px-4 py-2 flex items-center gap-3 z-10">
        {emergencyPhases.length > 0 && (
          <button onClick={() => setShowEmergency(true)} className="emergency-btn flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <span>EMERG</span>
          </button>
        )}
        <div className="flex-1 flex items-center gap-2 text-xs text-cockpit-text-dim overflow-hidden">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{activePhase?.name ?? '—'}</span>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="p-2 rounded-xl text-cockpit-text-dim hover:text-cockpit-amber transition-colors flex-shrink-0"
          title="New flight"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
```

Replace with:

```tsx
      <PhaseStrip
        normalPhases={normalPhases}
        emergencyPhases={emergencyPhases}
        activePhaseId={activePhaseId}
        isPhaseComplete={isPhaseComplete}
        onSelectPhase={handlePhaseSelect}
        onEmergency={() => setShowEmergency(true)}
        onReset={() => setShowResetConfirm(true)}
        category={aircraft.category}
      />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd C:/Users/Louie/.local/bin/PilotChecklist
npx tsc --noEmit
```

Expected: no output (clean). Fix any type errors before continuing.

- [ ] **Step 6: Start dev server and visually verify**

```bash
npm run dev
```

Open the app on your iPhone (or browser DevTools iPhone simulator). Verify:

1. Opening any aircraft shows the phase banner at the top of the content area with the phase icon, name, item count, and % readout
2. The segmented bar beneath it shows one segment per phase — the active phase is accent-colored, completed phases are green, rest are dim
3. The bottom of the screen shows the EMERG + New Flight row above a scrollable pill strip
4. Tapping a pill navigates to that phase — the banner and segmented bar update
5. The hamburger menu still works on mobile (unchanged)
6. The desktop sidebar still works at lg+ breakpoint (unchanged)

- [ ] **Step 7: Commit**

```bash
git add src/components/ChecklistView.tsx
git commit -m "feat: wire PhaseBanner and PhaseStrip into ChecklistView"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|-----------------|------------|
| Phase banner with accent left border | Task 2 — `PhaseBanner` border style |
| Icon in bordered box | Task 2 — icon box div |
| Phase name bold + monospace item count | Task 2 — banner text section |
| % readout in accent color | Task 2 — `pct` display |
| Complete state: green + checkmark | Task 2 — `isComplete` branch |
| Segmented bar, one segment per phase | Task 2 — `normalPhases.map` bar |
| Green/accent/dim segment states | Task 2 — segment `background` style |
| Bottom strip replaces mobile bottom bar | Task 3 — `PhaseStrip` |
| EMERG + New Flight actions row | Task 3 — actions row |
| Scrollable phase pills | Task 3 — `overflow-x-auto scrollbar-none` |
| Active/done/pending pill states | Task 3 — pill inline styles |
| Desktop sidebar unchanged | Task 4 — no changes to `PhaseNavContent` |
| Phase banner renders on all screen sizes | Task 2 — no responsive hiding |
| Bottom strip `lg:hidden` | Task 3 — `lg:hidden` class |
| Safe area bottom padding | Task 3 — `safe-bottom` class |
