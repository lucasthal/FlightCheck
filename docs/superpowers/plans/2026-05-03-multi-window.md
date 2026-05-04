# Multi-Window Compatibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app must be fully usable at 320px–540px effective viewport widths so pilots can use it in iPad split-screen alongside ForeFlight, charts, or other apps during flight.

**Architecture:** Two known Tailwind fixes address the main failures (top bar overflow and stats bar overflow at narrow widths). A mandatory browser audit step at 320px / 400px / 540px catches any additional issues before committing.

**Tech Stack:** Tailwind CSS responsive utilities — no JS changes, no new dependencies

**Target breakpoints:**
- 320px — iPhone SE / narrow iPad split
- 400px — half-screen standard iPad
- 540px — two-thirds iPad Pro

---

## File Map

| File | What changes |
|---|---|
| `src/components/ChecklistView.tsx` | Hide progress badge below `sm:` (640px) to free space for aircraft name |
| `src/components/AircraftSelector.tsx` | Make stats bar horizontally scrollable |
| Possibly others | Identified during audit in Task 3 |

---

## Task 1: Hide progress badge at narrow widths in `ChecklistView`

**Files:**
- Modify: `src/components/ChecklistView.tsx:282-293`

At narrow widths the top bar has back button + aircraft info + progress badge + edit + theme + menu, which squeezes the aircraft name to ~70px. Hiding the badge below `sm:` (640px) gives the name ~112px — the progress bar below the top bar already communicates progress on mobile.

- [ ] **Step 1.1 — Add `hidden sm:flex` to the progress badge wrapper**

  Find the progress badge block (around line 282):

  ```tsx
  {/* Progress badge */}
  {!editMode && (
    <div className="flex-shrink-0 flex items-center gap-2">
  ```

  Change to:

  ```tsx
  {/* Progress badge */}
  {!editMode && (
    <div className="flex-shrink-0 hidden sm:flex items-center gap-2">
  ```

---

## Task 2: Make stats bar scrollable in `AircraftSelector`

**Files:**
- Modify: `src/components/AircraftSelector.tsx:211`

The stats bar (`flex items-center gap-4`) shows 5 category counts totalling ~300px, which overflows at 320px. Adding `overflow-x-auto scrollbar-none` makes it scrollable.

- [ ] **Step 2.1 — Add overflow scroll to the stats bar**

  Find line ~211:

  ```tsx
  <div className="flex items-center gap-4 mt-4 mb-5">
  ```

  Change to:

  ```tsx
  <div className="flex items-center gap-4 mt-4 mb-5 overflow-x-auto scrollbar-none">
  ```

---

## Task 3: Audit at 320px / 400px / 540px

This is a required manual audit step. Open the app in the browser and use DevTools responsive mode to identify any remaining layout issues.

- [ ] **Step 3.1 — Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 3.2 — Open DevTools responsive mode**

  In Chrome/Edge: F12 → Toggle Device Toolbar (Ctrl+Shift+M)

  Test each of these widths in sequence: **320px**, **400px**, **540px**

- [ ] **Step 3.3 — Audit the Home screen (AircraftSelector) at each width**

  Check for:
  - [ ] Logo row + profile button: no overflow, profile name hidden on narrow (already `hidden sm:block`) ✓
  - [ ] Stats bar: scrollable after Task 2 fix ✓
  - [ ] Fleet strip: scrolls horizontally ✓
  - [ ] Search input: full width ✓
  - [ ] Category filter pills: already `overflow-x-auto` ✓
  - [ ] Aircraft grid: `grid-cols-1 sm:grid-cols-2` — shows 1 column at 320px ✓
  - [ ] Any other overflow or broken layout? Note it here for Task 4.

- [ ] **Step 3.4 — Audit the Checklist screen (ChecklistView) at each width**

  Navigate into an aircraft checklist. Check for:
  - [ ] Top bar: aircraft name is readable after Task 1 fix ✓
  - [ ] Phase banner: icon + name + percentage row — name truncates gracefully ✓
  - [ ] Checklist items: action text wraps, response is visible ✓
  - [ ] Bottom phase strip: pills scroll horizontally ✓
  - [ ] "Mark Phase Complete" button: full width, readable ✓
  - [ ] Any other overflow or broken layout? Note it here for Task 4.

- [ ] **Step 3.5 — Audit the Settings sheet (if User Settings plan has been executed)**

  If the `SettingsSheet` exists, check it opens and closes correctly at 320px.

---

## Task 4: Fix any issues found in the audit

If Task 3 found additional issues, fix them here. Apply the same pattern as Tasks 1 and 2: add responsive Tailwind classes (`hidden sm:flex`, `overflow-x-auto`, `flex-wrap`, `min-w-0`, `truncate`) rather than fixed pixel values.

Common patterns:
- Element overflows: add `overflow-x-auto scrollbar-none` to its container
- Text overflows: add `truncate` or `min-w-0` to the text element
- Too many items in a row: add `hidden sm:block` to lower-priority items
- Touch targets too small: add `min-h-[44px]` or `min-w-[44px]`

- [ ] **Step 4.1 — Apply fixes for any issues found**

  *(Make specific edits based on what the audit found. If no issues were found, skip this task.)*

---

## Task 5: Test on iPad split-screen

- [ ] **Step 5.1 — Simulate iPad split-screen in browser**

  In DevTools responsive mode, set the viewport to **820px wide** (iPad Air width). Then narrow to **410px** (50% split). Verify the checklist is fully usable.

  Alternatively, if you have an iPad: open the PWA, enter split-screen with another app (e.g., Safari + Maps), verify the checklist reflows correctly.

- [ ] **Step 5.2 — Verify auto-scroll still works in split-screen mode**

  Check off items while in the narrowed view. Confirm the next item scrolls into view.

---

## Task 6: Type-check and commit

- [ ] **Step 6.1 — Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors (only Tailwind class changes, no TypeScript impact).

- [ ] **Step 6.2 — Commit**

  ```bash
  git add src/components/ChecklistView.tsx src/components/AircraftSelector.tsx
  git commit -m "feat: multi-window compatibility — hide narrow top bar elements, scrollable stats bar"
  ```

  If Task 4 added additional fixes, include those files in the commit.
