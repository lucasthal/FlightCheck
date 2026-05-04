# User Settings & Preferences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent per-user preferences system (theme, text size, wake lock, default aircraft) stored in Supabase and exposed through a gear-icon settings sheet accessible from every screen.
**Architecture:** A new `usePreferences` hook owns all preference state, loads from Supabase on auth, falls back to localStorage offline, and applies CSS side-effects (theme classes, `--text-scale`); a `SettingsSheet` bottom-sheet/modal provides the full settings UI; `useWakeLock` manages the Screen Wake Lock API independently. The existing `useTheme` hook is fully replaced.
**Tech Stack:** React, TypeScript, Supabase, Tailwind CSS

---

## Task 1 — Supabase table + TypeScript types

**Files:**
- `src/types/index.ts` — modify (append)

### Steps

- [ ] **1.1 — Run this SQL in the Supabase dashboard** (SQL editor, run once):

```sql
-- ── user_preferences ──────────────────────────────────────────────
CREATE TABLE user_preferences (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme               text        NOT NULL DEFAULT 'dark'
                                  CHECK (theme IN ('dark', 'night', 'day')),
  text_size           text        NOT NULL DEFAULT 'md'
                                  CHECK (text_size IN ('sm', 'md', 'lg', 'xl')),
  keep_screen_awake   boolean     NOT NULL DEFAULT false,
  default_aircraft_id text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- updated_at trigger (moddatetime extension must be enabled)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON user_preferences
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **1.2 — Append types to `src/types/index.ts`**

  Open `src/types/index.ts`. At the end of the file, add:

```ts
// ── User Preferences ─────────────────────────────────────────────
export type Theme    = 'dark' | 'night' | 'day'
export type TextSize = 'sm' | 'md' | 'lg' | 'xl'

export interface UserPreferences {
  theme:               Theme
  text_size:           TextSize
  keep_screen_awake:   boolean
  default_aircraft_id: string | null
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:               'dark',
  text_size:           'md',
  keep_screen_awake:   false,
  default_aircraft_id: null,
}
```

- [ ] **1.3 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **1.4 — Commit**

```
git add src/types/index.ts
git commit -m "feat: add Theme, TextSize, UserPreferences types and DEFAULT_PREFERENCES"
```

---

## Task 2 — `usePreferences` hook

**Files:**
- `src/hooks/usePreferences.ts` — create

### Steps

- [ ] **2.1 — Create `src/hooks/usePreferences.ts`** with the full content below:

```ts
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import {
  type UserPreferences,
  type Theme,
  DEFAULT_PREFERENCES,
} from '../types'

const LS_KEY = 'flightcheck-preferences'
const LEGACY_THEME_KEY = 'pilot-theme'

const TEXT_SCALE: Record<UserPreferences['text_size'], number> = {
  sm: 0.875,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
}

interface UsePreferencesResult {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  loading: boolean
}

function readLocalPreferences(): UserPreferences | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserPreferences
  } catch {
    return null
  }
}

function writeLocalPreferences(prefs: UserPreferences): void {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs))
}

