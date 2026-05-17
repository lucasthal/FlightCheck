# Pilot Study Feedback System — Design Spec

> **For agentic workers:** Use `superpowers:writing-plans` to turn this spec into an implementation plan.

**Goal:** A always-accessible feedback button for a small pilot study group that pre-fills the pilot's name and email, captures contextual metadata (aircraft + phase), and stores submissions in a Supabase table for review.

**Out of scope:** Email notifications, Google Form integration (handled manually outside the app).

---

## Architecture

A global floating action button (FAB) rendered once in `App.tsx`, always visible on both the aircraft selector and checklist views. A modal handles the form. A dedicated hook handles the Supabase insert.

**New files:**
- `src/components/FeedbackButton.tsx` — FAB component
- `src/components/FeedbackModal.tsx` — modal with form
- `src/hooks/useFeedback.ts` — Supabase insert logic

**Modified files:**
- `src/App.tsx` — render FAB, add `activePhaseName` state, pass `onPhaseChange` to `ChecklistView`
- `src/components/ChecklistView.tsx` — call `onPhaseChange` callback when active phase changes

---

## Data Model

Supabase table: `feedback`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | `gen_random_uuid()`, primary key |
| `user_id` | `uuid` | references `auth.users(id)` |
| `name` | `text` | from `user.user_metadata.full_name` |
| `email` | `text` | from `user.email` |
| `message` | `text` | pilot's free-text input |
| `aircraft_id` | `text` | nullable — e.g. `'cessna-172s'` |
| `aircraft_name` | `text` | nullable — e.g. `'C172S Skyhawk'` |
| `phase_name` | `text` | nullable — e.g. `'Run-Up'`, null on aircraft selector |
| `created_at` | `timestamptz` | `now()` |

**RLS policy:** pilots can only insert rows where `user_id = auth.uid()`. No read policy for pilots — all review is done by Louie via the Supabase dashboard with service role access.

**SQL to run in Supabase dashboard:**

```sql
create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  email text not null,
  message text not null,
  aircraft_id text,
  aircraft_name text,
  phase_name text,
  created_at timestamptz default now()
);

alter table feedback enable row level security;

create policy "Users can insert own feedback"
  on feedback for insert
  to authenticated
  with check (user_id = auth.uid());
```

---

## Context Flow

`App.tsx` owns both pieces of context:

- `selectedAircraft: Aircraft | null` — already in state, passes to `FeedbackButton` as `aircraft`
- `activePhaseName: string | null` — new state, initialized to `null`; set to `null` whenever `selectedAircraft` changes (i.e. back to selector); passes to `FeedbackButton` as `phaseName`

`ChecklistView` receives a new optional prop `onPhaseChange?: (phaseName: string) => void`. It calls this whenever the user navigates to a new phase (existing phase selection logic already tracks this).

When on the aircraft selector, `activePhaseName` is `null` — the feedback row stores `null` for `phase_name`.

---

## Component: `FeedbackButton`

```tsx
interface Props {
  aircraft: Aircraft | null
  phaseName: string | null
}
```

- Fixed position: `bottom-6 right-6 z-50`
- Round button, 44×44px minimum touch target
- `bg-[var(--cockpit-card)] border border-[var(--cockpit-border)] rounded-full`
- `MessageSquare` lucide icon (w-5 h-5), `text-cockpit-text-secondary`
- Hover: amber border + glow — `hover:border-cockpit-amber/60 hover:shadow-[0_0_12px_rgba(var(--cockpit-amber-rgb),0.3)]`
- `aria-label="Send feedback"`, `cursor-pointer`
- `transition-all duration-200`
- Opens `FeedbackModal` on click (controls `isOpen` state internally)

---

## Component: `FeedbackModal`

```tsx
interface Props {
  isOpen: boolean
  onClose: () => void
  aircraft: Aircraft | null
  phaseName: string | null
}
```

**Layout:**
- Full-screen overlay: `fixed inset-0 z-50 flex items-center justify-center`
- Backdrop: `bg-black/60 backdrop-blur-sm`, click to close (disabled while submitting)
- Card: `bg-[var(--cockpit-card)] border border-[var(--cockpit-border)] rounded-2xl p-6 w-full max-w-md mx-4`

**Header:** "Send Feedback" title + X close button (top-right, `aria-label="Close"`)

**Form fields** (all with `<label htmlFor>`):
1. **Name** — text input, pre-filled from `user.user_metadata?.full_name ?? ''`, editable
2. **Email** — text input, pre-filled from `user.email`, `readOnly`, visually dimmed (`opacity-50 cursor-not-allowed`)
3. **Message** — textarea (4 rows), `placeholder="What's on your mind?"`, required

**Context strip** (below message, above footer):
- Shown only when `aircraft` is set
- Non-editable, `text-xs font-mono text-cockpit-text-dim`
- Format: `C172S Skyhawk · Run-Up` (phase omitted if null)
- Label above: `text-xs text-cockpit-text-dim uppercase tracking-wide` — "Attaching context"

**Footer:**
- Cancel button (ghost style) + Submit button (amber fill)
- `<form onSubmit={handleSubmit}>` — not onClick on button
- Submit button disabled + shows spinner while `submitting === true`

**Submit states:**
1. Idle — "Send Feedback"
2. Submitting — spinner, button disabled
3. Success — button text becomes "Sent!" in `text-cockpit-green`, modal auto-closes after 1.5s
4. Error — inline error message below submit button, modal stays open, pilot can retry

---

## Hook: `useFeedback`

```ts
function useFeedback(user: User | null): {
  submit: (payload: FeedbackPayload) => Promise<void>
  submitting: boolean
  error: string | null
  success: boolean
  reset: () => void
}

interface FeedbackPayload {
  name: string
  message: string
  aircraftId: string | null
  aircraftName: string | null
  phaseName: string | null
}
```

- Inserts into `feedback` table via `supabase.from('feedback').insert({...})`
- Sets `user_id` from `user.id`, `email` from `user.email`
- On success: sets `success = true`
- On error: sets `error` to a human-readable message ("Something went wrong — please try again")
- `reset()` clears `error` and `success` back to initial state (called when modal closes)

---

## Accessibility & UX Checklist

- All inputs have `<label htmlFor>` — no placeholder-only fields
- FAB has `aria-label="Send feedback"`
- X close button has `aria-label="Close"`
- Focus trap inside modal while open
- `Escape` key closes modal
- Submit button disabled during async operation (prevents double-submit)
- `prefers-reduced-motion`: skip glow animation and auto-close transition
- Minimum 44×44px touch target on FAB and close button
- `cursor-pointer` on FAB and all interactive elements
- Focus ring visible on all interactive elements
