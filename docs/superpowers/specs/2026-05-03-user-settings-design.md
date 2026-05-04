# User Settings and Preferences — Design Spec

**Date:** 2026-05-03
**Scope:** Per-user preference storage synced via Supabase, settings panel accessible from all screens, Wake Lock support, text scaling for cockpit readability

---

## Overview

FlightCheck gains a settings panel reachable from any screen. Preferences (theme, text size, wake lock, default aircraft) are stored in a new `user_preferences` table in Supabase so they follow the user across devices. The app falls back to localStorage when offline. This feature replaces the existing `useTheme.ts` hook and the floating theme-cycle button.

---

## What Is Not Built

- Per-phase font size overrides
- Notification preferences
- Language/locale settings
- Sound/haptic feedback toggles

---

## Database

### New Table: `user_preferences`

```sql
CREATE TABLE user_preferences (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  theme               text        NOT NULL DEFAULT 'dark'
                                  CHECK (theme IN ('dark', 'night', 'day')),
  text_size           text        NOT NULL DEFAULT 'md'
                                  CHECK (text_size IN ('sm', 'md', 'lg', 'xl')),
  keep_screen_awake   boolean     NOT NULL DEFAULT false,
  default_aircraft_id text,       -- nullable; matches Aircraft.id from static data
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- updated_at trigger (reuse the pattern from other tables)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

**Row-Level Security:** Enable RLS. One policy: users can SELECT, INSERT, UPDATE their own row only (`auth.uid() = user_id`).

---

## TypeScript Types

Add to `src/types/index.ts`:

```ts
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

Remove the local `type Theme` declarations in `App.tsx` and `useTheme.ts` once this is in place.

---

## Hook: `usePreferences`

**File:** `src/hooks/usePreferences.ts`

### Responsibilities

- Loads from Supabase on auth; creates a default row (via upsert) if none exists
- Holds the full `UserPreferences` object in React state
- Exposes `{ preferences, updatePreference, loading }`
- Applies side effects (theme classes, `--text-scale` variable) whenever the relevant preference changes
- Writes to and reads from localStorage as an offline fallback

### Signature

```ts
interface UsePreferencesResult {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  loading: boolean
}

export function usePreferences(user: User | null): UsePreferencesResult
```

### Load sequence

1. On mount, initialize state from `DEFAULT_PREFERENCES`.
2. If `user` is null (unauthenticated), attempt to read `flightcheck-preferences` from localStorage; apply it to state; set `loading = false`. Skip Supabase.
3. If `user` is non-null:
   a. Set `loading = true`.
   b. Call `supabase.from('user_preferences').select('*').eq('user_id', user.id).single()`.
   c. **On success:** merge into state, write to localStorage key `flightcheck-preferences` as backup, set `loading = false`.
   d. **On error (row not found — PGRST116):** upsert defaults (see below), write to localStorage, set `loading = false`.
   e. **On other network error:** read `flightcheck-preferences` from localStorage; if present, apply it; set `loading = false`. Do not throw — the app must remain usable offline.

### Default row upsert

When no row exists for the user, check localStorage for `pilot-theme` (the legacy key from `useTheme.ts`) and use it as the initial theme if present. This is the one-time migration path (see Migration section).

```ts
const legacyTheme = localStorage.getItem('pilot-theme') as Theme | null
const defaults: UserPreferences = {
  ...DEFAULT_PREFERENCES,
  theme: legacyTheme ?? DEFAULT_PREFERENCES.theme,
}

await supabase.from('user_preferences').upsert({
  user_id: user.id,
  ...defaults,
}, { onConflict: 'user_id' })
```

After upserting, delete `pilot-theme` from localStorage.

### `updatePreference`

```ts
function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
  // 1. Optimistic update — instant UI response
  setPreferences(prev => {
    const next = { ...prev, [key]: value }
    localStorage.setItem('flightcheck-preferences', JSON.stringify(next))
    return next
  })

  // 2. Async sync to Supabase — fire and forget; no error shown to user for single-key updates
  if (user) {
    supabase.from('user_preferences')
      .update({ [key]: value, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
  }
}
```

### Side effects

Apply inside `useEffect` hooks watching the relevant preference:

| Preference   | Side effect |
|---|---|
| `theme`      | Set `document.documentElement.className` (see Theme Application below) |
| `text_size`  | Set `--text-scale` CSS variable on `document.body` (see Text Size below) |

---

## Theme Application

Replaces the logic currently in `useTheme.ts`. The class manipulation is identical:

