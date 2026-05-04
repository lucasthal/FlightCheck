# Offline Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable pilots to view and operate their checklists in flight without an internet connection, while gracefully blocking all write operations until connectivity is restored.
**Architecture:** Profile data fetched from Supabase is mirrored to localStorage after every successful fetch; on network failure the app falls back to the cached copy and raises an `isOffline` flag that drives UI state. Checklist check-state is re-keyed from `pilot-checklist-state` to per-profile keys so a pilot's in-progress session on profile A is isolated from profile B on the same aircraft.
**Tech Stack:** React, TypeScript, Supabase, Workbox/vite-plugin-pwa, Tailwind CSS

---

## Task 1: `offlineCache` utility

**Files**
- Create `src/lib/offlineCache.ts`

### Steps

- [ ] **1.1 — Create `src/lib/offlineCache.ts`**

  Write the following file in full:

  ```ts
  /**
   * Thin localStorage cache helpers for offline fallback data.
   * All keys should be namespaced (e.g. "flightcheck-profiles-{userId}").
   * These functions never throw — failures are silently swallowed.
   */

  export function setCache(key: string, data: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // QuotaExceededError or serialisation error — fail open
    }
  }

  export function getCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      const parsed = JSON.parse(raw) as T
      if (parsed === null || parsed === undefined) return null
      return parsed
    } catch {
      // Corrupt JSON — treat as cache miss
      return null
    }
  }

  export function clearCache(key: string): void {
    localStorage.removeItem(key)
  }
  ```

- [ ] **1.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expect zero errors.

- [ ] **1.3 — Commit**

  ```
  git add src/lib/offlineCache.ts
  git commit -m "feat: add offlineCache localStorage utility"
  ```

---

## Task 2: `useNetworkStatus` hook

**Files**
- Create `src/hooks/useNetworkStatus.ts`

### Steps

- [ ] **2.1 — Create `src/hooks/useNetworkStatus.ts`**

  ```ts
  import { useEffect, useState } from 'react'

  /**
   * Returns the current network reachability derived from the browser's
   * navigator.onLine flag, updated in real time via the window online/offline
   * events. No polling — purely event-driven.
   */
  export function useNetworkStatus(): { isOnline: boolean } {
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

    useEffect(() => {
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }, [])

    return { isOnline }
  }
  ```

- [ ] **2.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

- [ ] **2.3 — Commit**

  ```
  git add src/hooks/useNetworkStatus.ts
  git commit -m "feat: add useNetworkStatus hook"
  ```

---

## Task 3: `useProfiles` offline support

**Files**
- Modify `src/hooks/useProfiles.ts`

### Steps

- [ ] **3.1 — Add imports and `isOffline` state**

  At the top of `useProfiles.ts`, add the cache import on the line after the existing imports:

  ```ts
  import { setCache, getCache } from '../lib/offlineCache'
  ```

  Inside `useProfiles`, directly after the existing `useState` declarations (after line `const [fetchError, setFetchError] = useState<Error | null>(null)`), add:

  ```ts
  const [isOffline, setIsOffline] = useState(false)
  ```

- [ ] **3.2 — Update `fetchProfiles` to write cache on success and fall back on failure**

  Replace the entire `fetchProfiles` callback (lines 61–82 in the original) with:

  ```ts
  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    if (!user) { setProfiles([]); return [] }
    setLoading(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('checklist_profiles')
        .select(PROFILE_SELECT)
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
        .order('created_at')
      if (error) throw error
      const mapped = ((data ?? []) as RawProfile[]).map(mapProfile)
      setProfiles(mapped)
      setIsOffline(false)
      setCache(`flightcheck-profiles-${user.id}-${aircraftId}`, mapped)
      return mapped
    } catch (err) {
      const cached = getCache<Profile[]>(`flightcheck-profiles-${user.id}-${aircraftId}`)
      if (cached) {
        setProfiles(cached)
        setIsOffline(true)
        setLoading(false)
        return cached
      }
      const error = err instanceof Error ? err : new Error(String(err))
      setFetchError(new Error('No connection and no cached data available'))
      setLoading(false)
      throw error
    } finally {
      setLoading(false)
    }
  }, [user, aircraftId])
  ```

  Note: the `finally` block still runs after a cache-hit early return and simply calls `setLoading(false)` a second time, which is harmless.

