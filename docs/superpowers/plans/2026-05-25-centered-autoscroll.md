# Centered Autoscroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add symmetric top/bottom padding around the checklist items so every item lands at the vertical center of the scroll container when activated, and add a user preference toggle.

**Architecture:** New `autoscroll: boolean` field on `UserPreferences` (default `true`), surfaced as a toggle in `SettingsSheet`. `ChecklistView` reads it, renders dynamically-sized spacer divs around `<ChecklistItems>`, and gates the existing `container.scrollTo(...)` call on it.

**Tech Stack:** React 18 + TypeScript + Tailwind, Supabase (Postgres) for preference persistence, no test framework in repo — verification is `tsc --noEmit` per task plus a manual dev-server check at the end.

**Spec:** `docs/superpowers/specs/2026-05-25-centered-autoscroll-design.md`

---

## Task 1: Database migration (MANUAL)

This is a one-time SQL run by the project owner in the Supabase Dashboard. The engineer should **stop and request the user perform it** before proceeding to subsequent tasks, because Task 3's toggle will write to a column that doesn't yet exist.

**Files:**
- None (Supabase Dashboard SQL Editor)

- [ ] **Step 1: User runs SQL in Supabase**

Ask the user to run this in their Supabase project:

```sql
ALTER TABLE user_preferences
  ADD COLUMN autoscroll BOOLEAN NOT NULL DEFAULT true;
```

Expected: success, no error. New column visible in `user_preferences` table.

- [ ] **Step 2: Confirm with user before continuing**

Don't start Task 2 until the user confirms the migration succeeded.

---

## Task 2: Add `autoscroll` field to types, defaults, and load path

**Files:**
- Modify: `src/types/index.ts` (lines 100-112 — `UserPreferences` and `DEFAULT_PREFERENCES`)
- Modify: `src/hooks/usePreferences.ts` (lines 65-71 — the `loaded` object shape)

- [ ] **Step 1: Add `autoscroll` to the `UserPreferences` interface**

Edit `src/types/index.ts` lines 100-105 from:

```ts
export interface UserPreferences {
  theme:               Theme
  text_size:           TextSize
  keep_screen_awake:   boolean
  default_aircraft_id: string | null
}
```

To:

```ts
export interface UserPreferences {
  theme:               Theme
  text_size:           TextSize
  keep_screen_awake:   boolean
  default_aircraft_id: string | null
  autoscroll:          boolean
}
```

- [ ] **Step 2: Add `autoscroll: true` to `DEFAULT_PREFERENCES`**

Edit `src/types/index.ts` lines 107-112 from:

```ts
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:               'dark',
  text_size:           'md',
  keep_screen_awake:   false,
  default_aircraft_id: null,
}
```

To:

```ts
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:               'dark',
  text_size:           'md',
  keep_screen_awake:   false,
  default_aircraft_id: null,
  autoscroll:          true,
}
```

- [ ] **Step 3: Add `autoscroll` to the loaded preferences in `usePreferences.ts`**

Edit `src/hooks/usePreferences.ts` lines 65-71 from:

```ts
if (!error && data) {
  const loaded: UserPreferences = {
    theme:               data.theme               ?? DEFAULT_PREFERENCES.theme,
    text_size:           data.text_size           ?? DEFAULT_PREFERENCES.text_size,
    keep_screen_awake:   data.keep_screen_awake   ?? DEFAULT_PREFERENCES.keep_screen_awake,
    default_aircraft_id: data.default_aircraft_id ?? DEFAULT_PREFERENCES.default_aircraft_id,
  }
```

To:

```ts
if (!error && data) {
  const loaded: UserPreferences = {
    theme:               data.theme               ?? DEFAULT_PREFERENCES.theme,
    text_size:           data.text_size           ?? DEFAULT_PREFERENCES.text_size,
    keep_screen_awake:   data.keep_screen_awake   ?? DEFAULT_PREFERENCES.keep_screen_awake,
    default_aircraft_id: data.default_aircraft_id ?? DEFAULT_PREFERENCES.default_aircraft_id,
    autoscroll:          data.autoscroll          ?? DEFAULT_PREFERENCES.autoscroll,
  }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output. `usePreferences` and `DEFAULT_PREFERENCES` both satisfy the new interface.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/hooks/usePreferences.ts
git commit -m "feat(prefs): add autoscroll preference field with default true"
```