```ts
useEffect(() => {
  const root = document.documentElement
  root.classList.remove('dark', 'theme-night', 'theme-day')
  if (preferences.theme === 'dark' || preferences.theme === 'night') {
    root.classList.add('dark')
  }
  if (preferences.theme === 'night') root.classList.add('theme-night')
  if (preferences.theme === 'day')   root.classList.add('theme-day')
}, [preferences.theme])
```

`useTheme.ts` is deleted after this hook is integrated.

---

## Text Size

### CSS variable

```ts
const TEXT_SCALE: Record<TextSize, number> = {
  sm: 0.875,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
}

useEffect(() => {
  document.body.style.setProperty('--text-scale', String(TEXT_SCALE[preferences.text_size]))
}, [preferences.text_size])
```

Declare the CSS variable default in `src/index.css` within `:root`:

```css
:root {
  --text-scale: 1;
}
```

### Where `--text-scale` is applied

Only checklist content elements scale with this variable — not UI chrome (nav, buttons, headers). Apply `style={{ fontSize: 'calc(1rem * var(--text-scale))' }}` to the following elements in `ChecklistItems.tsx`:

| Element | Current class/style |
|---|---|
| Item action text (`item.action`) | `text-sm font-medium` |
| Item response text (`item.response`) | `text-sm font-mono font-semibold` |

Phase headers are rendered in `PhaseBanner.tsx`. The phase title text there also receives the scale — target the heading element that displays `phase.name`.

No other elements are modified. Checkbox size, item number, severity labels, note text, and all navigation/header chrome stay at their fixed sizes.

---

## Hook: `useWakeLock`

**File:** `src/hooks/useWakeLock.ts` (new file)

Manages the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

```ts
interface UseWakeLockOptions {
  enabled: boolean
}

export function useWakeLock({ enabled }: UseWakeLockOptions): void
```

### Behavior

- If `enabled` is false or the API is unavailable (`'wakeLock' in navigator` is false), do nothing.
- When `enabled` becomes true: call `navigator.wakeLock.request('screen')` and store the `WakeLockSentinel`.
- Release the sentinel when the component unmounts or `enabled` becomes false.
- The `visibilitychange` event causes wake locks to be released automatically by the browser. Re-acquire on `document.visibilityState === 'visible'` while `enabled` is still true.
- All `WakeLockSentinel` interactions are wrapped in try/catch. Errors are silently swallowed — wake lock is a best-effort feature.

### Usage in `ChecklistView`

```tsx
useWakeLock({ enabled: preferences.keep_screen_awake })
```

`preferences` is passed in as a prop from `AppInner` (see App Integration below).

---

## UI

### Gear icon placement

Add a `<Settings className="w-4 h-4" />` button (from `lucide-react`) to open `SettingsSheet`:

- **`AircraftSelector`:** Top-right corner of the header, alongside the existing user avatar/sign-out area. The button has the same styling as other icon buttons in that header.
- **`ChecklistView`:** In the top-bar `<header>`, to the right of the existing theme-cycle button position. The theme-cycle button is removed and replaced by this gear icon.

Both buttons call a shared `onOpenSettings` callback prop that sets a `settingsOpen` boolean in `AppInner`.

---

### `SettingsSheet`

**File:** `src/components/SettingsSheet.tsx`

A modal sheet that renders over all app content.

#### Layout

- **Mobile (viewport width < 640px):** Bottom sheet. Slides up from bottom edge. Max-height 85vh, rounded top corners (`rounded-t-2xl`). Scrollable internally if content overflows.
- **Desktop (≥ 640px):** Centered modal. Max-width 480px, full `rounded-2xl`, centered with a backdrop.
- Backdrop: `bg-black/70 backdrop-blur-sm`, same as existing modals in `ChecklistView`.
- Close triggers: X button (top-right of sheet), backdrop click.
- Animation: `animate-slide-up` (bottom sheet) / `animate-fade-in` (desktop modal) — matches existing modal animations.

#### Props

```ts
interface SettingsSheetProps {
  preferences:      UserPreferences
  onUpdatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  allAircraft:      Aircraft[]
  onSignOut:        () => void
  onClose:          () => void
}
```

#### Sections

**1. Appearance**

- **Theme:** Row labeled "Theme" with a 3-button toggle. Buttons: "Dark", "Night", "Day".
  - Selected button: `bg-cockpit-amber/15 border-cockpit-amber/40 text-cockpit-amber`
  - Unselected: `bg-cockpit-card border-cockpit-border text-cockpit-text-secondary hover:text-cockpit-text-primary`
  - Each button includes its icon to the left: `<Moon />` (Dark), `<Lightbulb />` (Night), `<Sun />` (Day)

- **Text Size:** Row labeled "Text Size" with a 4-button toggle. Buttons: "S", "M", "L", "XL".
  - Below the buttons, a small label showing the full description: "sm — Compact", "md — Default", "lg — Large", "xl — Extra Large"
  - Same selected/unselected styling as theme buttons

