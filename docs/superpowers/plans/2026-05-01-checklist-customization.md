# Checklist Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user named checklist profiles — users can edit, add, delete, and reorder checklist items and phases, with the original POH data always preserved as a read-only baseline.

**Architecture:** Three new Supabase tables (`checklist_profiles`, `profile_phases`, `profile_items`) store per-user checklist copies. `useProfiles` fetches and manages profiles; `useProfileEditor` holds in-memory edit state. In edit mode, `ChecklistView` renders `ChecklistEditorView` (a full-outline editor with sortable phases and items). Outside edit mode, the active profile is converted to an `Aircraft`-shaped object so all existing components work unchanged.

**Tech Stack:** Supabase v2, React 18, TypeScript, `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop, Tailwind cockpit theme.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `ProfileItem`, `ProfilePhase`, `Profile` types |
| Create | `src/hooks/useProfiles.ts` | Fetch/create/delete/rename/activate profiles for an aircraft |
| Create | `src/hooks/useProfileEditor.ts` | In-memory edit state: add/delete/rename/reorder items and phases |
| Create | `src/components/ProfilePicker.tsx` | Dropdown: active profile name, all profiles, Save As, Reset |
| Create | `src/components/SaveAsDialog.tsx` | Name-entry modal for Save As |
| Create | `src/components/ChecklistEditorView.tsx` | Full-outline edit view: sortable phases + items |
| Modify | `src/components/ChecklistView.tsx` | Edit toggle, profile integration, unsaved-changes guard |

---

## Task 1: Supabase SQL Setup

> Manual steps — no code. Run each block in Supabase Dashboard → SQL Editor → New Query → Run.

- [ ] **Step 1: Create tables**

```sql
CREATE TABLE checklist_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aircraft_id text NOT NULL,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, aircraft_id, name)
);

CREATE TABLE profile_phases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES checklist_profiles(id) ON DELETE CASCADE,
  position   integer NOT NULL,
  title      text NOT NULL,
  category   text NOT NULL
);

CREATE TABLE profile_items (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES profile_phases(id) ON DELETE CASCADE,
  position integer NOT NULL,
  action   text NOT NULL,
  response text,
  note     text,
  severity text
);
```

- [ ] **Step 2: Add partial unique index**

```sql
CREATE UNIQUE INDEX one_active_profile_per_aircraft
  ON checklist_profiles (user_id, aircraft_id)
  WHERE is_active = true;
```

- [ ] **Step 3: Add RLS policies**

```sql
ALTER TABLE checklist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profiles" ON checklist_profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE profile_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phases" ON profile_phases
  USING (profile_id IN (SELECT id FROM checklist_profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM checklist_profiles WHERE user_id = auth.uid()));

ALTER TABLE profile_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON profile_items
  USING (phase_id IN (
    SELECT pp.id FROM profile_phases pp
    JOIN checklist_profiles cp ON cp.id = pp.profile_id
    WHERE cp.user_id = auth.uid()
  ))
  WITH CHECK (phase_id IN (
    SELECT pp.id FROM profile_phases pp
    JOIN checklist_profiles cp ON cp.id = pp.profile_id
    WHERE cp.user_id = auth.uid()
  ));
```

- [ ] **Step 4: Add atomic profile-activation RPC**

```sql
CREATE OR REPLACE FUNCTION activate_profile(p_profile_id uuid)
RETURNS void AS $$
DECLARE
  v_aircraft_id text;
  v_user_id uuid;
BEGIN
  SELECT aircraft_id, user_id INTO v_aircraft_id, v_user_id
  FROM checklist_profiles
  WHERE id = p_profile_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or access denied';
  END IF;

  UPDATE checklist_profiles
  SET is_active = false
  WHERE user_id = v_user_id AND aircraft_id = v_aircraft_id;

  UPDATE checklist_profiles
  SET is_active = true
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 5: Verify**

  In Table Editor, confirm `checklist_profiles`, `profile_phases`, `profile_items` all appear. Check RLS is enabled on each. No code commit — this is a database-only step.

---

## Task 2: Profile Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add profile types to `src/types/index.ts`**

  Add after the existing `ChecklistState` type (after line 67):

```ts
export interface ProfileItem {
  id: string
  action: string
  response?: string
  note?: string
  severity?: ItemSeverity
  position: number
}

export interface ProfilePhase {
  id: string
  title: string
  category: PhaseCategory
  position: number
  items: ProfileItem[]
}

export interface Profile {
  id: string
  name: string
  aircraft_id: string
  is_active: boolean
  phases: ProfilePhase[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Profile, ProfilePhase, ProfileItem types"
```

---

## Task 3: useProfiles Hook

**Files:**
- Create: `src/hooks/useProfiles.ts`

- [ ] **Step 1: Create `src/hooks/useProfiles.ts`**

```ts
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Aircraft, PhaseCategory, ItemSeverity, Profile, ProfilePhase, ProfileItem } from '../types'

type RawItem = {
  id: string; action: string; response: string | null; note: string | null
  severity: string | null; position: number
}
type RawPhase = {
  id: string; title: string; category: string; position: number
  profile_items: RawItem[]
}
type RawProfile = {
  id: string; name: string; aircraft_id: string; is_active: boolean
  profile_phases: RawPhase[]
}

function mapProfile(raw: RawProfile): Profile {
  return {
    id: raw.id,
    name: raw.name,
    aircraft_id: raw.aircraft_id,
    is_active: raw.is_active,
    phases: (raw.profile_phases ?? [])
      .sort((a, b) => a.position - b.position)
      .map((ph): ProfilePhase => ({
        id: ph.id,
        title: ph.title,
        category: ph.category as PhaseCategory,
        position: ph.position,
        items: (ph.profile_items ?? [])
          .sort((a, b) => a.position - b.position)
          .map((i): ProfileItem => ({
            id: i.id,
            action: i.action,
            response: i.response ?? undefined,
            note: i.note ?? undefined,
            severity: (i.severity as ItemSeverity) ?? undefined,
            position: i.position,
          })),
      })),
  }
}

const PROFILE_SELECT = `
  id, name, aircraft_id, is_active,
  profile_phases (
    id, title, category, position,
    profile_items ( id, action, response, note, severity, position )
  )