- [ ] **3.3 — Add offline guard to `createFromAircraft`**

  At the very top of the `createFromAircraft` callback body, after the `if (!user)` guard, add:

  ```ts
  if (!navigator.onLine) throw new Error('No connection — creating profiles requires internet')
  ```

  After the final `setProfiles(updated)` / `return updated` lines, before the closing `}` of the try or directly before `return updated`, update the cache:

  ```ts
  setCache(`flightcheck-profiles-${user.id}-${aircraftId}`, updated)
  return updated
  ```

  The full tail of `createFromAircraft` (replace from `const updated = ...` to end of callback) becomes:

  ```ts
    const updated = [...profiles.map(p => ({ ...p, is_active: false })), newProfile]
    setProfiles(updated)
    setCache(`flightcheck-profiles-${user.id}-${aircraftId}`, updated)
    return updated
  }, [user, aircraftId, profiles])
  ```

- [ ] **3.4 — Add offline guard to `createFromProfile`**

  At the top of `createFromProfile`, after `if (!user) throw new Error('Not authenticated')`, add:

  ```ts
  if (!navigator.onLine) throw new Error('No connection — creating profiles requires internet')
  ```

  At the tail of `createFromProfile` (replace from `const updated = ...` to end of callback):

  ```ts
    const updated = [...profiles.map(p => ({ ...p, is_active: false })), newProfile]
    setProfiles(updated)
    setCache(`flightcheck-profiles-${user.id}-${aircraftId}`, updated)
    return updated
  }, [user, aircraftId, profiles])
  ```

- [ ] **3.5 — Add offline guard to `deleteProfile`**

  Replace the entire `deleteProfile` callback with:

  ```ts
  const deleteProfile = useCallback(async (profileId: string): Promise<void> => {
    if (!navigator.onLine) throw new Error('No connection — deleting profiles requires internet')
    const { error } = await supabase.from('checklist_profiles').delete().eq('id', profileId)
    if (error) throw error
    await fetchProfiles()
  }, [fetchProfiles])
  ```

- [ ] **3.6 — Add offline guard to `renameProfile`**

  Replace the entire `renameProfile` callback with:

  ```ts
  const renameProfile = useCallback(async (profileId: string, name: string): Promise<void> => {
    if (!navigator.onLine) throw new Error('No connection — renaming profiles requires internet')
    const { error } = await supabase.from('checklist_profiles').update({ name }).eq('id', profileId)
    if (error) throw error
    await fetchProfiles()
  }, [fetchProfiles])
  ```

- [ ] **3.7 — Add offline guard to `setActive`**

  Replace the entire `setActive` callback with:

  ```ts
  const setActive = useCallback(async (profileId: string | null): Promise<void> => {
    if (!user) return
    if (!navigator.onLine) throw new Error('No connection — switching profiles requires internet')
    if (profileId === null) {
      await supabase
        .from('checklist_profiles')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
    } else {
      const { error: rpcError } = await supabase.rpc('activate_profile', { p_profile_id: profileId })
      if (rpcError) throw rpcError
    }
    await fetchProfiles()
  }, [user, aircraftId, fetchProfiles])
  ```

- [ ] **3.8 — Add `isOffline` to return value**

  Replace the return statement at the bottom of `useProfiles`:

  ```ts
  return { profiles, activeProfile, loading, fetchError, isOffline, fetchProfiles, createFromAircraft, createFromProfile, deleteProfile, renameProfile, setActive }
  ```

- [ ] **3.9 — Type-check**

  ```
  npx tsc --noEmit
  ```