export function usePreferences(user: User | null): UsePreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  // ── Load preferences ────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // Unauthenticated: use localStorage only
      const local = readLocalPreferences()
      if (local) setPreferences(local)
      setLoading(false)
      return
    }

    setLoading(true)

    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          // Row found — merge into state
          const loaded: UserPreferences = {
            theme:               data.theme               ?? DEFAULT_PREFERENCES.theme,
            text_size:           data.text_size           ?? DEFAULT_PREFERENCES.text_size,
            keep_screen_awake:   data.keep_screen_awake   ?? DEFAULT_PREFERENCES.keep_screen_awake,
            default_aircraft_id: data.default_aircraft_id ?? DEFAULT_PREFERENCES.default_aircraft_id,
          }
          setPreferences(loaded)
          writeLocalPreferences(loaded)
          setLoading(false)
        } else if (error?.code === 'PGRST116') {
          // No row — upsert defaults with legacy theme migration
          const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY) as Theme | null
          const defaults: UserPreferences = {
            ...DEFAULT_PREFERENCES,
            theme: legacyTheme ?? DEFAULT_PREFERENCES.theme,
          }

          supabase
            .from('user_preferences')
            .upsert({ user_id: user.id, ...defaults }, { onConflict: 'user_id' })
            .then(() => {
              localStorage.removeItem(LEGACY_THEME_KEY)
              setPreferences(defaults)
              writeLocalPreferences(defaults)
              setLoading(false)
            })
        } else {
          // Network error — fall back to localStorage
          const local = readLocalPreferences()
          if (local) setPreferences(local)
          setLoading(false)
        }
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects: theme ─────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'theme-night', 'theme-day')
    if (preferences.theme === 'dark' || preferences.theme === 'night') {
      root.classList.add('dark')
    }
    if (preferences.theme === 'night') root.classList.add('theme-night')
    if (preferences.theme === 'day')   root.classList.add('theme-day')
  }, [preferences.theme])

  // ── Side effects: text size ─────────────────────────────────────
  useEffect(() => {
    document.body.style.setProperty('--text-scale', String(TEXT_SCALE[preferences.text_size]))
  }, [preferences.text_size])

  // ── updatePreference ────────────────────────────────────────────
  function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    // Optimistic update
    setPreferences(prev => {
      const next = { ...prev, [key]: value }
      writeLocalPreferences(next)
      return next
    })

    // Async sync to Supabase — fire and forget
    if (user) {
      supabase
        .from('user_preferences')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }
  }

  return { preferences, updatePreference, loading }
}
```

- [ ] **2.2 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **2.3 — Commit**

```
git add src/hooks/usePreferences.ts
git commit -m "feat: add usePreferences hook with Supabase sync, localStorage fallback, and CSS side-effects"
```

---

## Task 3 — `useWakeLock` hook

**Files:**
- `src/hooks/useWakeLock.ts` — create

### Steps

- [ ] **3.1 — Create `src/hooks/useWakeLock.ts`** with the full content below:

```ts
import { useEffect, useRef } from 'react'

interface UseWakeLockOptions {
  enabled: boolean
}

