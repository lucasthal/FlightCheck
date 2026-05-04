# Checklist Auto-Scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a pilot checks off an item, automatically scroll the next unchecked item into the center of the viewport. If the pilot manually scrolls, suspend auto-scroll for that interaction; re-engage on the next item check.

**Architecture:** Two changes only. `ChecklistItems.tsx` adds a `data-item-id` attribute to each item's root element so `ChecklistView` can query the DOM without prop drilling. `ChecklistView.tsx` wraps `toggleItem` in a `handleToggleItem` callback that computes the next unchecked item, scrolls to it via `scrollIntoView`, and tracks user-initiated scrolls via `wheel`/`touchmove` events on the scroll container ref to know when to suppress.

**Tech Stack:** React (useRef, useCallback, useEffect), TypeScript, no new dependencies

---

## File Map

| File | What changes |
|---|---|
| `src/components/ChecklistItems.tsx` | Add `data-item-id={item.id}` to `ChecklistItemRow` root div |
| `src/components/ChecklistView.tsx` | Add `userScrolledRef`, scroll event listeners, `handleToggleItem` wrapper |

---

## Task 1: Tag each item row with its ID

**Files:**
- Modify: `src/components/ChecklistItems.tsx:43`

- [ ] **Step 1.1 — Add `data-item-id` to `ChecklistItemRow` root div**

  In `ChecklistItemRow` (line ~43), the root div currently starts:

  ```tsx
  <div
    className={`
      relative rounded-lg border transition-all duration-150 overflow-hidden
  ```

  Add `data-item-id`:

  ```tsx
  <div
    data-item-id={item.id}
    className={`
      relative rounded-lg border transition-all duration-150 overflow-hidden
  ```

---

## Task 2: Add auto-scroll logic to `ChecklistView`

**Files:**
- Modify: `src/components/ChecklistView.tsx`

- [ ] **Step 2.1 — Add `userScrolledRef` below the existing `contentRef`**

  Line 91 currently reads:

  ```ts
  const contentRef = useRef<HTMLDivElement>(null)
  ```

  Add directly below it:

  ```ts
  const userScrolledRef = useRef(false)
  ```

- [ ] **Step 2.2 — Add scroll event listeners**

  After the existing `useEffect` that scrolls to top on phase change (lines 107-109):

  ```tsx
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePhaseId])
  ```

  Add two new `useEffect` hooks immediately after:

  ```tsx
  // Reset user-scroll flag when phase changes so auto-scroll re-engages
  useEffect(() => {
    userScrolledRef.current = false
  }, [activePhaseId])

  // Track user-initiated scrolls to temporarily suspend auto-scroll
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

- [ ] **Step 2.3 — Add `handleToggleItem` callback**

  Find the `handleCompletePhase` function (line ~236). Add the following `useCallback` immediately before it:

  ```tsx
  const handleToggleItem = useCallback((id: string) => {
    if (!isItemChecked(id) && activePhase) {
      if (!userScrolledRef.current) {
        const items = activePhase.items
        const idx = items.findIndex(i => i.id === id)
        const nextItem = items.slice(idx + 1).find(i => !isItemChecked(i.id))
        if (nextItem) {
          requestAnimationFrame(() => {
            const el = contentRef.current?.querySelector<HTMLElement>(
              `[data-item-id="${nextItem.id}"]`
            )
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          })
        }
      }
      userScrolledRef.current = false
    }
    toggleItem(id)
  }, [toggleItem, isItemChecked, activePhase])
  ```

- [ ] **Step 2.4 — Wire `handleToggleItem` into `ChecklistItems`**

  Find the `<ChecklistItems>` usage in the main content area (line ~450):

  ```tsx
  <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={toggleItem} />
  ```

  Change `onToggle={toggleItem}` to `onToggle={handleToggleItem}`:

  ```tsx
  <ChecklistItems phase={activePhase} isItemChecked={isItemChecked} onToggle={handleToggleItem} />
  ```

---

## Task 3: Type-check and manually test

- [ ] **Step 3.1 — Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3.2 — Start dev server and test**

  ```bash
  npm run dev
  ```

  Open an aircraft checklist. Verify:
  - Checking the first item smoothly scrolls the second item into center view
  - Checking items in sequence keeps the next item centered
  - Manually scrolling away (wheel or touch), then checking an item — the auto-scroll does NOT fire for that check, but fires again on the following check
  - Switching phases resets auto-scroll (first check scrolls normally)

---

## Task 4: Commit

- [ ] **Step 4.1 — Commit**

  ```bash
  git add src/components/ChecklistItems.tsx src/components/ChecklistView.tsx
  git commit -m "feat: auto-scroll to next unchecked item on check, suspends on manual scroll"
  ```