- [ ] **3.10 — Commit**

  ```
  git add src/hooks/useProfiles.ts
  git commit -m "feat: add offline cache fallback and write guards to useProfiles"
  ```

---

## Task 4: Checklist state re-keying

**Files**
- Modify `src/hooks/useChecklist.ts`
- Modify `src/components/ChecklistView.tsx` (signature call site — covered in Task 6)

### Steps

- [ ] **4.1 — Understand current shape**

  The current `useChecklist.ts` uses:
  - `const STORAGE_KEY = 'pilot-checklist-state'`
  - One flat record `Record<string, ChecklistState>` keyed by `aircraftId`
  - `saveState` writes the whole record under that single key

  The new approach uses a per-profile key so each profile session is isolated.

- [ ] **4.2 — Rewrite `useChecklist.ts`**

  Replace the entire file content with:

  ```ts
  import { useState, useCallback, useEffect } from 'react'
  import type { Aircraft, ChecklistState } from '../types'

  function storageKey(profileId: string | null, aircraftId: string): string {
    if (profileId) return `flightcheck-checklist-state-${profileId}`
    return `flightcheck-checklist-state-original-${aircraftId}`
  }

  function loadState(key: string): Record<string, ChecklistState> {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as Record<string, ChecklistState>) : {}
    } catch {
      return {}
    }
  }

  function saveState(key: string, state: Record<string, ChecklistState>): void {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Migrate a single entry from the legacy flat 'pilot-checklist-state' key
   * into the new per-profile key format. Runs once per mount when the new key
   * is absent. Does NOT remove the old key (kept as dead data for safety).
   */
  function migrateIfNeeded(newKey: string, aircraftId: string, profileId: string | null): void {
    const OLD_KEY = 'pilot-checklist-state'
    const oldRaw = localStorage.getItem(OLD_KEY)
    if (!oldRaw) return
    if (localStorage.getItem(newKey)) return
    try {
      const old = JSON.parse(oldRaw) as Record<string, ChecklistState>
      const match = old[aircraftId]
      if (match) {
        const stateKey = profileId ?? aircraftId
        localStorage.setItem(newKey, JSON.stringify({ [stateKey]: match }))
      }
    } catch {
      // ignore — migration is best-effort
    }
  }

  export function useChecklist(aircraft: Aircraft | null, profileId: string | null) {
    const key = aircraft ? storageKey(profileId, aircraft.id) : ''
    const stateKey = profileId ?? aircraft?.id ?? ''

    const [allStates, setAllStates] = useState<Record<string, ChecklistState>>(() => {
      if (!aircraft) return {}
      const newKey = storageKey(profileId, aircraft.id)
      migrateIfNeeded(newKey, aircraft.id, profileId)
      return loadState(newKey)
    })
    const [activePhaseId, setActivePhaseId] = useState<string>('')

    const state: ChecklistState | null = aircraft
      ? allStates[stateKey] ?? null
      : null

    // Initialize or reset a flight session
    const initFlight = useCallback((aircraftId: string, firstPhaseId: string) => {
      const newState: ChecklistState = {
        aircraftId,
        phaseId: firstPhaseId,
        checkedItems: {},
        startedAt: new Date().toISOString(),
        completedPhases: [],
      }
      setAllStates(prev => {
        const next = { ...prev, [stateKey]: newState }
        saveState(key, next)
        return next
      })
      setActivePhaseId(firstPhaseId)
    }, [key, stateKey])

    const resetFlight = useCallback((aircraftId: string, firstPhaseId: string) => {
      initFlight(aircraftId, firstPhaseId)
    }, [initFlight])

    // Set active phase
    const selectPhase = useCallback((phaseId: string) => {
      setActivePhaseId(phaseId)
      if (aircraft) {
        setAllStates(prev => {
          const cur = prev[stateKey]
          if (!cur) return prev
          const next = { ...prev, [stateKey]: { ...cur, phaseId } }
          saveState(key, next)
          return next
        })
      }
    }, [aircraft, key, stateKey])

    // Toggle a single checklist item
    const toggleItem = useCallback((itemId: string) => {
      if (!aircraft) return
      setAllStates(prev => {
        const cur = prev[stateKey]
        if (!cur) return prev
        const checked = !cur.checkedItems[itemId]
        const newChecked = { ...cur.checkedItems, [itemId]: checked }
        const next = { ...prev, [stateKey]: { ...cur, checkedItems: newChecked } }
        saveState(key, next)
        return next
      })
    }, [aircraft, key, stateKey])

    // Mark a phase complete
    const completePhase = useCallback((phaseId: string) => {
      if (!aircraft) return
      setAllStates(prev => {
        const cur = prev[stateKey]
        if (!cur) return prev
        const completedPhases = cur.completedPhases.includes(phaseId)
          ? cur.completedPhases
          : [...cur.completedPhases, phaseId]
        const next = { ...prev, [stateKey]: { ...cur, completedPhases } }
        saveState(key, next)
        return next
      })
    }, [aircraft, key, stateKey])

    // Compute per-phase item counts
    const getPhaseProgress = useCallback((phaseId: string): { checked: number; total: number } => {
      if (!aircraft || !state) return { checked: 0, total: 0 }
      const phase = aircraft.phases.find(p => p.id === phaseId)
      if (!phase) return { checked: 0, total: 0 }
      const total = phase.items.length
      const checked = phase.items.filter(i => state.checkedItems[i.id]).length
      return { checked, total }
    }, [aircraft, state])

    const isItemChecked = useCallback((itemId: string): boolean => {
      return state?.checkedItems[itemId] ?? false
    }, [state])

    const isPhaseComplete = useCallback((phaseId: string): boolean => {
      return state?.completedPhases.includes(phaseId) ?? false
    }, [state])

    // Re-initialise state when aircraft or profileId changes (different key)
    useEffect(() => {
      if (!aircraft) return
      const newKey = storageKey(profileId, aircraft.id)
      migrateIfNeeded(newKey, aircraft.id, profileId)
      const loaded = loadState(newKey)
      setAllStates(loaded)
      const existing = loaded[stateKey]
      if (existing) {
        setActivePhaseId(existing.phaseId)
      } else {
        const firstPhase = aircraft.phases.find(p => p.category !== 'emergency')
        if (firstPhase) initFlight(aircraft.id, firstPhase.id)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aircraft?.id, profileId])

    return {
      state,
      activePhaseId,
      selectPhase,
      toggleItem,
      completePhase,
      resetFlight,
      initFlight,
      getPhaseProgress,
      isItemChecked,
      isPhaseComplete,
    }
  }
  ```