---

## Task 3: Add `Auto-scroll to next item` toggle in SettingsSheet

**Files:**
- Modify: `src/components/SettingsSheet.tsx` (insert a new toggle block after the existing "Keep screen awake" block around line 133)

- [ ] **Step 1: Insert the toggle block**

Find the closing `</div>` of the "Keep screen awake" block in `src/components/SettingsSheet.tsx` (around line 133). It looks like:

```tsx
          {/* Keep screen awake */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cockpit-text-primary">Keep screen awake</p>
            <button
              onClick={() => updatePreference('keep_screen_awake', !preferences.keep_screen_awake)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.keep_screen_awake ? 'bg-cockpit-amber' : 'bg-cockpit-border'
              }`}
              aria-label="Toggle keep screen awake"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.keep_screen_awake ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
```

Immediately after that closing `</div>`, insert:

```tsx
          {/* Auto-scroll to next item */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cockpit-text-primary">Auto-scroll to next item</p>
            <button
              onClick={() => updatePreference('autoscroll', !preferences.autoscroll)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoscroll ? 'bg-cockpit-amber' : 'bg-cockpit-border'
              }`}
              aria-label="Toggle auto-scroll to next item"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.autoscroll ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsSheet.tsx
git commit -m "feat(settings): add auto-scroll toggle"
```

---

## Task 4: Implement centered autoscroll in ChecklistView

**Files:**
- Modify: `src/components/ChecklistView.tsx`
  - Imports area at top (line 1) — add `useLayoutEffect` to React import
  - Component body around line 102 — add new ref and state
  - New effect block (after the existing effect at lines 126-137)
  - Modify `handleToggleItem` (lines 266-284)
  - Modify the JSX render around line 504 — wrap `<ChecklistItems>` in spacers

- [ ] **Step 1: Add `useLayoutEffect` to the React import**

Edit `src/components/ChecklistView.tsx` line 1 from:

```ts
import { useState, useRef, useEffect, useCallback } from 'react'
```

To:

```ts
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
```

- [ ] **Step 2: Add a state for spacer height**

In `ChecklistView.tsx`, find this block (around lines 101-103):

```tsx
  const contentRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
```

Insert immediately after:

```tsx
  const [spacerHeight, setSpacerHeight] = useState(0)
```

- [ ] **Step 3: Add a layout effect that measures container and sets spacer height**

In `ChecklistView.tsx`, find the existing scroll-wheel/touch listener block (lines 126-137):

```tsx
  useEffect(() => {
    if (editMode) return
    const el = contentRef.current
    if (!el) return
    const onUserScroll = () => { userScrolledRef.current = true }
    el.addEventListener('wheel', onUserScroll, { passive: true })
    el.addEventListener('touchmove', onUserScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', onUserScroll)
      el.removeEventListener('touchmove', onUserScroll)
    }
  }, [editMode])
```

Insert immediately after that closing `}, [editMode])`:

```tsx
  useLayoutEffect(() => {
    if (!preferences.autoscroll) {
      setSpacerHeight(0)
      return
    }
    const recalc = () => {
      const c = contentRef.current
      if (!c) return
      const firstItem = c.querySelector<HTMLElement>('[data-item-id]')
      const itemHalf = firstItem ? firstItem.clientHeight / 2 : 24
      setSpacerHeight(Math.max(0, c.clientHeight / 2 - itemHalf))
    }
    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [preferences.autoscroll, activePhaseId, editMode])
```

Why `activePhaseId` in deps: different phases have different first-item heights (some phases have notes/longer items).

Why `editMode` in deps: edit-mode uses a different render tree without items.

- [ ] **Step 4: Gate the scrollTo on the autoscroll preference**

In `ChecklistView.tsx`, find `handleToggleItem` (lines 266-284):

```tsx
  const handleToggleItem = useCallback((id: string) => {
    if (!isItemChecked(id) && activePhase) {
      if (!userScrolledRef.current) {
        const items = activePhase.items
        const idx = items.findIndex(i => i.id === id)
        const nextItem = items.slice(idx + 1).find(i => !isItemChecked(i.id))
        if (nextItem && contentRef.current) {
          const container = contentRef.current
          const el = container.querySelector<HTMLElement>(`[data-item-id="${nextItem.id}"]`)
          if (el) {
            const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
            container.scrollTo({ top, behavior: 'smooth' })
          }
        }
      }
      userScrolledRef.current = false
    }
    toggleItem(id)
  }, [toggleItem, isItemChecked, activePhase])
```

Replace with (only the `if (!userScrolledRef.current)` line gains an additional condition):

```tsx
  const handleToggleItem = useCallback((id: string) => {
    if (!isItemChecked(id) && activePhase) {
      if (!userScrolledRef.current && preferences.autoscroll) {
        const items = activePhase.items
        const idx = items.findIndex(i => i.id === id)
        const nextItem = items.slice(idx + 1).find(i => !isItemChecked(i.id))
        if (nextItem && contentRef.current) {
          const container = contentRef.current
          const el = container.querySelector<HTMLElement>(`[data-item-id="${nextItem.id}"]`)
          if (el) {
            const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
            container.scrollTo({ top, behavior: 'smooth' })
          }
        }
      }
      userScrolledRef.current = false
    }
    toggleItem(id)
  }, [toggleItem, isItemChecked, activePhase, preferences.autoscroll])
```

- [ ] **Step 5: Wrap `<ChecklistItems>` with spacer divs**

In `ChecklistView.tsx`, find the line that renders the items (around line 504):

```tsx
                <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={handleToggleItem} />
```

Replace with:

```tsx
                <div style={{ height: spacerHeight }} aria-hidden="true" />
                <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={handleToggleItem} />
                <div style={{ height: spacerHeight }} aria-hidden="true" />
```

Note: when `preferences.autoscroll === false`, `spacerHeight === 0` and the divs collapse to nothing.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChecklistView.tsx
git commit -m "feat(checklist): symmetric spacers center next item in viewport

Wraps the items list in dynamically-sized top/bottom spacers so every
item — including the first and last — has enough scroll runway to land
at the vertical center of the scroll container. Spacer height tracks
container.clientHeight / 2 - firstItem.h / 2, recalculated on phase
change and window resize. Gated on the new autoscroll preference: when
off, spacers collapse to zero and the scrollTo call is skipped."
```

---

## Task 5: Manual verification

**Files:** None (browser testing)

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Open the URL it prints in a desktop browser. Open DevTools, toggle device toolbar to a phone preset (e.g., iPhone 14 Pro, 393×852).

- [ ] **Step 2: Verify "long list" centering (autoscroll on, default state)**

Open a Cessna 172S → Preflight phase (a long list). On the first frame:

Expected:
- Empty space above the first item, taking up roughly the upper half of the scroll area
- First item appears at the vertical center of the scroll area
- Items below are visible
- Empty space below the last visible item (bottom spacer)

Tap the first item.

Expected: list scrolls smoothly so item 2 lands at the vertical center.

Tap items one by one through to the last item.

Expected: each next item lands at the center. The **last** item also lands at the center (this was the main pre-fix complaint).

- [ ] **Step 3: Verify "short list" centering**

Pick a phase with only 3–4 items (e.g., a Before Takeoff phase).

Expected:
- All items visible
- First item near center, others below
- Tapping items still smoothly centers the next one (no longer "no autoscroll on short lists")

- [ ] **Step 4: Verify the toggle**

Open Settings, find "Auto-scroll to next item" toggle (should be on by default). Toggle it off.

Return to a checklist phase.

Expected:
- No padding above the first item — items start at top of scroll area as before
- Tapping an item does not scroll the next one to center
- Behavior matches the pre-fix UX

Toggle it back on.

Expected: padding + scroll-to-center behavior returns.

- [ ] **Step 5: Verify the preference persists**

With toggle off, refresh the page. The toggle should still be off.
Toggle it on, refresh. The toggle should still be on.

(If signed in to a Supabase account, also verify by opening the app on a second device — the preference should sync.)

- [ ] **Step 6: Verify manual scroll wins**

With autoscroll on, in a long phase: scroll manually (touch/wheel) part-way through the list, then tap an item.

Expected: the auto-scroll-to-center is skipped for that one tap (existing `userScrolledRef` behavior). The next tap after that should auto-center again.

- [ ] **Step 7: Mark the task complete and push**

```bash
git push origin master
```

If everything verified above works, the implementation is done.

If any step fails verification, file the symptom (which step, what you saw vs. what was expected), don't ship.
