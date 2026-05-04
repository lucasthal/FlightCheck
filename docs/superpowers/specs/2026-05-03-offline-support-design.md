# Offline Support — Design Spec

**Date:** 2026-05-03
**Scope:** Full offline read/check functionality for in-flight use, with clear error states for write operations requiring network

---

## Overview

Pilots need reliable access to their checklists in the air, regardless of network state. This spec covers the strategy for caching profile data locally, preserving per-profile check state across app restarts, surfacing a visible offline banner, and blocking write operations gracefully when there is no connection.

The app already caches static assets and Google Fonts via Workbox. This feature extends that to cover dynamic Supabase data using localStorage — not service-worker-level API caching, which is unreliable with Supabase auth headers.

---

## What Works Offline

| Feature | Behaviour |
|---|---|
| Viewing checklist profiles (phases + items) | Served from localStorage cache |
| Checking and unchecking items | Persisted locally, survives restart |
| Viewing reference tab (V-speeds, limits) | Already bundled in static assets |
| User preferences and theme | Read from localStorage |

## What Does NOT Work Offline

| Feature | Behaviour |
|---|---|
| Creating a new profile | Blocked with "No connection" error |
| Editing or saving a profile | Blocked with "No connection" error |
| Deleting a profile | Blocked with "No connection" error |
| Switching to an aircraft/profile not yet cached | Blocked with "No connection" error |
| Signing in for the first time | Auth flow fails; sign-in screen remains |

All of the above fail with a clear descriptive error message rather than a silent failure or spinner that never resolves.

---

## Architecture

### Why localStorage, not Service Worker API caching

Supabase requests use per-user auth headers and JWT tokens. Caching them at the service worker level requires intercepting authenticated requests, cloning responses, and keying cache entries correctly — all of which is complex, error-prone, and difficult to invalidate. localStorage is already the source of truth for checklist state. Extending it to profiles keeps the offline strategy in one layer.

### Data flow (online)

1. App loads → `useProfiles` calls `fetchProfiles()` → Supabase returns profiles
2. On success → `setCache('flightcheck-profiles-{userId}', profiles)` writes to localStorage
3. Active profile and phases render normally

### Data flow (offline)

1. App loads → `useProfiles` calls `fetchProfiles()` → Supabase call throws (network error)
2. `useProfiles` catches the error → calls `getCache('flightcheck-profiles-{userId}')`
3. If cache hit → `setProfiles(cachedProfiles)`, sets `isOffline = true`, suppresses `fetchError`
4. If cache miss → sets `fetchError` with message "No connection and no cached data available"
5. `OfflineBanner` renders because `isOffline === true` or `isOnline === false`
6. Checklist view renders normally from cached profile data

---

## New Files

### `src/lib/offlineCache.ts`

Thin localStorage wrapper. All keys are namespaced under `flightcheck-` to avoid collisions.

```ts
export function setCache(key: string, data: unknown): void
export function getCache<T>(key: string): T | null
export function clearCache(key: string): void
```

**`setCache`** — `JSON.stringify(data)` and `localStorage.setItem(key, ...)`. Catches `QuotaExceededError` silently (fails open).

**`getCache<T>`** — `localStorage.getItem(key)`, then `JSON.parse`. Returns `null` if the key is absent, if `JSON.parse` throws, or if the result is `null` / `undefined`. Never throws.

**`clearCache`** — `localStorage.removeItem(key)`.

**Cache key for profiles:** `flightcheck-profiles-{userId}` where `userId` is `user.id` from Supabase auth.

---

### `src/hooks/useNetworkStatus.ts`

```ts
export function useNetworkStatus(): { isOnline: boolean }
```

- Initialises `isOnline` from `navigator.onLine` (available in all target browsers)
- Adds `window.addEventListener('online', ...)` and `window.addEventListener('offline', ...)` on mount; removes them on unmount
- Updates `isOnline` state when either event fires
- No polling — event-driven only

---

### `src/components/OfflineBanner.tsx`

A thin, non-dismissable status bar shown at the top of the app when the user is offline or operating from cached data.