- [ ] **4.3 — Type-check**

  ```
  npx tsc --noEmit
  ```

  At this point there will be a type error in `ChecklistView.tsx` because `useChecklist` now expects a second argument. That is expected — it is fixed in Task 6. The only errors from this step should be the missing second argument at the call site. No new errors should appear inside `useChecklist.ts` itself.

- [ ] **4.4 — Commit**

  ```
  git add src/hooks/useChecklist.ts
  git commit -m "feat: re-key checklist state to per-profile localStorage keys with migration"
  ```

---

## Task 5: `OfflineBanner` component

**Files**
- Create `src/components/OfflineBanner.tsx`

### Steps

- [ ] **5.1 — Create `src/components/OfflineBanner.tsx`**

  ```tsx
  interface Props {
    visible: boolean
  }

  /**
   * Thin non-dismissable status bar shown when the app is operating
   * from cached data or has no network connection.
   */
  export function OfflineBanner({ visible }: Props) {
    return (
      <div
        aria-live="polite"
        className={[
          'w-full overflow-hidden transition-all duration-100',
          visible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
      >
        <div className="py-1.5 px-4 bg-amber-500/15 border-b border-amber-500/30">
          <p className="text-sm text-center font-medium text-cockpit-amber">
            Flying offline — showing last synced data
          </p>
        </div>
      </div>
    )
  }
  ```