export function useWakeLock({ enabled }: UseWakeLockOptions): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = async () => {
    if (!enabled) return
    if (!('wakeLock' in navigator)) return
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
    } catch {
      // Wake lock is best-effort; silently swallow errors
    }
  }

  const release = async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {
        // Silently swallow
      }
      sentinelRef.current = null
    }
  }

  useEffect(() => {
    if (!enabled) {
      release()
      return
    }

    acquire()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        acquire()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      release()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **3.2 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **3.3 — Commit**

```
git add src/hooks/useWakeLock.ts
git commit -m "feat: add useWakeLock hook with Screen Wake Lock API and visibilitychange re-acquire"
```

---

## Task 4 — CSS variable for text scale

**Files:**
- `src/index.css` — modify

### Steps

- [ ] **4.1 — Add `--text-scale` to `:root` in `src/index.css`**

  The `:root` block currently ends at line 18 with `}`. Add `--text-scale: 1;` as the last property before the closing brace.

  Find this block:
  ```css
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
  ```

  Replace with:
  ```css
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
    --text-scale:       1;
  }
  ```

- [ ] **4.2 — Commit**

```
git add src/index.css
git commit -m "feat: add --text-scale CSS variable to :root"
```

---

## Task 5 — `SettingsSheet` component

**Files:**
- `src/components/SettingsSheet.tsx` — create

### Steps

- [ ] **5.1 — Create `src/components/SettingsSheet.tsx`** with the full content below:

```tsx
import { Moon, Lightbulb, Sun, X, ChevronRight } from 'lucide-react'
import type { Aircraft, UserPreferences } from '../types'

interface SettingsSheetProps {
  preferences:        UserPreferences
  onUpdatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  allAircraft:        Aircraft[]
  onSignOut:          () => void
  onClose:            () => void
}

const THEME_OPTIONS: { value: UserPreferences['theme']; label: string; icon: React.ReactNode }[] = [
  { value: 'dark',  label: 'Dark',  icon: <Moon      className="w-3.5 h-3.5" /> },
  { value: 'night', label: 'Night', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { value: 'day',   label: 'Day',   icon: <Sun       className="w-3.5 h-3.5" /> },
]

const TEXT_SIZE_OPTIONS: { value: UserPreferences['text_size']; label: string; description: string }[] = [
  { value: 'sm', label: 'S',  description: 'sm — Compact'     },
  { value: 'md', label: 'M',  description: 'md — Default'     },
  { value: 'lg', label: 'L',  description: 'lg — Large'       },
  { value: 'xl', label: 'XL', description: 'xl — Extra Large' },
]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider px-1 mb-3">
      {children}
    </p>
  )
}

function SectionDivider() {
  return <div className="my-5 border-t border-cockpit-border/40" />
}

export function SettingsSheet({
  preferences,
  onUpdatePreference,
  allAircraft,
  onSignOut,
  onClose,
}: SettingsSheetProps) {
  const wakeLockSupported = 'wakeLock' in navigator

  const sortedAircraft = [...allAircraft].sort((a, b) => a.name.localeCompare(b.name))

  const selectedTextSizeOption = TEXT_SIZE_OPTIONS.find(o => o.value === preferences.text_size)

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className={`
          w-full bg-cockpit-panel border border-cockpit-border shadow-cockpit
          overflow-y-auto
          rounded-t-2xl max-h-[85vh]
          sm:rounded-2xl sm:max-w-[480px] sm:max-h-[90vh]
          animate-slide-up sm:animate-fade-in
        `}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-cockpit-border/40">
          <h2 className="text-base font-bold text-cockpit-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-cockpit-text-dim hover:text-cockpit-text-primary transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* ── Section 1: Appearance ───────────────────────────── */}
          <SectionHeading>Appearance</SectionHeading>

          {/* Theme */}
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-cockpit-text-primary">Theme</span>
            <div className="flex gap-1">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onUpdatePreference('theme', opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                    preferences.theme === opt.value
                      ? 'bg-cockpit-amber/15 border-cockpit-amber/40 text-cockpit-amber'
                      : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary hover:text-cockpit-text-primary'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Size */}
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-cockpit-text-primary">Text Size</span>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                {TEXT_SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdatePreference('text_size', opt.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                      preferences.text_size === opt.value
                        ? 'bg-cockpit-amber/15 border-cockpit-amber/40 text-cockpit-amber'
                        : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary hover:text-cockpit-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedTextSizeOption && (
                <span className="text-xs text-cockpit-text-dim">{selectedTextSizeOption.description}</span>
              )}
            </div>
          </div>

          <SectionDivider />

          {/* ── Section 2: Cockpit Display ──────────────────────── */}
          <SectionHeading>Cockpit Display</SectionHeading>

          {/* Keep Screen Awake */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm text-cockpit-text-primary">Keep Screen Awake</span>
              <p className="text-xs text-cockpit-text-dim mt-0.5">
                Prevents display sleep during flight
                {!wakeLockSupported && ' (not supported on this device)'}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={preferences.keep_screen_awake}
              onClick={() => onUpdatePreference('keep_screen_awake', !preferences.keep_screen_awake)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200 ${
                preferences.keep_screen_awake
                  ? 'bg-cockpit-green'
                  : 'bg-cockpit-card border border-cockpit-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  preferences.keep_screen_awake ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <SectionDivider />

          {/* ── Section 3: Navigation ───────────────────────────── */}
          <SectionHeading>Navigation</SectionHeading>

          {/* Default Aircraft */}
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm text-cockpit-text-primary">Default Aircraft</span>
            <select
              value={preferences.default_aircraft_id ?? ''}
              onChange={e => onUpdatePreference('default_aircraft_id', e.target.value || null)}
              className="bg-cockpit-card border border-cockpit-border rounded-lg px-2.5 py-1.5
                         text-xs text-cockpit-text-primary
                         focus:outline-none focus:border-cockpit-amber/40
                         max-w-[180px]"
            >
              <option value="">None — always show selector</option>
              {sortedAircraft.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <SectionDivider />

          {/* ── Section 4: Account ──────────────────────────────── */}
          <SectionHeading>Account</SectionHeading>

          {/* Subscription */}
          <button
            onClick={() => {
              onClose()
              // TODO: navigate to SubscriptionScreen
            }}
            className="w-full flex items-center justify-between gap-4 py-3 text-left"
          >
            <span className="text-sm text-cockpit-text-primary">Subscription</span>
            <ChevronRight className="w-4 h-4 text-cockpit-text-dim flex-shrink-0" />
          </button>

          {/* Sign Out */}
          <button
            onClick={() => { onSignOut(); onClose() }}
            className="w-full flex items-center justify-between gap-4 py-3 text-left"
          >
            <span className="text-sm text-red-400">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **5.2 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **5.3 — Commit**

```
git add src/components/SettingsSheet.tsx
git commit -m "feat: add SettingsSheet component (theme, text size, wake lock, default aircraft, account)"
```

---

## Task 6 — Gear icon in headers

**Files:**
- `src/components/ChecklistView.tsx` — modify
- `src/components/AircraftSelector.tsx` — modify

### Steps

- [ ] **6.1 — Update `ChecklistView` props interface and imports**

  In `src/components/ChecklistView.tsx`:

  **a) Update the import line for lucide-react** — remove `Moon`, `Sun`, `Lightbulb` and add `Settings`:

  Find:
  ```ts
  import {
    ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
    Moon, Sun, Lightbulb, Pencil,
  } from 'lucide-react'
  ```
  Replace with:
  ```ts
  import {
    ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
    Settings, Pencil,
  } from 'lucide-react'
  ```

  **b) Update the Props interface** — remove `onCycleTheme` and `theme`, add `preferences` and `onOpenSettings`:

  Find:
  ```ts
  interface Props {
    aircraft: Aircraft
    onBack: () => void
    onCycleTheme: () => void
    theme: string
  }
  ```
  Replace with:
  ```ts
  import type { UserPreferences } from '../types'

  interface Props {
    aircraft:       Aircraft
    onBack:         () => void
    preferences:    UserPreferences
    onOpenSettings: () => void
  }
  ```

  > Note: The `import type { UserPreferences }` line belongs at the top of the file alongside the other type imports from `'../types'`. Move it there rather than embedding it inside the interface block — place it on the existing `import type { Aircraft, ... } from '../types'` line:

  Find:
  ```ts
  import type { Aircraft, ChecklistPhase, AircraftCategory, PhaseCategory } from '../types'
  ```
  Replace with:
  ```ts
  import type { Aircraft, ChecklistPhase, AircraftCategory, PhaseCategory, UserPreferences } from '../types'
  ```

  **c) Update the function signature**:

  Find:
  ```ts
  export function ChecklistView({ aircraft, onBack, onCycleTheme, theme }: Props) {
  ```
  Replace with:
  ```ts
  export function ChecklistView({ aircraft, onBack, preferences, onOpenSettings }: Props) {
  ```

- [ ] **6.2 — Replace theme-cycle button with gear button in `ChecklistView` header**

  Find:
  ```tsx
          {/* Theme toggle */}
          <button onClick={onCycleTheme} className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim">
            {theme === 'dark' && <Moon className="w-4 h-4" />}
            {theme === 'night' && <Lightbulb className="w-4 h-4 text-amber-400" />}
            {theme === 'day' && <Sun className="w-4 h-4 text-yellow-400" />}
          </button>
  ```
  Replace with:
  ```tsx
          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Settings"
            className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim hover:text-cockpit-text-primary transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
  ```

- [ ] **6.3 — Add `onOpenSettings` prop to `AircraftSelector`**

  In `src/components/AircraftSelector.tsx`:

  **a) Add `Settings` to the lucide-react import**:

  Find:
  ```ts
  import { Search, Zap, Users, Gauge, ArrowUp, Star, LogOut, ChevronDown } from 'lucide-react'
  ```
  Replace with:
  ```ts
  import { Search, Zap, Users, Gauge, ArrowUp, Star, LogOut, ChevronDown, Settings } from 'lucide-react'
  ```

  **b) Update the Props interface**:

  Find:
  ```ts
  interface Props {
    onSelect: (aircraft: Aircraft) => void
  }
  ```
  Replace with:
  ```ts
  interface Props {
    onSelect:       (aircraft: Aircraft) => void
    onOpenSettings: () => void
  }
  ```

  **c) Update the function signature**:

  Find:
  ```ts
  export function AircraftSelector({ onSelect }: Props) {
  ```
  Replace with:
  ```ts
  export function AircraftSelector({ onSelect, onOpenSettings }: Props) {
  ```

  **d) Add gear button to the header, to the left of the profile dropdown button**

  The profile `<div className="relative" ref={profileRef}>` is currently the only element on the right side of the header. Wrap both the gear button and the existing profile div in a flex container.

  Find:
  ```tsx
            {/* Profile */}
            <div className="relative" ref={profileRef}>
  ```
  Replace with:
  ```tsx
            {/* Right side: settings + profile */}
            <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              title="Settings"
              className="p-2 rounded-xl border border-cockpit-border/50 bg-cockpit-card/50
                         hover:border-cockpit-amber/30 text-cockpit-text-dim hover:text-cockpit-text-primary
                         transition-all duration-150"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
  ```

  Then close the new wrapper div after the profile dropdown block. Find the closing `</div>` that ends the profile `<div className="relative" ref={profileRef}>` block (it is the last `</div>` in the `flex items-center justify-between` row before the row's own closing `</div>`). Add a `</div>` after it to close the new wrapper:

  Find the end of the profile section (the closing tags after the profile dropdown `</div>`):
  ```tsx
              )}
            </div>
          </div>
        </div>
  ```

  The innermost `</div>` here closes `ref={profileRef}`. Add one more `</div>` to close the new `flex items-center gap-2` wrapper:
  ```tsx
              )}
            </div>
            </div>
          </div>
        </div>
  ```

- [ ] **6.4 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **6.5 — Commit**

```
git add src/components/ChecklistView.tsx src/components/AircraftSelector.tsx
git commit -m "feat: replace theme-cycle button with gear/settings icon in ChecklistView and AircraftSelector"
```

---

## Task 7 — Text scale applied to checklist items

**Files:**
- `src/components/ChecklistItems.tsx` — modify
- `src/components/PhaseBanner.tsx` — modify

### Steps

- [ ] **7.1 — Apply `--text-scale` to action text in `ChecklistItems.tsx`**

  The action text `<span>` is at approximately line 92–95. Find:
  ```tsx
              <span className={`text-sm font-medium leading-snug transition-colors ${
                checked ? 'text-cockpit-text-dim line-through decoration-cockpit-text-dim/50' : 'text-cockpit-text-primary'
              }`}>
                {item.action}
              </span>
  ```
  Replace with:
  ```tsx
              <span
                className={`text-sm font-medium leading-snug transition-colors ${
                  checked ? 'text-cockpit-text-dim line-through decoration-cockpit-text-dim/50' : 'text-cockpit-text-primary'
                }`}
                style={{ fontSize: 'calc(1rem * var(--text-scale))' }}
              >
                {item.action}
              </span>
  ```

- [ ] **7.2 — Apply `--text-scale` to response text in `ChecklistItems.tsx`**

  The response text `<span>` is at approximately line 112–114. Find:
  ```tsx
              <span className={`text-sm font-mono font-semibold tracking-tight ${
                checked ? 'text-cockpit-green/70' : 'text-cockpit-amber'
              }`}>
                {item.response}
              </span>
  ```
  Replace with:
  ```tsx
              <span
                className={`text-sm font-mono font-semibold tracking-tight ${
                  checked ? 'text-cockpit-green/70' : 'text-cockpit-amber'
                }`}
                style={{ fontSize: 'calc(1rem * var(--text-scale))' }}
              >
                {item.response}
              </span>
  ```

- [ ] **7.3 — Apply `--text-scale` to phase name in `PhaseBanner.tsx`**

  In `src/components/PhaseBanner.tsx`, the phase name `<div>` is at line 55–56. Find:
  ```tsx
          <div className="font-extrabold text-base text-cockpit-text-primary leading-tight truncate">
            {phase.name}
          </div>
  ```
  Replace with:
  ```tsx
          <div
            className="font-extrabold text-base text-cockpit-text-primary leading-tight truncate"
            style={{ fontSize: 'calc(1rem * var(--text-scale))' }}
          >
            {phase.name}
          </div>
  ```

- [ ] **7.4 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **7.5 — Commit**

```
git add src/components/ChecklistItems.tsx src/components/PhaseBanner.tsx
git commit -m "feat: apply --text-scale CSS variable to checklist item action, response, and phase name text"
```

---

## Task 8 — Replace `useTheme` with `usePreferences` in `App.tsx`

**Files:**
- `src/App.tsx` — modify
- `src/hooks/useTheme.ts` — delete

### Steps

- [ ] **8.1 — Rewrite `src/App.tsx`** with the full content below (replaces existing file entirely):

```tsx
import { useState, useEffect } from 'react'
import type { Aircraft } from './types'
import { allAircraft } from './data'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { SettingsSheet } from './components/SettingsSheet'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePreferences } from './hooks/usePreferences'

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { preferences, updatePreference, loading: prefsLoading } = usePreferences(user)
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Resolve default aircraft on launch (only once, after prefs load)
  useEffect(() => {
    if (!prefsLoading && preferences.default_aircraft_id && !selectedAircraft) {
      const aircraft = allAircraft.find(a => a.id === preferences.default_aircraft_id)
      if (aircraft) setSelectedAircraft(aircraft)
    }
  }, [prefsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || prefsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
        <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return (
    <>
      {selectedAircraft ? (
        <ChecklistView
          aircraft={selectedAircraft}
          onBack={() => setSelectedAircraft(null)}
          preferences={preferences}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <AircraftSelector
          onSelect={setSelectedAircraft}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          preferences={preferences}
          onUpdatePreference={updatePreference}
          allAircraft={allAircraft}
          onSignOut={signOut}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **8.2 — Delete `src/hooks/useTheme.ts`**

```bash
git rm src/hooks/useTheme.ts
```

- [ ] **8.3 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors. If there are errors about missing `allAircraft` export from `'./data'`, verify the import path — use whatever path `AircraftSelector` already uses internally (it imports from `'../data'`; from `App.tsx` this is `'./data'`).

- [ ] **8.4 — Commit**

```
git add src/App.tsx
git commit -m "feat: replace useTheme with usePreferences in App.tsx; add settingsOpen state and SettingsSheet wiring"
```

---

## Task 9 — Wire `useWakeLock` in `ChecklistView`

**Files:**
- `src/components/ChecklistView.tsx` — modify

### Steps

- [ ] **9.1 — Add `useWakeLock` import to `ChecklistView.tsx`**

  Find the block of hook imports near the top of the file (around line 3–5):
  ```ts
  import { useChecklist } from '../hooks/useChecklist'
  import { useProfiles } from '../hooks/useProfiles'
  import { useProfileEditor } from '../hooks/useProfileEditor'
  ```
  Replace with:
  ```ts
  import { useChecklist } from '../hooks/useChecklist'
  import { useProfiles } from '../hooks/useProfiles'
  import { useProfileEditor } from '../hooks/useProfileEditor'
  import { useWakeLock } from '../hooks/useWakeLock'
  ```

- [ ] **9.2 — Call `useWakeLock` inside `ChecklistView`**

  Find the line immediately after the function opens its body and destructures props (around line 62–63):
  ```ts
  export function ChecklistView({ aircraft, onBack, preferences, onOpenSettings }: Props) {
    const profiles = useProfiles(aircraft.id)
  ```
  Replace with:
  ```ts
  export function ChecklistView({ aircraft, onBack, preferences, onOpenSettings }: Props) {
    useWakeLock({ enabled: preferences.keep_screen_awake })
    const profiles = useProfiles(aircraft.id)
  ```

- [ ] **9.3 — Type-check**

```bash
npx tsc --noEmit
```

  Expect: no errors.

- [ ] **9.4 — Commit**

```
git add src/components/ChecklistView.tsx
git commit -m "feat: wire useWakeLock in ChecklistView driven by preferences.keep_screen_awake"
```

---

## Verification

After all tasks are complete:

- [ ] Run the dev server: `npm run dev`
- [ ] Sign in — verify the spinner shows during prefs load, then the aircraft selector appears.
- [ ] Open Settings via the gear icon — sheet slides up on mobile, centered modal on desktop.
- [ ] Toggle theme (Dark / Night / Day) — classes update immediately on `<html>`.
- [ ] Change text size — action and response text and phase banner name rescale; nav chrome unchanged.
- [ ] Toggle "Keep Screen Awake" — no JS error (check console); screen stays on during checklist.
- [ ] Set a default aircraft — on next load the aircraft selector is bypassed.
- [ ] Sign out from the Account section — returns to login screen.
- [ ] Run: `npx tsc --noEmit` — expect zero errors.