**Props:**
```ts
interface Props {
  visible: boolean
}
```

**Content:** `Flying offline — showing last synced data`

**Styling:**
- Full-width bar, `py-1.5 px-4 text-sm text-center font-medium`
- Background: `bg-amber-500/15 border-b border-amber-500/30`
- Text colour: `text-cockpit-amber` (uses existing `cockpit-amber` CSS variable family)
- No close button
- Animates in/out with a CSS height/opacity transition (100ms) to avoid layout jump
- Rendered above the main content area, below the app's top bar if one exists

**Visibility logic:**
- `visible` is `true` when `isOnline === false` (from `useNetworkStatus`) OR `isOffline === true` (from `useProfiles`)
- When connectivity is restored and `fetchProfiles()` succeeds, `isOffline` resets to `false` and the banner disappears

---

## Modified Files

### `src/hooks/useProfiles.ts`

**Return type change** — add `isOffline: boolean` to the return object.

**`fetchProfiles` change:**

```ts
// After successful fetch — write to cache
const mapped = ((data ?? []) as RawProfile[]).map(mapProfile)
setProfiles(mapped)
setIsOffline(false)
setCache(`flightcheck-profiles-${user.id}`, mapped)
return mapped

// In the catch block — attempt cache fallback
} catch (err) {
  const cached = getCache<Profile[]>(`flightcheck-profiles-${user.id}`)
  if (cached) {
    setProfiles(cached)
    setIsOffline(true)
    return cached
  }
  setFetchError(err instanceof Error ? err : new Error(String(err)))
  throw err
}
```

**Write operations — offline guard:**

Add an `isOnline` check at the top of every mutating callback (`createFromAircraft`, `createFromProfile`, `deleteProfile`, `renameProfile`, `setActive`). Use `navigator.onLine` directly inside the callback (not the React state, which may be one render stale):

```ts
if (!navigator.onLine) throw new Error('No connection — saving profiles requires internet')
```

This throw surfaces through the existing error-display path in `ChecklistView` without requiring new error UI.

**After a write operation succeeds** — re-call `setCache(...)` with the updated profiles so the cache stays fresh after mutations.

**Internal state:**
```ts
const [isOffline, setIsOffline] = useState(false)
```

Return `isOffline` alongside the existing return values.

---

### `src/hooks/useChecklist.ts`

**Storage key change** — the existing key `pilot-checklist-state` keys state by `aircraftId`. This spec changes the key to be per-profile so a pilot mid-flight on profile A doesn't share state with profile B on the same aircraft.

**New key format:** `flightcheck-checklist-state-{profileId}`

`profileId` is passed into `useChecklist` as a new second parameter (optional, `string | null`). When `null` (original POH, no active profile), fall back to `flightcheck-checklist-state-original-{aircraftId}` so original-checklist state is also stable.

**Migration on first load:**

In `loadState`, after reading the new key:

```ts
// Migration: if old key exists and new key is absent, copy old state over
const OLD_KEY = 'pilot-checklist-state'
const oldRaw = localStorage.getItem(OLD_KEY)
if (oldRaw && !localStorage.getItem(newKey)) {
  try {
    const old = JSON.parse(oldRaw) as Record<string, ChecklistState>
    // Old format: keyed by aircraftId. Store the matching entry under the new key.
    const match = old[aircraftId]
    if (match) localStorage.setItem(newKey, JSON.stringify({ [profileId ?? aircraftId]: match }))
  } catch { /* ignore */ }
}
```

The old `pilot-checklist-state` key is not removed during migration — it stays as dead data until a future cleanup pass.

**`useChecklist` signature change:**

```ts
export function useChecklist(aircraft: Aircraft | null, profileId: string | null)
```

Callers (`ChecklistView`) already pass `aircraft`. They will also pass `activeProfile?.id ?? null`.

---

### `src/components/ChecklistView.tsx`