- [ ] **5.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

- [ ] **5.3 — Commit**

  ```
  git add src/components/OfflineBanner.tsx
  git commit -m "feat: add OfflineBanner component"
  ```

---

## Task 6: App integration

**Files**
- Modify `src/components/ChecklistView.tsx`
- Modify `src/components/AircraftSelector.tsx`
- Modify `src/components/ChecklistEditorView.tsx`

### Steps

#### 6a — ChecklistView

- [ ] **6a.1 — Add imports to `ChecklistView.tsx`**

  Add to the import block at the top of the file (after the existing local component imports):

  ```ts
  import { useNetworkStatus } from '../hooks/useNetworkStatus'
  import { OfflineBanner } from './OfflineBanner'
  ```

- [ ] **6a.2 — Destructure `isOffline` from `useProfiles` and call `useNetworkStatus`**

  The existing line:

  ```ts
  const profiles = useProfiles(aircraft.id)
  ```

  Is not destructured yet. Change it to a two-liner:

  ```ts
  const profiles = useProfiles(aircraft.id)
  const { isOnline } = useNetworkStatus()
  ```

  Then, anywhere in the component where `profiles.isOffline` is needed, reference it as `profiles.isOffline`.

- [ ] **6a.3 — Pass `profileId` second argument to `useChecklist`**

  Find the existing call:

  ```ts
  } = useChecklist(activeAircraft)
  ```

  Replace with:

  ```ts
  } = useChecklist(activeAircraft, profiles.activeProfile?.id ?? null)
  ```

- [ ] **6a.4 — Add `OfflineBanner` at top of returned JSX**

  In `ChecklistView`, find the outermost `return (` and its opening wrapper element. The banner must appear as the very first child inside that wrapper — above `<PhaseNav>` and all other content. Find the line that opens the outermost JSX container (likely `<div className="min-h-screen ...">` or similar) and add the banner as the first child:

  ```tsx
  <OfflineBanner visible={!isOnline || profiles.isOffline} />
  ```

- [ ] **6a.5 — Pass `isOnline` to `ChecklistEditorView`**

  Find the `<ChecklistEditorView` usage in `ChecklistView.tsx` and add the `isOnline` prop:

  ```tsx
  <ChecklistEditorView
    editor={editor}
    profileName={profiles.activeProfile?.name ?? ''}
    onSave={handleSave}
    onSaveAs={() => setShowSaveAs(true)}
    onDiscard={handleDiscard}
    saving={saving}
    isOnline={isOnline}
  />
  ```

#### 6b — AircraftSelector

- [ ] **6b.1 — Add imports to `AircraftSelector.tsx`**

  Add after the existing imports:

  ```ts
  import { useNetworkStatus } from '../hooks/useNetworkStatus'
  import { OfflineBanner } from './OfflineBanner'
  ```

- [ ] **6b.2 — Call `useNetworkStatus` inside the component**

  Inside `AircraftSelector` (the exported component function), add at the top of the function body, after any existing hooks:

  ```ts
  const { isOnline } = useNetworkStatus()
  ```

- [ ] **6b.3 — Render `OfflineBanner` at top of AircraftSelector JSX**

  Find the outermost return element in `AircraftSelector` and add the banner as the very first child:

  ```tsx
  <OfflineBanner visible={!isOnline} />
  ```

#### 6c — ChecklistEditorView

- [ ] **6c.1 — Add `isOnline` to the `Props` interface**

  Find the `interface Props` block in `ChecklistEditorView.tsx`:

  ```ts
  interface Props {
    editor: Editor
    profileName: string
    onSave: () => void
    onSaveAs: () => void
    onDiscard: () => void
    saving: boolean
  }
  ```

  Replace with:

  ```ts
  interface Props {
    editor: Editor
    profileName: string
    onSave: () => void
    onSaveAs: () => void
    onDiscard: () => void
    saving: boolean
    isOnline: boolean
  }
  ```

