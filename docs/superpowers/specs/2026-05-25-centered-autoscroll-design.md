# Centered Autoscroll with Symmetric Padding — Design

**Date:** 2026-05-25
**Status:** Approved
**Author:** Brainstorm with Louie

## Goal

Make the checklist auto-scroll always position the next-to-check item at the vertical center of the scroll container, regardless of list length, and let the user turn the feature on or off.

## Problem

The current `handleToggleItem` in `ChecklistView.tsx:266-284` scrolls each newly-active item to the center of the container, but with no top or bottom padding. Three issues result:

1. **Long lists stop scrolling at the bottom.** Once the natural scroll range is exhausted, the last several items can't reach the center — they stay wherever the layout puts them.
2. **Short lists never scroll.** If the whole list fits in the viewport, nothing moves, so the active item stays at the top, inconsistent with the centered feel of long-list scrolling.
3. **No off switch.** Pilots who prefer manual scrolling can't disable the behavior.

## Solution

Add symmetric virtual padding (top and bottom spacers) around the items list so every item — including the first and the last — has enough scroll runway to land at the container's vertical center. Make the behavior toggleable via a new user preference.

## Layout

The scrollable container (`contentRef` in `ChecklistView`) wraps the items list in two spacer elements:

```
┌─────────────────────────┐  ← container top
│  top spacer             │
│  (height ≈ container.h  │
│   / 2 - item.h / 2)     │
├─────────────────────────┤
│  item 1                 │  ← initially at vertical center
│  item 2                 │
│  ...                    │
│  item N                 │
├─────────────────────────┤
│  bottom spacer          │
│  (same height as top)   │
└─────────────────────────┘  ← container bottom
```

Spacer height is recalculated on container resize (orientation change, keyboard show/hide, window resize) so the centering stays correct.

### Measurement strategy

Spacer height = `container.clientHeight / 2 - firstItemHeight / 2`. The first item's height is measured via its rendered DOM node (`getBoundingClientRect().height`) on mount and on resize. If item rendering is delayed (no items yet), spacer height defaults to `container.clientHeight / 2` until the first item appears.

When scroll position is 0, the top spacer fills the upper half of the viewport and the first item appears at center. As items are checked, the scroll target shifts the next item upward into the same center position. The bottom spacer ensures item N can also reach center.

## Scroll target (formula unchanged)

```ts
const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
container.scrollTo({ top, behavior: 'smooth' })
```

The math doesn't change — what changes is that every item now has the scroll headroom to satisfy it.

## Preserved behavior

- **Manual scroll wins:** existing `userScrolledRef` logic stays. If the user wheels or touches during a check sequence, the next auto-scroll is skipped, then the flag resets.
- **Scroll reset on phase change:** existing `contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })` still runs; with the new top padding, "top: 0" now visually centers the first item.
- **Auto-scroll fires on check, not uncheck:** existing guard `if (!isItemChecked(id) && activePhase)` is unchanged.

## User preference

### Type additions

In `src/types.ts`, add to `UserPreferences`:

```ts
autoscroll: boolean   // default: true
```

Add to `DEFAULT_PREFERENCES`:

```ts
autoscroll: true,
```

### Database migration

One-time SQL run in Supabase Dashboard → SQL Editor:

```sql
ALTER TABLE user_preferences
  ADD COLUMN autoscroll BOOLEAN NOT NULL DEFAULT true;
```

### Load path

In `src/hooks/usePreferences.ts`, the existing load logic already uses `?? DEFAULT_PREFERENCES.<field>`, so `autoscroll: data.autoscroll ?? DEFAULT_PREFERENCES.autoscroll` is added to the loaded shape. No other changes to load/save logic — the existing `updatePreference<K>` setter handles the new field generically.

### Setting UI

In `src/components/SettingsSheet.tsx`, a toggle is added in the same logical group as `keep_screen_awake`:

```
Auto-scroll to next item       [toggle]
```

Use the same toggle component pattern as the existing keep-screen-awake toggle.

## Behavior when toggle is OFF

When `preferences.autoscroll === false`:

- Spacers render with zero height. Layout returns to top-anchored.
- `handleToggleItem` skips the `container.scrollTo(...)` call entirely. Item check still works; just no auto-advance.
- Pre-redesign behavior is effectively restored.

## What this addresses

| User complaint | Fix |
|---|---|
| "Jumps too far" | Scroll-per-tap is now one item height (~50px) because the list is already largely centered, not "anywhere → center". |
| "Stops at bottom of list" | Bottom spacer gives runway; the last item lands at center. |
| "No autoscroll for small lists" | Top spacer pushes the first item to center; subsequent items scroll up identically to long lists. |
| "Needs to be toggleable" | New `autoscroll` preference, defaulting on. |

## Non-goals

- No change to the scroll *animation* speed/easing — only the position math via padding.
- No change to the manual-scroll-wins behavior.
- No change to phases that have no items (those already return early in the existing logic).
- No change to how uncheck behaves (no reverse auto-scroll).

## Out of scope

- Persisting the manual-scroll override across phase changes.
- Snap-to-item or scroll-snap CSS.
- Variable item heights are supported by the existing formula (uses `el.clientHeight`), but no special UX is added for tall items.