1. Import and call `useNetworkStatus()`: `const { isOnline } = useNetworkStatus()`
2. Receive `isOffline` from `useProfiles` (already called inside `ChecklistView`)
3. Render `<OfflineBanner visible={!isOnline || isOffline} />` at the top of the returned JSX, above `<PhaseNav>` and the main checklist content area
4. Pass `activeProfile?.id ?? null` as second argument to `useChecklist`

---

### `src/components/AircraftSelector.tsx`

1. Import and call `useNetworkStatus()`
2. Render `<OfflineBanner visible={!isOnline} />` at the top of the selector (above the fleet strip and aircraft grid)

This covers the case where the user opens the app offline before selecting an aircraft — they see the banner immediately on the home screen.

---

### `src/components/ChecklistEditorView.tsx`

**Disable editing controls when offline.**

1. Accept `isOnline: boolean` as a prop (passed down from `ChecklistView`)
2. When `!isOnline`:
   - Save, Save As, and all item/phase edit buttons are visually disabled (`opacity-50 cursor-not-allowed`)
   - Each disabled button has `title="No connection — editing requires internet"` (native browser tooltip, no extra component needed)
   - The toolbar shows a text note: `"No connection — changes cannot be saved"`
3. Do not prevent the user from entering edit mode (read-only inspection is harmless), but block any action that would call a `useProfiles` mutator

---

### `src/App.tsx` (or `AppInner`)

If `useNetworkStatus` is not already called here, call it and pass `isOnline` down where needed. `ChecklistView` already receives `aircraft` and `onBack` — add `isOnline` to its props interface if required by the editor passthrough. Alternatively, `ChecklistView` can call `useNetworkStatus` independently (the hook is cheap).

---

## Component Hierarchy for Offline State

```
AppInner
├── AircraftSelector
│   └── OfflineBanner (visible when !isOnline)
└── ChecklistView
    ├── OfflineBanner (visible when !isOnline || isOffline)
    └── ChecklistEditorView (receives isOnline prop)
```

---

## Checked State Storage — Key Reference

| Scenario | localStorage key |
|---|---|
| Active custom profile | `flightcheck-checklist-state-{profileId}` |
| Original POH (no active profile) | `flightcheck-checklist-state-original-{aircraftId}` |
| Old key (pre-migration, kept intact) | `pilot-checklist-state` |

---

## Error Message Reference

| Trigger | Message |
|---|---|
| `createFromAircraft` / `createFromProfile` while offline | `"No connection — creating profiles requires internet"` |
| `deleteProfile` while offline | `"No connection — deleting profiles requires internet"` |
| `renameProfile` while offline | `"No connection — renaming profiles requires internet"` |
| `setActive` while offline | `"No connection — switching profiles requires internet"` |
| `fetchProfiles` fails with no cache | `"No connection and no cached data available"` (set as `fetchError`) |

These messages are thrown as `Error` instances and caught by the existing error-display paths in `ChecklistView` — no new error UI is needed.

---

## What Is NOT Built

- **Background sync** — offline edits are not queued for replay when connectivity returns. The app is read-only while offline.
- **Offline profile creation or editing** — out of scope. Write operations fail cleanly.
- **Service-worker-level Supabase API caching** — explicitly excluded due to auth header complexity.
- **Push notifications for sync completion** — not applicable (no background sync).
- **Conflict resolution** — not needed because no offline writes occur.
- **Cache expiry / staleness indicators** — the banner always says "last synced data"; no timestamp shown.

---

## Implementation Order

1. `src/lib/offlineCache.ts` — no dependencies, implement first
2. `src/hooks/useNetworkStatus.ts` — no dependencies
3. `src/hooks/useProfiles.ts` — add cache read/write and `isOffline`, depends on `offlineCache`
4. `src/hooks/useChecklist.ts` — change storage key and add `profileId` param
5. `src/components/OfflineBanner.tsx` — depends on nothing
6. `src/components/ChecklistView.tsx` — wire `useNetworkStatus`, `OfflineBanner`, updated `useChecklist`
7. `src/components/AircraftSelector.tsx` — add `OfflineBanner`
8. `src/components/ChecklistEditorView.tsx` — add `isOnline` prop and disabled states