- [ ] **6c.2 — Destructure `isOnline` in the component signature**

  Find:

  ```ts
  export function ChecklistEditorView({ editor, profileName, onSave, onSaveAs, onDiscard, saving }: Props) {
  ```

  Replace with:

  ```ts
  export function ChecklistEditorView({ editor, profileName, onSave, onSaveAs, onDiscard, saving, isOnline }: Props) {
  ```

- [ ] **6c.3 — Add offline note to the toolbar and disable Save/Save As buttons**

  In the toolbar `<div>` that currently has `Discard`, `Save As`, and `Save` buttons (the `flex items-center gap-2` div), replace the buttons with offline-aware versions.

  The existing `Save As` button:

  ```tsx
  <button
    onClick={onSaveAs}
    disabled={saving}
    className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
               hover:bg-white/5 disabled:opacity-40 transition-colors"
  >
    Save As
  </button>
  ```

  Replace with:

  ```tsx
  <button
    onClick={onSaveAs}
    disabled={saving || !isOnline}
    title={!isOnline ? 'No connection — editing requires internet' : undefined}
    className="px-3 py-1.5 rounded-lg border border-cockpit-border text-xs text-cockpit-text-secondary
               hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  >
    Save As
  </button>
  ```

  The existing `Save` button:

  ```tsx
  <button
    onClick={onSave}
    disabled={saving}
    className="px-3 py-1.5 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
               text-cockpit-amber text-xs font-semibold hover:bg-cockpit-amber/25
               disabled:opacity-40 transition-colors"
  ```

  Replace with:

  ```tsx
  <button
    onClick={onSave}
    disabled={saving || !isOnline}
    title={!isOnline ? 'No connection — editing requires internet' : undefined}
    className="px-3 py-1.5 rounded-lg bg-cockpit-amber/15 border border-cockpit-amber/40
               text-cockpit-amber text-xs font-semibold hover:bg-cockpit-amber/25
               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
  ```

- [ ] **6c.4 — Add "No connection" note to the toolbar when offline**

  In the toolbar `<div>` that shows `"Edit Mode"` and the profile name (the left side), add a conditional note below the profile name:

  ```tsx
  <div>
    <p className="text-xs font-semibold text-cockpit-amber">Edit Mode</p>
    <p className="text-xs text-cockpit-text-dim truncate max-w-[160px]">{profileName}</p>
    {!isOnline && (
      <p className="text-xs text-amber-400/70 mt-0.5">No connection — changes cannot be saved</p>
    )}
  </div>
  ```

- [ ] **6c.5 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expect zero errors.

- [ ] **6c.6 — Commit**

  ```
  git add src/components/ChecklistView.tsx src/components/AircraftSelector.tsx src/components/ChecklistEditorView.tsx
  git commit -m "feat: wire offline banner and disable editor controls when offline"
  ```

---

## Verification checklist

After all tasks complete, confirm the following manually in the browser:

- [ ] Open app online — no banner visible, all edit controls enabled
- [ ] Toggle DevTools > Network > Offline — banner appears immediately in both `AircraftSelector` and `ChecklistView`
- [ ] Reload while offline — if profiles were cached, checklist loads and banner shows "Flying offline — showing last synced data"
- [ ] Reload while offline with no prior cache — `fetchError` message visible, no crash
- [ ] While offline, attempt to create/rename/delete a profile — descriptive error appears, no silent failure
- [ ] Save and Save As buttons in editor are disabled with tooltip when offline
- [ ] Return to online — banner disappears after next successful `fetchProfiles` call
- [ ] Check that checklist check-state survives page reload under new keys
- [ ] Confirm old `pilot-checklist-state` key is preserved but new per-profile keys are created correctly