`

export function useProfiles(aircraftId: string) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    if (!user) { setProfiles([]); return [] }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('checklist_profiles')
        .select(PROFILE_SELECT)
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
        .order('created_at')
      if (error) throw error
      const mapped = (data as RawProfile[] ?? []).map(mapProfile)
      setProfiles(mapped)
      return mapped
    } finally {
      setLoading(false)
    }
  }, [user, aircraftId])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const createFromAircraft = useCallback(async (aircraft: Aircraft, name: string): Promise<Profile[]> => {
    if (!user) throw new Error('Not authenticated')

    const { data: profileData, error: profileError } = await supabase
      .from('checklist_profiles')
      .insert({ user_id: user.id, aircraft_id: aircraftId, name, is_active: false })
      .select('id')
      .single()
    if (profileError) throw profileError

    const phases = [...aircraft.phases].sort((a, b) => {
      const aEmerg = a.category === 'emergency' ? 1 : 0
      const bEmerg = b.category === 'emergency' ? 1 : 0
      return aEmerg - bEmerg
    })

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]
      const { data: phaseData, error: phaseError } = await supabase
        .from('profile_phases')
        .insert({ profile_id: profileData.id, position: i, title: phase.name, category: phase.category })
        .select('id')
        .single()
      if (phaseError) throw phaseError

      if (phase.items.length > 0) {
        const { error: itemError } = await supabase.from('profile_items').insert(
          phase.items.map((item, j) => ({
            phase_id: phaseData.id, position: j,
            action: item.action,
            response: item.response ?? null,
            note: item.note ?? null,
            severity: item.severity ?? null,
          }))
        )
        if (itemError) throw itemError
      }
    }

    await supabase.rpc('activate_profile', { p_profile_id: profileData.id })
    return fetchProfiles()
  }, [user, aircraftId, fetchProfiles])

  const createFromProfile = useCallback(async (source: Profile, name: string): Promise<Profile[]> => {
    if (!user) throw new Error('Not authenticated')

    const { data: profileData, error: profileError } = await supabase
      .from('checklist_profiles')
      .insert({ user_id: user.id, aircraft_id: aircraftId, name, is_active: false })
      .select('id')
      .single()
    if (profileError) throw profileError

    for (const phase of source.phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from('profile_phases')
        .insert({ profile_id: profileData.id, position: phase.position, title: phase.title, category: phase.category })
        .select('id')
        .single()
      if (phaseError) throw phaseError

      if (phase.items.length > 0) {
        const { error: itemError } = await supabase.from('profile_items').insert(
          phase.items.map(item => ({
            phase_id: phaseData.id, position: item.position,
            action: item.action,
            response: item.response ?? null,
            note: item.note ?? null,
            severity: item.severity ?? null,
          }))
        )
        if (itemError) throw itemError
      }
    }

    await supabase.rpc('activate_profile', { p_profile_id: profileData.id })
    return fetchProfiles()
  }, [user, aircraftId, fetchProfiles])

  const deleteProfile = useCallback(async (profileId: string): Promise<void> => {
    await supabase.from('checklist_profiles').delete().eq('id', profileId)
    await fetchProfiles()
  }, [fetchProfiles])

  const renameProfile = useCallback(async (profileId: string, name: string): Promise<void> => {
    await supabase.from('checklist_profiles').update({ name }).eq('id', profileId)
    await fetchProfiles()
  }, [fetchProfiles])

  const setActive = useCallback(async (profileId: string | null): Promise<void> => {
    if (!user) return
    if (profileId === null) {
      await supabase
        .from('checklist_profiles')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
    } else {
      await supabase.rpc('activate_profile', { p_profile_id: profileId })
    }
    await fetchProfiles()
  }, [user, aircraftId, fetchProfiles])

  const activeProfile = profiles.find(p => p.is_active) ?? null

  return { profiles, activeProfile, loading, fetchProfiles, createFromAircraft, createFromProfile, deleteProfile, renameProfile, setActive }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfiles.ts
git commit -m "feat: add useProfiles hook"
```

---

## Task 4: useProfileEditor Hook

**Files:**
- Create: `src/hooks/useProfileEditor.ts`

- [ ] **Step 1: Create `src/hooks/useProfileEditor.ts`**