**2. Cockpit Display**

- **Keep Screen Awake:** A full-width row with label "Keep Screen Awake" on the left and a toggle switch on the right. Below the label: `<p className="text-xs text-cockpit-text-dim">Prevents display sleep during flight</p>`
  - If `'wakeLock' in navigator` is false, append "(not supported on this device)" to the description text. The toggle is still shown but its value has no functional effect.
  - Toggle switch: custom styled `<button role="switch">` following the existing toggle pattern in the codebase. Active: `bg-cockpit-green`, inactive: `bg-cockpit-card border border-cockpit-border`.

**3. Navigation**

- **Default Aircraft:** Row labeled "Default Aircraft". A `<select>` element styled to match the cockpit theme.
  - First option: `<option value="">None — always show selector</option>`
  - Remaining options: one per aircraft in `allAircraft`, sorted alphabetically by `aircraft.name`. Value = `aircraft.id`, label = `aircraft.name`.
  - On change: `onUpdatePreference('default_aircraft_id', value || null)`

**4. Account**

- **Subscription:** A full-width row that acts as a navigation link. Label: "Subscription", right side: a `<ChevronRight />` icon. On press: calls `onClose()` then navigates to SubscriptionScreen (not yet built — leave a `// TODO: navigate to SubscriptionScreen` comment in the handler).
- **Sign Out:** A full-width button. Label: "Sign Out". Text color `text-red-400`. On press: calls `onSignOut()` then `onClose()`.

#### Section layout

Each section has a heading: `<p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider px-1 mb-3">`. Sections are separated by `<div className="my-5 border-t border-cockpit-border/40" />`. Each row within a section uses `flex items-center justify-between gap-4 py-3`.

---

## App Integration

### `AppInner` in `App.tsx`

```tsx
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

  if (authLoading || prefsLoading) { /* existing spinner */ }
  if (!user) return <LoginScreen />

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

**Prop changes to existing components:**

- `ChecklistView`: Remove `onCycleTheme: () => void` and `theme: string` props. Add `preferences: UserPreferences` and `onOpenSettings: () => void`.
  - `useWakeLock({ enabled: preferences.keep_screen_awake })` called inside `ChecklistView`.
  - The theme-cycle button in the header is replaced by the gear button.

- `AircraftSelector`: Add `onOpenSettings: () => void` prop. The floating theme-cycle button in `AppInner` is removed entirely.

---

## Migration

### `pilot-theme` localStorage key

On the first load after this feature ships, the user will have no `user_preferences` row. The `usePreferences` hook detects a missing row (PGRST116 error) and runs the upsert. During that upsert, it reads `localStorage.getItem('pilot-theme')` and, if present, uses it as the initial theme value rather than the hard-coded default `'dark'`. After the upsert succeeds, `pilot-theme` is deleted from localStorage.

This means:
- Users who previously used the app and had a theme set will see the same theme after the upgrade without any visible reset.
- Users with no `pilot-theme` entry get the default dark theme.
- The migration runs exactly once per device. On subsequent loads the row exists and the code path is not reached.

### `useTheme.ts` deprecation

Once `usePreferences` is integrated into `AppInner`:
1. Remove the `import { useTheme }` call and `const { theme, setTheme } = useTheme()` from `App.tsx`.
2. Remove the `onCycleTheme` and `theme` props from `ChecklistView`.
3. Delete `src/hooks/useTheme.ts`.
4. Remove the `THEME_LABELS` constant and `cycleTheme` function from `App.tsx`.

---

## File Checklist

| File | Action |
|---|---|
| `src/types/index.ts` | Add `Theme`, `TextSize`, `UserPreferences`, `DEFAULT_PREFERENCES` |
| `src/hooks/usePreferences.ts` | Create |
| `src/hooks/useWakeLock.ts` | Create |
| `src/components/SettingsSheet.tsx` | Create |
| `src/App.tsx` | Integrate `usePreferences`, add `settingsOpen` state, remove `useTheme`, remove `cycleTheme` |
| `src/components/ChecklistView.tsx` | Replace `onCycleTheme`/`theme` props with `preferences`/`onOpenSettings`, add gear button, add `useWakeLock` call |
| `src/components/AircraftSelector.tsx` | Add `onOpenSettings` prop, add gear button |
| `src/components/ChecklistItems.tsx` | Apply `--text-scale` to action and response text |
| `src/components/PhaseBanner.tsx` | Apply `--text-scale` to phase title heading |
| `src/index.css` | Add `--text-scale: 1` to `:root` |
| `src/hooks/useTheme.ts` | Delete |
