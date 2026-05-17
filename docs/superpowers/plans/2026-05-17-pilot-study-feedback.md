# Pilot Study Feedback System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent floating feedback button to the app that pre-fills the pilot's name and email, captures which aircraft and phase they're on, and stores submissions in a Supabase table.

**Architecture:** Global FAB rendered in `App.tsx` controls a modal; a `useFeedback` hook handles the Supabase insert; `ChecklistView` gains an `onPhaseChange` callback so `App.tsx` can track the active phase name for context.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase JS client (`@supabase/supabase-js`), Lucide React icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/useFeedback.ts` | **Create** | Supabase insert, submitting/error/success state |
| `src/components/FeedbackModal.tsx` | **Create** | Form modal (name, email, message, context strip) |
| `src/components/FeedbackButton.tsx` | **Create** | FAB + owns modal open/close state |
| `src/components/ChecklistView.tsx` | **Modify** | Add `onPhaseChange?` prop, call it on phase select |
| `src/App.tsx` | **Modify** | Add `activePhaseName` state, render FeedbackButton |

---

### Task 1: Create the Supabase feedback table

**Files:** No code files — manual step in Supabase dashboard.

- [ ] **Step 1: Open Supabase SQL editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run the table + RLS migration**

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

- [ ] **Step 3: Verify the table exists**

In Supabase Table Editor, confirm `feedback` appears with all 9 columns. No rows yet.

- [ ] **Step 4: Commit a note**

```bash
git commit --allow-empty -m "feat(feedback): create supabase feedback table (manual migration)"
```

---

### Task 2: `useFeedback` hook

**Files:**
- Create: `src/hooks/useFeedback.ts`

- [ ] **Step 1: Create the file**

```ts
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface FeedbackPayload {
  name: string
  message: string
  aircraftId: string | null
  aircraftName: string | null
  phaseName: string | null
}

export function useFeedback(user: User | null) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (payload: FeedbackPayload) => {
    if (!user) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('feedback').insert({
      user_id: user.id,
      email: user.email,
      name: payload.name,
      message: payload.message,
      aircraft_id: payload.aircraftId,
      aircraft_name: payload.aircraftName,
      phase_name: payload.phaseName,
    })
    setSubmitting(false)
    if (err) {
      setError('Something went wrong — please try again')
    } else {
      setSuccess(true)
    }
  }

  const reset = () => {
    setError(null)
    setSuccess(false)
  }

  return { submit, submitting, error, success, reset }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFeedback.ts
git commit -m "feat(feedback): add useFeedback hook for supabase insert"
```

---

### Task 3: `FeedbackModal` component

**Files:**
- Create: `src/components/FeedbackModal.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Aircraft } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useFeedback } from '../hooks/useFeedback'

interface Props {
  isOpen: boolean
  onClose: () => void
  aircraft: Aircraft | null
  phaseName: string | null
}