```ts
import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfilePhase, ProfileItem, ItemSeverity, PhaseCategory } from '../types'

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function useProfileEditor() {
  const [phases, setPhases] = useState<ProfilePhase[]>([])
  const originalRef = useRef<ProfilePhase[]>([])

  const load = useCallback((incoming: ProfilePhase[]) => {
    const copy = deepCopy(incoming)
    setPhases(copy)
    originalRef.current = deepCopy(incoming)
  }, [])

  const isDirty = JSON.stringify(phases) !== JSON.stringify(originalRef.current)

  const addItem = useCallback((phaseId: string, item: Omit<ProfileItem, 'id' | 'position'>) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      const newItem: ProfileItem = { ...item, id: crypto.randomUUID(), position: ph.items.length }
      return { ...ph, items: [...ph.items, newItem] }
    }))
  }, [])

  const updateItem = useCallback((phaseId: string, itemId: string, patch: Partial<Pick<ProfileItem, 'action' | 'response' | 'note' | 'severity'>>) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      return { ...ph, items: ph.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
    }))
  }, [])

  const deleteItem = useCallback((phaseId: string, itemId: string) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      return { ...ph, items: ph.items.filter(i => i.id !== itemId).map((i, idx) => ({ ...i, position: idx })) }
    }))
  }, [])

  const reorderItems = useCallback((phaseId: string, newOrder: string[]) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      const itemMap = new Map(ph.items.map(i => [i.id, i]))
      return { ...ph, items: newOrder.map((id, idx) => ({ ...itemMap.get(id)!, position: idx })) }
    }))
  }, [])

  const addPhase = useCallback((title: string, category: PhaseCategory) => {
    setPhases(prev => [...prev, {
      id: crypto.randomUUID(),
      title,
      category,
      position: prev.length,
      items: [],
    }])
  }, [])

  const updatePhase = useCallback((phaseId: string, patch: Partial<Pick<ProfilePhase, 'title' | 'category'>>) => {
    setPhases(prev => prev.map(ph => ph.id === phaseId ? { ...ph, ...patch } : ph))
  }, [])

  const deletePhase = useCallback((phaseId: string) => {
    setPhases(prev =>
      prev.filter(ph => ph.id !== phaseId).map((ph, idx) => ({ ...ph, position: idx }))
    )
  }, [])

  const reorderPhases = useCallback((newOrder: string[]) => {
    setPhases(prev => {
      const phaseMap = new Map(prev.map(ph => [ph.id, ph]))
      return newOrder.map((id, idx) => ({ ...phaseMap.get(id)!, position: idx }))
    })
  }, [])

  const save = useCallback(async (profileId: string): Promise<void> => {
    // Full replace: delete all existing phases (cascade deletes items) then re-insert
    const { error: deleteError } = await supabase
      .from('profile_phases')
      .delete()
      .eq('profile_id', profileId)
    if (deleteError) throw deleteError

    for (const phase of phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from('profile_phases')
        .insert({ profile_id: profileId, position: phase.position, title: phase.title, category: phase.category })
        .select('id')
        .single()
      if (phaseError) throw phaseError

      if (phase.items.length > 0) {
        const { error: itemError } = await supabase.from('profile_items').insert(
          phase.items.map((item, j) => ({
            phase_id: phaseData.id, position: j,
            action: item.action,
            response: item.response ?? null,
            note: item.note ?? null,
            severity: item.severity ?? null,
          }))
        )
        if (itemError) throw itemError
      }
    }

    await supabase
      .from('checklist_profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profileId)

    // Mark as clean — caller must reload editor with fresh profile to resync IDs
    originalRef.current = deepCopy(phases)
  }, [phases])

  const reset = useCallback(() => {
    setPhases(deepCopy(originalRef.current))
  }, [])

  return { phases, isDirty, load, addItem, updateItem, deleteItem, reorderItems, addPhase, updatePhase, deletePhase, reorderPhases, save, reset }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfileEditor.ts
git commit -m "feat: add useProfileEditor hook"
```

---

## Task 5: ProfilePicker Component

**Files:**
- Create: `src/components/ProfilePicker.tsx`

- [ ] **Step 1: Create `src/components/ProfilePicker.tsx`**

```tsx
import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Check, Plus, RotateCcw } from 'lucide-react'
import type { Profile } from '../types'

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
  onSelect: (profileId: string | null) => void   // null = select Original
  onSaveAs: () => void
  onResetToOriginal: () => void   // deletes active profile
  disabled?: boolean
}

export function ProfilePicker({ profiles, activeProfile, onSelect, onSaveAs, onResetToOriginal, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = activeProfile ? activeProfile.name : 'Original (POH)'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cockpit-border/50
                   bg-cockpit-card/50 text-xs text-cockpit-text-secondary
                   hover:border-cockpit-amber/30 hover:text-cockpit-text-primary
                   disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Checklist profiles"
          className="absolute left-0 top-full mt-1 w-56 bg-cockpit-panel border border-cockpit-border
                     rounded-xl shadow-cockpit z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-cockpit-border/50">
            <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider">Profiles</p>
          </div>

          {/* Original */}
          <button
            role="option"
            aria-selected={!activeProfile}
            onClick={() => { onSelect(null); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left
                       hover:bg-cockpit-card transition-colors"
          >
            {!activeProfile
              ? <Check className="w-3.5 h-3.5 text-cockpit-amber flex-shrink-0" />
              : <span className="w-3.5 h-3.5 flex-shrink-0" />
            }
            <span className={!activeProfile ? 'text-cockpit-text-primary font-medium' : 'text-cockpit-text-secondary'}>
              Original (POH)
            </span>
          </button>

          {/* Custom profiles */}
          {profiles.map(p => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.is_active}
              onClick={() => { onSelect(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left
                         hover:bg-cockpit-card transition-colors"
            >
              {p.is_active
                ? <Check className="w-3.5 h-3.5 text-cockpit-amber flex-shrink-0" />
                : <span className="w-3.5 h-3.5 flex-shrink-0" />
              }
              <span className={p.is_active ? 'text-cockpit-text-primary font-medium' : 'text-cockpit-text-secondary'}>
                {p.name}
              </span>
            </button>
          ))}

          <div className="border-t border-cockpit-border/50 p-1">
            <button
              onClick={() => { onSaveAs(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cockpit-text-secondary
                         hover:bg-cockpit-card hover:text-cockpit-text-primary rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Save As new profile…
            </button>
            {activeProfile && (
              <button
                onClick={() => { onResetToOriginal(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cockpit-text-dim
                           hover:bg-cockpit-card hover:text-red-400 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to original…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfilePicker.tsx
git commit -m "feat: add ProfilePicker component"
```

---

## Task 6: SaveAsDialog Component

**Files:**
- Create: `src/components/SaveAsDialog.tsx`

- [ ] **Step 1: Create `src/components/SaveAsDialog.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  /** If set, this is the name being copied (shown as hint). If null, editing the original. */
  sourceProfileName: string | null
  existingNames: string[]
  onSave: (name: string) => void
  onCancel: () => void
}

export function SaveAsDialog({ sourceProfileName, existingNames, onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const trimmed = name.trim()
  const duplicate = existingNames.includes(trimmed)
  const empty = trimmed.length === 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (empty || duplicate) return
    onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-cockpit-text-primary">
              {sourceProfileName ? 'Save As New Profile' : 'Name Your Profile'}
            </h3>
            <p className="text-xs text-cockpit-text-dim mt-1">
              {sourceProfileName
                ? `Copying "${sourceProfileName}"`
                : 'The original POH checklist will not be changed.'}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5 text-cockpit-text-dim">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. IFR Cross-Country"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
                       focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                       transition-all duration-150 mb-1"
          />
          {duplicate && (
            <p className="text-xs text-red-400 mb-3">A profile with this name already exists.</p>
          )}
          {!duplicate && <div className="mb-3" />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary
                         text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={empty || duplicate}
              className="flex-1 py-3 rounded-xl bg-cockpit-amber/15 border border-cockpit-amber/40
                         text-cockpit-amber text-sm font-semibold hover:bg-cockpit-amber/25
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SaveAsDialog.tsx
git commit -m "feat: add SaveAsDialog component"
```

