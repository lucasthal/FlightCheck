# Item Notes in Edit Mode — Design Spec

## Goal

Allow users to add, edit, and remove a note on any checklist item while in profile edit mode. Notes display in the checklist view with yellow caution styling, consistent with how POH caution items render.

## Architecture

No schema changes required. `ProfileItem` already has `note?: string` and `severity?: ItemSeverity`, and `useProfileEditor.updateItem` already accepts patches to both fields. `useProfileEditor.save` already persists `note` to Supabase. The feature is entirely a UI addition in `ChecklistEditorView` and a minor styling change in `ChecklistItems`.

## Data Model

When a user saves a note, two fields on the `ProfileItem` are written:
- `note`: the note text string
- `severity`: set to `'caution'` to produce yellow styling in the checklist view

When a note is removed, both fields are cleared (`note: undefined`, `severity: undefined`), restoring the item to its default appearance. Items that already had a POH-sourced severity (e.g. `'warning'`) would have it overwritten — acceptable because the editor is already a custom profile.

## Editor UI (`ChecklistEditorView` — `SortableItemRow`)

### No note present
- "Add note" text button appears after the sparkle badge (if any), before the edit pencil and delete buttons
- Style: `text-xs text-cockpit-text-dim`, subtle hover to amber tint

### Adding a note (open state)
- Clicking "Add note" sets local state `noteOpen: true`
- A `<textarea>` expands below the item row (left-aligned with the text content, not the drag handle)
- Border: `border-cockpit-amber/30 bg-cockpit-bg`, focused border `border-yellow-500/50`
- Two buttons below: **Save** (amber tint) and **Cancel**
- Save calls `editor.updateItem(phaseId, item.id, { note: text.trim(), severity: 'caution' })`, then closes
- Cancel discards draft and closes
- If draft is empty and user clicks Save, treat as Remove (clear both fields)
- "Add note" button highlights amber while textarea is open

### Note present (closed state)
- Yellow left border stripe on the item row (`border-l-2 border-yellow-500`)
- Button changes to "Edit note" with yellow tint (`text-yellow-500 bg-yellow-500/10 border border-yellow-500/30`)
- Yellow note block displayed below the row:
  - `bg-yellow-500/8 border border-yellow-500/20 rounded-lg`
  - `⚠ NOTE` label in `text-yellow-500 text-xs font-bold uppercase`
  - Note text in `text-xs text-yellow-200`
  - "✕ Remove note" link (`text-xs text-cockpit-text-dim hover:text-red-400`)

### Editing an existing note (open state)
- Clicking "Edit note" opens the textarea pre-filled with current note text
- Same Save / Cancel / Remove behaviour as above

## Checklist View (`ChecklistItems` — `ChecklistItemRow`)

No new code required for displaying user notes — the existing `isCaution` path already renders correctly:
- Yellow left stripe
- `border-yellow-500/20 bg-yellow-500/5` row tint
- `⚠ CAUTION` badge
- The collapsible note panel (blue currently) should also render in yellow to match

**One styling change:** the note expand panel (`bg-cockpit-blue/10 border-cockpit-blue/20` text `text-cockpit-text-secondary`) should be tinted yellow when `isCaution` is true, to match the overall caution treatment.

## Files Changed

| File | Change |
|---|---|
| `src/components/ChecklistEditorView.tsx` | Add note open/close state and UI to `SortableItemRow` |
| `src/components/ChecklistItems.tsx` | Tint the note expand panel yellow when `isCaution` |

No changes to types, hooks, data files, or Supabase schema.

## Behaviour Notes

- Only one item's note textarea can be open at a time (closing the previous when a new one opens is not required — keep it simple, each row manages its own state independently)
- Dragging an item while its note textarea is open is acceptable; the textarea will close on re-render
- Setup wizard items (`severity: 'setup'`) that get a note written will have `severity` overwritten to `'caution'` — the sparkle badge will disappear after the note is saved. Acceptable trade-off.
- POH items in profiles that already have `note` text but no severity will gain `severity: 'caution'` only when the user explicitly edits them through this UI