export function FeedbackModal({ isOpen, onClose, aircraft, phaseName }: Props) {
  const { user } = useAuth()
  const { submit, submitting, error, success, reset } = useFeedback(user)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(user?.user_metadata?.full_name ?? '')
      setMessage('')
      reset()
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (success) {
      const t = setTimeout(onClose, 1500)
      return () => clearTimeout(t)
    }
  }, [success, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, submitting, onClose])

  if (!isOpen) return null

  const contextLabel = aircraft
    ? [aircraft.name, phaseName].filter(Boolean).join(' · ')
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit({
      name,
      message,
      aircraftId: aircraft?.id ?? null,
      aircraftName: aircraft?.name ?? null,
      phaseName,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!submitting) onClose() }}
      />

      {/* Card */}
      <div className="relative bg-[var(--cockpit-card)] border border-[var(--cockpit-border)] rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="feedback-title" className="text-base font-semibold text-cockpit-text-primary">
            Send Feedback
          </h2>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="p-1.5 rounded-lg text-cockpit-text-dim hover:text-cockpit-text-primary
                       transition-colors duration-150 cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="fb-name" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Name
            </label>
            <input
              id="fb-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-primary text-sm
                         focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                         transition-all duration-150"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="fb-email" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="fb-email"
              type="email"
              value={user?.email ?? ''}
              readOnly
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-dim text-sm opacity-50 cursor-not-allowed"
            />
          </div>

          {/* Message */}
          <div>
            <label htmlFor="fb-message" className="block text-xs font-medium text-cockpit-text-secondary mb-1.5">
              Message
            </label>
            <textarea
              id="fb-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="What's on your mind?"
              className="w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
                         text-cockpit-text-primary text-sm placeholder-cockpit-text-dim resize-none
                         focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                         transition-all duration-150"
            />
          </div>

          {/* Context strip */}
          {contextLabel && (
            <div>
              <p className="text-xs text-cockpit-text-dim uppercase tracking-wide mb-1">Attaching context</p>
              <p className="text-xs font-mono text-cockpit-text-dim bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2">
                {contextLabel}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium
                         hover:text-cockpit-text-primary hover:border-cockpit-text-dim
                         transition-all duration-150 cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer disabled:opacity-50
                ${success
                  ? 'bg-cockpit-green/20 text-cockpit-green border border-cockpit-green/30'
                  : 'bg-cockpit-amber text-cockpit-bg hover:opacity-90'
                }`}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-cockpit-bg/30 border-t-cockpit-bg animate-spin" />
                  Sending…
                </span>
              ) : success ? 'Sent!' : 'Send Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedbackModal.tsx
git commit -m "feat(feedback): add FeedbackModal component"
```

---

### Task 4: `FeedbackButton` FAB component

**Files:**
- Create: `src/components/FeedbackButton.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { Aircraft } from '../types'
import { FeedbackModal } from './FeedbackModal'

interface Props {
  aircraft: Aircraft | null
  phaseName: string | null
}

export function FeedbackButton({ aircraft, phaseName }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-6 right-6 z-40 w-11 h-11 flex items-center justify-center rounded-full
                   bg-[var(--cockpit-card)] border border-[var(--cockpit-border)]
                   text-cockpit-text-secondary hover:text-cockpit-text-primary
                   hover:border-cockpit-amber/60 hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]
                   transition-all duration-200 cursor-pointer"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        aircraft={aircraft}
        phaseName={phaseName}
      />
    </>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedbackButton.tsx
git commit -m "feat(feedback): add FeedbackButton FAB component"
```

---

### Task 5: Wire up context flow in `App.tsx` and `ChecklistView.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ChecklistView.tsx`

- [ ] **Step 1: Add `onPhaseChange` prop to `ChecklistView`**

In `src/components/ChecklistView.tsx`, find the `Props` interface (line ~43):

```ts
interface Props {
  aircraft: Aircraft
  onBack: () => void
  onOpenSettings: () => void
}
```

Change it to:

```ts
interface Props {
  aircraft: Aircraft
  onBack: () => void
  onOpenSettings: () => void
  onPhaseChange?: (phaseName: string) => void
}
```

Then find `handlePhaseSelect` (line ~258):

```ts
const handlePhaseSelect = (phaseId: string) => {
  selectPhase(phaseId)
  setSidebarOpen(false)
}
```

Change it to:

```ts
const handlePhaseSelect = (phaseId: string) => {
  selectPhase(phaseId)
  setSidebarOpen(false)
  const phase = activeAircraft.phases.find(p => p.id === phaseId)
  if (phase) onPhaseChange?.(phase.name)
}
```

Also destructure `onPhaseChange` from props — find the function signature:

```ts
export function ChecklistView({ aircraft, onBack, onOpenSettings }: Props) {
```

Change it to:

```ts
export function ChecklistView({ aircraft, onBack, onOpenSettings, onPhaseChange }: Props) {
```

- [ ] **Step 2: Wire up `App.tsx`**

Replace the entire `AppInner` function in `src/App.tsx` with:

```tsx
function AppInner() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const [activePhaseName, setActivePhaseName] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, loading } = useAuth()
  usePreferences(user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
        <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  const handleSelectAircraft = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft)
    setActivePhaseName(null)
  }

  const handleBack = () => {
    setSelectedAircraft(null)
    setActivePhaseName(null)
  }

  return (
    <>
      {selectedAircraft ? (
        <ChecklistView
          aircraft={selectedAircraft}
          onBack={handleBack}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onPhaseChange={setActivePhaseName}
        />
      ) : (
        <AircraftSelector onSelect={handleSelectAircraft} onOpenSettings={() => setIsSettingsOpen(true)} />
      )}

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <FeedbackButton aircraft={selectedAircraft} phaseName={activePhaseName} />
    </>
  )
}
```

- [ ] **Step 3: Add the import for `FeedbackButton` in `App.tsx`**

At the top of `src/App.tsx`, add:

```ts
import { FeedbackButton } from './components/FeedbackButton'
```

The full imports block should be:

```ts
import { useState } from 'react'
import type { Aircraft } from './types'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { LoginScreen } from './components/LoginScreen'
import { SettingsSheet } from './components/SettingsSheet'
import { FeedbackButton } from './components/FeedbackButton'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePreferences } from './hooks/usePreferences'
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/ChecklistView.tsx
git commit -m "feat(feedback): wire FeedbackButton into App with phase context"
```