---

## Task 7: Install @dnd-kit + ChecklistEditorView

**Files:**
- Create: `src/components/ChecklistEditorView.tsx`

- [ ] **Step 1: Install dnd-kit packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

  Expected: no errors, packages appear in `package.json`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 3: Create `src/components/ChecklistEditorView.tsx`**

```tsx
import { useState, useCallback } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import type { ProfilePhase, ProfileItem, PhaseCategory } from '../types'
import type { useProfileEditor } from '../hooks/useProfileEditor'

type Editor = ReturnType<typeof useProfileEditor>

const PHASE_CATEGORIES: PhaseCategory[] = [
  'preflight', 'startup', 'taxi', 'runup', 'takeoff',
  'climb', 'cruise', 'descent', 'approach', 'landing', 'shutdown', 'emergency',
]

interface Props {
  editor: Editor
  profileName: string
  onSave: () => void
  onSaveAs: () => void
  onDiscard: () => void
  saving: boolean
}

export function ChecklistEditorView({ editor, profileName, onSave, onSaveAs, onDiscard, saving }: Props) {
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseTitle, setNewPhaseTitle] = useState('')
  const [newPhaseCategory, setNewPhaseCategory] = useState<PhaseCategory>('preflight')

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const phaseIds = editor.phases.map(ph => ph.id)

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const isPhase = phaseIds.includes(active.id as string)
    if (isPhase) {
      const oldIdx = phaseIds.indexOf(active.id as string)
      const newIdx = phaseIds.indexOf(over.id as string)
      if (newIdx === -1) return
      editor.reorderPhases(arrayMove(phaseIds, oldIdx, newIdx))
    } else {
      const sourcePhase = editor.phases.find(ph => ph.items.some(i => i.id === active.id))
      if (!sourcePhase) return
      const itemIds = sourcePhase.items.map(i => i.id)
      const oldIdx = itemIds.indexOf(active.id as string)
      const newIdx = itemIds.indexOf(over.id as string)
      if (newIdx === -1) return
      editor.reorderItems(sourcePhase.id, arrayMove(itemIds, oldIdx, newIdx))
    }
  }, [editor, phaseIds])

  const handleAddPhase = () => {
    const title = newPhaseTitle.trim()
    if (!title) return
    editor.addPhase(title, newPhaseCategory)
    setNewPhaseTitle('')
    setNewPhaseCategory('preflight')
    setAddingPhase(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 px-3 py-2.5 bg-cockpit-amber/5
                      border border-cockpit-amber/20 rounded-xl">
        <div>
          <p className="text-xs font-semibold text-cockpit-amber">Edit Mode</p>
          <p className="text-xs text-cockpit-text-dim truncate max-w-[160px]">{profileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
                       hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSaveAs}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
                       hover:bg-white/5 disabled:opacity-40 transition-colors"
          >
            Save As
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
                       text-cockpit-amber text-xs font-semibold hover:bg-cockpit-amber/25
                       disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Sortable phases + items */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phaseIds} strategy={verticalListSortingStrategy}>
          {editor.phases.map(phase => (
            <SortablePhaseSection key={phase.id} phase={phase} editor={editor} />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add phase */}
      {addingPhase ? (
        <div className="mt-4 p-3 bg-cockpit-card border border-cockpit-amber/20 rounded-xl space-y-2">
          <input
            type="text"
            placeholder="Phase name (e.g. Cruise)"
            value={newPhaseTitle}
            onChange={e => setNewPhaseTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
                       focus:outline-none focus:border-cockpit-amber/50 transition-all"
          />
          <select
            value={newPhaseCategory}
            onChange={e => setNewPhaseCategory(e.target.value as PhaseCategory)}
            className="w-full px-3 py-2 rounded-lg bg-cockpit-bg border border-cockpit-border
                       text-cockpit-text-secondary text-sm focus:outline-none focus:border-cockpit-amber/50"
          >
            {PHASE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setAddingPhase(false)}
              className="flex-1 py-2 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPhase}
              disabled={!newPhaseTitle.trim()}
              className="flex-1 py-2 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
                         text-cockpit-amber text-xs font-semibold disabled:opacity-40"
            >
              Add Phase
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingPhase(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     border border-dashed border-cockpit-border text-xs text-cockpit-text-dim
                     hover:border-cockpit-amber/30 hover:text-cockpit-text-secondary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Phase
        </button>
      )}
    </div>
  )
}

function SortablePhaseSection({ phase, editor }: { phase: ProfilePhase; editor: Editor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id })
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(phase.title)
  const itemIds = phase.items.map(i => i.id)

  const commitTitle = () => {
    const t = titleDraft.trim()
    if (t && t !== phase.title) editor.updatePhase(phase.id, { title: t })
    else setTitleDraft(phase.title)
    setEditingTitle(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-4 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Phase header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder phase"
          className="text-cockpit-text-dim hover:text-cockpit-text-secondary cursor-grab active:cursor-grabbing p-0.5"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {editingTitle ? (
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(phase.title); setEditingTitle(false) } }}
            autoFocus
            className="flex-1 px-2 py-1 rounded-lg bg-cockpit-bg border border-cockpit-amber/50
                       text-cockpit-text-primary text-sm font-semibold focus:outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-cockpit-text-primary">{phase.title}</span>
        )}

        <button
          onClick={() => { setTitleDraft(phase.title); setEditingTitle(true) }}
          aria-label={`Rename phase ${phase.title}`}
          className="p-1 rounded-lg text-cockpit-text-dim hover:text-cockpit-amber hover:bg-cockpit-card transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => editor.deletePhase(phase.id)}
          aria-label={`Delete phase ${phase.title}`}
          className="p-1 rounded-lg text-cockpit-text-dim hover:text-red-400 hover:bg-cockpit-card transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items */}
      <div className="bg-cockpit-card/40 border border-cockpit-border/40 rounded-xl overflow-hidden">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {phase.items.map((item, idx) => (
            <SortableItemRow key={item.id} item={item} index={idx} phaseId={phase.id} editor={editor} />
          ))}
        </SortableContext>

        {/* Add item */}
        <button
          onClick={() => editor.addItem(phase.id, { action: 'New item' })}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cockpit-text-dim
                     hover:bg-cockpit-card hover:text-cockpit-text-secondary border-t border-cockpit-border/30
                     transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add item
        </button>
      </div>
    </div>
  )
}

function SortableItemRow({ item, index, phaseId, editor }: { item: ProfileItem; index: number; phaseId: string; editor: Editor }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.action)

  const commitEdit = () => {
    const t = draft.trim()
    if (t && t !== item.action) editor.updateItem(phaseId, item.id, { action: t })
    else setDraft(item.action)
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2.5 border-b border-cockpit-border/20 last:border-b-0
                  bg-cockpit-card/30 ${isDragging ? 'opacity-50 z-50' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder item"
        className="text-cockpit-text-dim hover:text-cockpit-text-secondary cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs font-mono text-cockpit-text-dim flex-shrink-0 w-5 text-right">
        {String(index + 1).padStart(2, '0')}
      </span>

      {editing ? (
        <>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setDraft(item.action); setEditing(false) } }}
            autoFocus
            className="flex-1 px-2 py-0.5 rounded-lg bg-cockpit-bg border border-cockpit-amber/50
                       text-cockpit-text-primary text-sm focus:outline-none"
          />
          <button onClick={commitEdit} aria-label="Confirm edit" className="p-1 text-cockpit-amber">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setDraft(item.action); setEditing(false) }} aria-label="Cancel edit" className="p-1 text-cockpit-text-dim">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-cockpit-text-primary leading-snug min-w-0 truncate">
            {item.action}
          </span>
          <button
            onClick={() => { setDraft(item.action); setEditing(true) }}
            aria-label={`Edit item ${item.action}`}
            className="p-1 rounded-lg text-cockpit-text-dim hover:text-cockpit-amber hover:bg-cockpit-bg transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => editor.deleteItem(phaseId, item.id)}
            aria-label={`Delete item ${item.action}`}
            className="p-1 rounded-lg text-cockpit-text-dim hover:text-red-400 hover:bg-cockpit-bg transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChecklistEditorView.tsx package.json package-lock.json
git commit -m "feat: add ChecklistEditorView with sortable phases and items"
```

---

## Task 8: Wire Into ChecklistView

**Files:**
- Modify: `src/components/ChecklistView.tsx`

This task adds profile integration to the checklist view. The changes:
1. Call `useProfiles(aircraft.id)` and build a merged `activeAircraft` for rendering
2. Add `ProfilePicker` to the header (below aircraft name)
3. Show `ChecklistEditorView` instead of normal content when `editMode === true`
4. Edit toggle button in the header
5. `SaveAsDialog` overlay (shown when editing original or choosing Save As)
6. Unsaved-changes confirmation before back, profile switch, or discard

- [ ] **Step 1: Replace `src/components/ChecklistView.tsx`**

```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Aircraft, ChecklistPhase, AircraftCategory, PhaseCategory } from '../types'
import { useChecklist } from '../hooks/useChecklist'
import { useProfiles } from '../hooks/useProfiles'
import { useProfileEditor } from '../hooks/useProfileEditor'
import { PhaseNav } from './PhaseNav'
import { ChecklistItems } from './ChecklistItems'
import { EmergencyPanel } from './EmergencyPanel'
import { ProfilePicker } from './ProfilePicker'
import { SaveAsDialog } from './SaveAsDialog'
import { ChecklistEditorView } from './ChecklistEditorView'
import {
  ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
  Moon, Sun, Lightbulb, Pencil,
} from 'lucide-react'
import { PhaseBanner } from './PhaseBanner'
import { PhaseStrip } from './PhaseStrip'
import { VSpeedCard } from './VSpeedCard'
import { ReferenceTab } from './ReferenceTab'

const CATEGORY_ACCENT: Record<AircraftCategory, string> = {
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

const CATEGORY_BORDER: Record<AircraftCategory, string> = {
  SEP:        'border-sky-500/30',
  MEP:        'border-violet-500/30',
  Turboprop:  'border-amber-500/30',
  Jet:        'border-rose-500/30',
  Helicopter: 'border-emerald-500/30',
}

interface Props {
  aircraft: Aircraft
  onBack: () => void
  onCycleTheme: () => void
  theme: string
}

/** Convert ProfilePhase[] → ChecklistPhase[] so existing components work unchanged */
function profileToChecklistPhases(phases: import('../types').ProfilePhase[]): ChecklistPhase[] {
  return phases.map(ph => ({
    id: ph.id,
    name: ph.title,
    category: ph.category as PhaseCategory,
    items: ph.items.map(i => ({
      id: i.id,
      action: i.action,
      response: i.response,
      note: i.note,
      severity: i.severity,
    })),
  }))
}

export function ChecklistView({ aircraft, onBack, onCycleTheme, theme }: Props) {
  const profiles = useProfiles(aircraft.id)
  const editor = useProfileEditor()

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsSource, setSaveAsSource] = useState<'original' | 'profile'>('original')
  const [showNewFlightConfirm, setShowNewFlightConfirm] = useState(false)
  const [showResetProfileConfirm, setShowResetProfileConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingBack, setPendingBack] = useState(false)
  const [pendingProfileId, setPendingProfileId] = useState<string | null | undefined>(undefined) // undefined = not pending

  // Build active aircraft: original phases replaced by profile phases if active profile exists
  const activeAircraft: Aircraft = profiles.activeProfile
    ? { ...aircraft, phases: profileToChecklistPhases(profiles.activeProfile.phases) }
    : aircraft

  const {
    activePhaseId, selectPhase, toggleItem, completePhase, resetFlight,
    getPhaseProgress, isItemChecked, isPhaseComplete,
  } = useChecklist(activeAircraft)

  const [showEmergency, setShowEmergency] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'checklist' | 'reference'>('checklist')
  const contentRef = useRef<HTMLDivElement>(null)

  const normalPhases = activeAircraft.phases.filter(p => p.category !== 'emergency')
  const emergencyPhases = activeAircraft.phases.filter(p => p.category === 'emergency')
  const activePhase = activeAircraft.phases.find(p => p.id === activePhaseId)

  const { checked: phaseChecked, total: phaseTotal } = getPhaseProgress(activePhaseId)
  const phaseAllChecked = phaseTotal > 0 && phaseChecked === phaseTotal

  const totalItems = normalPhases.reduce((sum, p) => sum + p.items.length, 0)
  const totalChecked = normalPhases.reduce((sum, p) => sum + getPhaseProgress(p.id).checked, 0)
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  const accentColor = CATEGORY_ACCENT[aircraft.category]
  const accentBorder = CATEGORY_BORDER[aircraft.category]

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePhaseId])

  // ── Edit mode helpers ──────────────────────────────────────────────────────

  const enterEditMode = useCallback(() => {
    if (!profiles.activeProfile) {
      // On original — must Save As first
      setSaveAsSource('original')
      setShowSaveAs(true)
    } else {
      editor.load(profiles.activeProfile.phases)
      setEditMode(true)
    }
  }, [profiles.activeProfile, editor])

  const handleSave = useCallback(async () => {
    if (!profiles.activeProfile) return
    setSaving(true)
    try {
      await editor.save(profiles.activeProfile.id)
      const freshProfiles = await profiles.fetchProfiles()
      const freshProfile = freshProfiles.find(p => p.id === profiles.activeProfile!.id)
      if (freshProfile) editor.load(freshProfile.phases)
    } finally {
      setSaving(false)
    }
  }, [profiles, editor])

  const handleSaveAsFromEditMode = useCallback(() => {
    setSaveAsSource('profile')
    setShowSaveAs(true)
  }, [])

  const handleDiscard = useCallback(() => {
    if (editor.isDirty) {
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
    }
  }, [editor])

  const handleSaveAsConfirm = useCallback(async (name: string) => {
    setShowSaveAs(false)
    if (saveAsSource === 'original') {
      // Copying from original aircraft data — returns fresh Profile[] so we don't read stale state
      const freshProfiles = await profiles.createFromAircraft(aircraft, name)
      const newProfile = freshProfiles.find(p => p.name === name)
      if (newProfile) {
        editor.load(newProfile.phases)
        setEditMode(true)
      }
    } else {
      // Copying from current profile
      if (!profiles.activeProfile) return
      const freshProfiles = await profiles.createFromProfile(profiles.activeProfile, name)
      const newProfile = freshProfiles.find(p => p.name === name)
      if (newProfile) {
        editor.load(newProfile.phases)
        setEditMode(true)
      }
    }
  }, [saveAsSource, profiles, aircraft, editor])

  // Guard: back button while editing
  const handleBack = useCallback(() => {
    if (editMode && editor.isDirty) {
      setPendingBack(true)
      setShowDiscardConfirm(true)
    } else {
      onBack()
    }
  }, [editMode, editor.isDirty, onBack])

  // Guard: profile switch while editing
  const handleProfileSelect = useCallback((profileId: string | null) => {
    if (editMode && editor.isDirty) {
      setPendingProfileId(profileId)
      setShowDiscardConfirm(true)
    } else {
      setEditMode(false)
      profiles.setActive(profileId)
    }
  }, [editMode, editor.isDirty, profiles])

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardConfirm(false)
    editor.reset()
    setEditMode(false)
    if (pendingBack) {
      setPendingBack(false)
      onBack()
    } else if (pendingProfileId !== undefined) {
      profiles.setActive(pendingProfileId)
      setPendingProfileId(undefined)
    }
  }, [editor, onBack, pendingBack, pendingProfileId, profiles])

  const handlePhaseSelect = (phaseId: string) => {
    selectPhase(phaseId)
    setSidebarOpen(false)
  }

  const handleCompletePhase = () => {
    completePhase(activePhaseId)
    const idx = normalPhases.findIndex(p => p.id === activePhaseId)
    if (idx < normalPhases.length - 1) handlePhaseSelect(normalPhases[idx + 1].id)
  }

  if (showEmergency) {
    return <EmergencyPanel phases={emergencyPhases} onClose={() => setShowEmergency(false)} />
  }

  return (
    <div className="flex flex-col h-screen bg-cockpit-bg overflow-hidden">
      {/* Top bar */}
      <header className={`safe-top flex-shrink-0 bg-cockpit-panel border-b ${accentBorder} shadow-cockpit z-20`}>
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}>
                {aircraft.category}
              </span>
              <span className="text-cockpit-text-dim text-xs">·</span>
              <span className="text-xs text-cockpit-text-dim truncate">{aircraft.manufacturer}</span>
            </div>
            <div className="font-bold text-sm truncate leading-tight text-cockpit-text-primary">
              {aircraft.model} — {aircraft.name.split(' ').slice(-1)[0]}
            </div>
            {/* Profile picker */}
            <div className="mt-1">
              <ProfilePicker
                profiles={profiles.profiles}
                activeProfile={profiles.activeProfile}
                onSelect={handleProfileSelect}
                onSaveAs={() => { setSaveAsSource(profiles.activeProfile ? 'profile' : 'original'); setShowSaveAs(true) }}
                onResetToOriginal={() => setShowResetProfileConfirm(true)}
                disabled={editMode}
              />
            </div>
          </div>

          {/* Progress badge */}
          {!editMode && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border ${
                overallProgress === 100
                  ? 'bg-cockpit-green/10 border-cockpit-green/30 text-cockpit-green'
                  : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary'
              }`}>
                {overallProgress}%
              </div>
            </div>
          )}

          {/* Edit toggle */}
          {!editMode && (
            <button
              onClick={enterEditMode}
              title="Edit checklist"
              className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim hover:text-cockpit-amber transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}

          {/* Emergency — desktop */}
          {!editMode && emergencyPhases.length > 0 && (
            <button onClick={() => setShowEmergency(true)} className="hidden sm:flex emergency-btn">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>EMERG</span>
            </button>
          )}

          {/* Theme toggle */}
          <button onClick={onCycleTheme} className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim">
            {theme === 'dark' && <Moon className="w-4 h-4" />}
            {theme === 'night' && <Lightbulb className="w-4 h-4 text-amber-400" />}
            {theme === 'day' && <Sun className="w-4 h-4 text-yellow-400" />}
          </button>

          {/* Mobile menu */}
          {!editMode && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress bar — hidden in edit mode */}
        {!editMode && (
          <div className="h-0.5 bg-cockpit-card">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${overallProgress}%`,
                background: overallProgress === 100
                  ? '#22c55e'
                  : `linear-gradient(90deg, #f59e0b, #d97706)`,
              }}
            />
          </div>
        )}

        {/* Tab bar — hidden in edit mode */}
        {!editMode && (
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
        )}
      </header>

      {/* Edit mode: full-outline editor */}
      {editMode ? (
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <ChecklistEditorView
            editor={editor}
            profileName={profiles.activeProfile?.name ?? ''}
            onSave={handleSave}
            onSaveAs={handleSaveAsFromEditMode}
            onDiscard={handleDiscard}
            saving={saving}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-cockpit-panel/60 border-r border-cockpit-border/50 overflow-y-auto">
            <PhaseNavContent
              aircraft={activeAircraft}
              normalPhases={normalPhases}
              emergencyPhases={emergencyPhases}
              activePhaseId={activePhaseId}
              onSelectPhase={handlePhaseSelect}
              onEmergency={() => setShowEmergency(true)}
              onReset={() => setShowNewFlightConfirm(true)}
              getPhaseProgress={getPhaseProgress}
              isPhaseComplete={isPhaseComplete}
              totalChecked={totalChecked}
              totalItems={totalItems}
            />
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-cockpit-panel border-r border-cockpit-border flex flex-col animate-slide-in-right">
                <div className="flex items-center justify-between px-4 py-4 border-b border-cockpit-border safe-top">
                  <div>
                    <div className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}>{aircraft.category}</div>
                    <div className="font-semibold text-cockpit-text-primary text-sm">{aircraft.name}</div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-white/5">
                    <X className="w-5 h-5 text-cockpit-text-secondary" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <PhaseNavContent
                    aircraft={activeAircraft}
                    normalPhases={normalPhases}
                    emergencyPhases={emergencyPhases}
                    activePhaseId={activePhaseId}
                    onSelectPhase={handlePhaseSelect}
                    onEmergency={() => { setShowEmergency(true); setSidebarOpen(false) }}
                    onReset={() => { setShowNewFlightConfirm(true); setSidebarOpen(false) }}
                    getPhaseProgress={getPhaseProgress}
                    isPhaseComplete={isPhaseComplete}
                    totalChecked={totalChecked}
                    totalItems={totalItems}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <main ref={contentRef} className="flex-1 overflow-y-auto">
            {activeTab === 'reference' ? (
              <ReferenceTab sections={aircraft.referenceData} />
            ) : activePhase ? (
              <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
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
                <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={toggleItem} />
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
        </div>
      )}

      {!editMode && (
        <PhaseStrip
          normalPhases={normalPhases}
          emergencyPhases={emergencyPhases}
          activePhaseId={activePhaseId}
          isPhaseComplete={isPhaseComplete}
          onSelectPhase={handlePhaseSelect}
          onEmergency={() => setShowEmergency(true)}
          onReset={() => setShowNewFlightConfirm(true)}
          category={aircraft.category}
        />
      )}

      {/* Reset to original modal — deletes active profile */}
      {showResetProfileConfirm && profiles.activeProfile && (
        <ConfirmModal
          title="Reset to Original?"
          body={`This will permanently delete the "${profiles.activeProfile.name}" profile and revert to the POH checklist.`}
          confirmLabel="Reset to Original"
          confirmClass="text-cockpit-amber border-cockpit-amber/40 bg-cockpit-amber/15 hover:bg-cockpit-amber/25"
          onConfirm={async () => {
            if (profiles.activeProfile) await profiles.deleteProfile(profiles.activeProfile.id)
            setShowResetProfileConfirm(false)
          }}
          onCancel={() => setShowResetProfileConfirm(false)}
        />
      )}

      {/* New flight reset modal — clears checked items only */}
      {showNewFlightConfirm && (
        <ResetFlightModal
          aircraftName={aircraft.name}
          onConfirm={() => {
            const first = normalPhases[0]
            if (first) resetFlight(aircraft.id, first.id)
            setShowNewFlightConfirm(false)
          }}
          onCancel={() => setShowNewFlightConfirm(false)}
        />
      )}

      {/* Discard changes confirmation */}
      {showDiscardConfirm && (
        <ConfirmModal
          title="Discard Changes?"
          body="You have unsaved edits. Discard them?"
          confirmLabel="Discard"
          confirmClass="text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
          onConfirm={handleDiscardConfirm}
          onCancel={() => { setShowDiscardConfirm(false); setPendingBack(false); setPendingProfileId(undefined) }}
        />
      )}

      {/* Save As dialog */}
      {showSaveAs && (
        <SaveAsDialog
          sourceProfileName={saveAsSource === 'profile' ? (profiles.activeProfile?.name ?? null) : null}
          existingNames={profiles.profiles.map(p => p.name)}
          onSave={handleSaveAsConfirm}
          onCancel={() => setShowSaveAs(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components (unchanged from original) ────────────────────────────────

interface PhaseNavContentProps {
  aircraft: Aircraft
  normalPhases: ChecklistPhase[]
  emergencyPhases: ChecklistPhase[]
  activePhaseId: string
  onSelectPhase: (id: string) => void
  onEmergency: () => void
  onReset: () => void
  getPhaseProgress: (id: string) => { checked: number; total: number }
  isPhaseComplete: (id: string) => boolean
  totalChecked: number
  totalItems: number
}

function PhaseNavContent({
  normalPhases, emergencyPhases, activePhaseId, onSelectPhase,
  onEmergency, onReset, getPhaseProgress, isPhaseComplete,
  totalChecked, totalItems,
}: PhaseNavContentProps) {
  const overallPct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <div className="px-2 py-3 mb-1">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-cockpit-text-dim font-medium">Overall progress</span>
          <span className="font-mono font-semibold text-cockpit-text-secondary">{totalChecked}/{totalItems}</span>
        </div>
        <div className="h-1.5 bg-cockpit-card rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%`, background: overallPct === 100 ? '#22c55e' : '#f59e0b' }} />
        </div>
      </div>
      <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider px-2 pb-1.5">Normal Procedures</p>
      {normalPhases.map(phase => (
        <PhaseNav
          key={phase.id}
          phase={phase}
          isActive={phase.id === activePhaseId}
          isComplete={isPhaseComplete(phase.id)}
          progress={getPhaseProgress(phase.id)}
          onClick={() => onSelectPhase(phase.id)}
        />
      ))}
      {emergencyPhases.length > 0 && (
        <>
          <div className="my-2 border-t border-cockpit-border/40" />
          <button
            onClick={onEmergency}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold
                       text-red-400 border border-red-500/20 bg-red-500/5
                       hover:bg-red-500/10 hover:border-red-500/30 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Procedures
          </button>
        </>
      )}
      <div className="mt-3 pt-3 border-t border-cockpit-border/40">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                     text-cockpit-text-dim hover:text-cockpit-text-primary hover:bg-white/5 w-full transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Flight
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ title, body, confirmLabel, confirmClass, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; confirmClass: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <h3 className="font-bold text-cockpit-text-primary mb-2">{title}</h3>
        <p className="text-sm text-cockpit-text-secondary mb-5 leading-relaxed">{body}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetFlightModal({ aircraftName, onConfirm, onCancel }: {
  aircraftName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-cockpit-amber/10 border border-cockpit-amber/20">
            <RotateCcw className="w-5 h-5 text-cockpit-amber" />
          </div>
          <div>
            <h3 className="font-bold text-cockpit-text-primary">Start New Flight?</h3>
            <p className="text-xs text-cockpit-text-dim mt-0.5">{aircraftName}</p>
          </div>
        </div>
        <p className="text-sm text-cockpit-text-secondary mb-5 leading-relaxed">
          All checked items will be cleared and the checklist reset to Preflight.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-cockpit-amber/15 border border-cockpit-amber/40 text-cockpit-amber text-sm font-semibold hover:bg-cockpit-amber/25 transition-colors">Reset</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

  Expected: no TypeScript errors. (Bundle size warning is pre-existing — ignore.)

- [ ] **Step 3: Smoke test in browser**

```bash
npm run dev
```

  Open http://localhost:5173. Sign in. Open any aircraft checklist. Verify:
  - Profile picker appears below aircraft name in the header
  - Clicking the pencil (edit) icon on the original shows SaveAsDialog
  - Type a name, click "Save Profile" → enters edit mode with the full outline
  - In edit mode: drag handles visible on phases and items
  - Pencil icon on a phase/item opens inline text edit
  - Delete icon removes phase/item
  - "Add item" button at bottom of each phase adds a new row
  - "Add Phase" button at bottom adds a new phase
  - Save button saves and exits to checklist view
  - Discard button with unsaved changes shows confirmation

- [ ] **Step 4: Commit**

```bash
git add src/components/ChecklistView.tsx
git commit -m "feat: integrate profile picker, edit mode, and save/discard into ChecklistView"
```

---

## Task 9: Final Verification Against Success Criteria

- [ ] **User can Save As from original to create a named profile**
  Open any aircraft → tap pencil → type name → "Save Profile" → edit mode opens with that aircraft's checklist.

- [ ] **User can edit item text**
  In edit mode → tap pencil on any item → type new text → tap checkmark or press Enter → text updates immediately.

- [ ] **User can add and delete items**
  In edit mode → tap "Add item" at bottom of a phase → new row appears. Tap delete (trash) on an item → item removed.

- [ ] **User can reorder items via drag-and-drop**
  In edit mode → drag the grip handle on an item → item moves to new position.

- [ ] **User can rename, add, delete, and reorder phases**
  In edit mode → tap pencil on phase header → rename. Tap trash → delete. "Add Phase" → new phase with name and category. Drag phase grip handle → reorder.

- [ ] **Save persists to Supabase**
  Make changes → tap Save → exit edit mode → refresh browser → reopen aircraft → profile loads with saved changes.

- [ ] **Save As creates a named copy**
  In edit mode → tap "Save As" → enter name → new profile created and activated.

- [ ] **Profile picker shows all profiles and allows switching**
  Tap profile picker dropdown → shows "Original (POH)" + all named profiles → tap to switch.

- [ ] **Reset to original deletes profile and reverts to POH**
  Profile picker → "Reset to original…" → confirm → original checklist appears, profile deleted.

- [ ] **Original checklist is never modified**
  After all above: open the aircraft fresh in Supabase Table Editor — `checklist_profiles` holds the user's profiles; original TypeScript data is unchanged.

- [ ] **Unsaved changes prompt on back/discard/profile switch**
  Make edits in edit mode → tap back arrow (or profile switch) without saving → confirmation sheet appears.

- [ ] **Commit final state**

```bash
git add -A
git commit -m "feat: Phase 2 complete — per-user checklist customization"
```
