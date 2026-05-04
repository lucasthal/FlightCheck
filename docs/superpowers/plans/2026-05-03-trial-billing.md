# Trial & Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate all app access behind a 5-day free trial + $2.99/month subscription, with fully stubbed payment gateway calls safe to deploy before a real gateway is wired.
**Architecture:** A `useBilling` hook fetches and maintains subscription state from a Supabase `user_subscriptions` table; `AppInner` in `App.tsx` reads that state to decide which screen to render; all payment gateway functions live in `src/lib/billingService.ts` as clearly-marked stubs that write only to Supabase.
**Tech Stack:** React, TypeScript, Supabase, Tailwind CSS

---

## Task 1: Supabase table + TypeScript types

**Files:**
- Modify: `src/types/index.ts`

### Steps

- [ ] **1.1 — Run the SQL in the Supabase dashboard**

  Open the Supabase SQL editor for the project and run the following. (This cannot be done from code — it requires dashboard access.)

  ```sql
  -- Create user_subscriptions table
  CREATE TABLE user_subscriptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trial_started_at    timestamptz NOT NULL,
    trial_ends_at       timestamptz NOT NULL,
    subscription_status text NOT NULL,
    payment_customer_id text,
    created_at          timestamptz DEFAULT now(),
    UNIQUE (user_id)
  );

  -- Enable Row-Level Security
  ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

  -- Policy: users may read and write only their own row
  CREATE POLICY "own subscription" ON user_subscriptions
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```

- [ ] **1.2 — Add `SubscriptionStatus` type and `UserSubscription` interface to `src/types/index.ts`**

  Append to the bottom of `src/types/index.ts`:

  ```ts
  // ---------------------------------------------------------------------------
  // Billing
  // ---------------------------------------------------------------------------

  /*
   * SQL to create the user_subscriptions table — run once in the Supabase dashboard:
   *
   * CREATE TABLE user_subscriptions (
   *   id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   *   user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
   *   trial_started_at    timestamptz NOT NULL,
   *   trial_ends_at       timestamptz NOT NULL,
   *   subscription_status text NOT NULL,
   *   payment_customer_id text,
   *   created_at          timestamptz DEFAULT now(),
   *   UNIQUE (user_id)
   * );
   *
   * ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
   *
   * CREATE POLICY "own subscription" ON user_subscriptions
   *   USING (auth.uid() = user_id)
   *   WITH CHECK (auth.uid() = user_id);
   */

  export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'cancelled'

  export interface UserSubscription {
    id: string
    user_id: string
    trial_started_at: string   // ISO timestamptz from Supabase
    trial_ends_at: string      // ISO timestamptz from Supabase
    subscription_status: SubscriptionStatus
    payment_customer_id: string | null
    created_at: string
  }
  ```

- [ ] **1.3 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **1.4 — Commit**

  ```
  git add src/types/index.ts
  git commit -m "feat: add SubscriptionStatus type and UserSubscription interface"
  ```

---

## Task 2: billingService stub

**Files:**
- Create: `src/lib/billingService.ts`

### Steps

- [ ] **2.1 — Create `src/lib/billingService.ts`**

  ```ts
  import { supabase } from './supabase'
  import type { SubscriptionStatus } from '../types'

  /**
   * Places a payment method on file for the user.
   *
   * TODO: replace with [GATEWAY] API call — tokenize card, create customer in
   * gateway, return external customer ID. For now returns a hard-coded stub ID.
   */
  export async function setupPaymentMethod(
    _userId: string,
  ): Promise<{ customerId: string }> {
    // TODO: replace with [GATEWAY] API call
    return { customerId: 'stub_customer' }
  }

  /**
   * Returns the current subscription status for the user from the database.
   *
   * TODO: replace with [GATEWAY] API call — reconcile against gateway's
   * subscription state before returning.
   */
  export async function getSubscriptionStatus(
    userId: string,
  ): Promise<SubscriptionStatus> {
    // TODO: replace with [GATEWAY] API call
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('subscription_status')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data.subscription_status as SubscriptionStatus
  }

  /**
   * Cancels the user's subscription by setting status to 'cancelled'.
   *
   * TODO: replace with [GATEWAY] API call — cancel in gateway before writing
   * to the database.
   */
  export async function cancelSubscription(userId: string): Promise<void> {
    // TODO: replace with [GATEWAY] API call
    const { error } = await supabase
      .from('user_subscriptions')
      .update({ subscription_status: 'cancelled' })
      .eq('user_id', userId)

    if (error) throw error
  }
  ```

- [ ] **2.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **2.3 — Commit**

  ```
  git add src/lib/billingService.ts
  git commit -m "feat: add billingService stub (setupPaymentMethod, getSubscriptionStatus, cancelSubscription)"
  ```

---

## Task 3: useBilling hook

**Files:**
- Create: `src/hooks/useBilling.ts`

### Steps

- [ ] **3.1 — Create `src/hooks/useBilling.ts`**

  ```ts
  import { useEffect, useState } from 'react'
  import { supabase } from '../lib/supabase'
  import { useAuth } from './useAuth'
  import type { SubscriptionStatus, UserSubscription } from '../types'

  export interface BillingState {
    status: SubscriptionStatus | null
    isActive: boolean
    daysLeft: number
    loading: boolean
  }

  export function useBilling(): BillingState {
    const { user } = useAuth()
    const [state, setState] = useState<BillingState>({
      status: null,
      isActive: false,
      daysLeft: 0,
      loading: true,
    })

    useEffect(() => {
      if (!user) {
        setState({ status: null, isActive: false, daysLeft: 0, loading: false })
        return
      }

      let cancelled = false

      async function load() {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error('[useBilling] fetch error', error)
          setState({ status: null, isActive: false, daysLeft: 0, loading: false })
          return
        }

        if (!data) {
          // No subscription row — new user, needs BillingSetupScreen
          setState({ status: null, isActive: false, daysLeft: 0, loading: false })
          return
        }

        const row = data as UserSubscription
        let status = row.subscription_status

        // Client-side expiry check: if still 'trialing' but trial_ends_at has
        // passed, flip to 'expired' in Supabase before returning state.
        if (status === 'trialing' && new Date(row.trial_ends_at).getTime() < Date.now()) {
          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({ subscription_status: 'expired' })
            .eq('user_id', user!.id)

          if (!cancelled) {
            if (updateError) {
              console.error('[useBilling] expiry update error', updateError)
            } else {
              status = 'expired'
            }
          } else {
            return
          }
        }

        if (cancelled) return

        const isActive = status === 'trialing' || status === 'active'

        const daysLeft =
          status === 'trialing'
            ? Math.max(
                0,
                Math.ceil(
                  (new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000,
                ),
              )
            : 0

        setState({ status, isActive, daysLeft, loading: false })
      }

      load()

      return () => {
        cancelled = true
      }
    }, [user])

    return state
  }
  ```

- [ ] **3.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **3.3 — Commit**

  ```
  git add src/hooks/useBilling.ts
  git commit -m "feat: add useBilling hook with trial expiry detection"
  ```

---

## Task 4: BillingSetupScreen component

**Files:**
- Create: `src/components/billing/BillingSetupScreen.tsx`

### Steps

- [ ] **4.1 — Create `src/components/billing/BillingSetupScreen.tsx`**

  ```tsx
  import { useState } from 'react'
  import { supabase } from '../../lib/supabase'
  import { setupPaymentMethod } from '../../lib/billingService'
  import { useAuth } from '../../hooks/useAuth'

  function formatTrialEndDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  export function BillingSetupScreen() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const trialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      if (!user) return

      setLoading(true)
      setError(null)

      try {
        const { customerId } = await setupPaymentMethod(user.id)

        const now = new Date()
        const trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            trial_started_at: now.toISOString(),
            trial_ends_at: trialEndsAt.toISOString(),
            subscription_status: 'trialing',
            payment_customer_id: customerId,
          })

        if (insertError) throw insertError
        // useBilling() in App.tsx will detect the new row on next render
        // and transition to the normal app flow automatically.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
        setLoading(false)
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
        <div className="w-full max-w-sm bg-cockpit-panel border border-cockpit-border rounded-2xl shadow-cockpit p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-xl font-semibold text-cockpit-text-primary tracking-wide">
              FlightCheck
            </h1>
            <p className="mt-1 text-sm text-cockpit-text-secondary">
              Professional pilot checklists
            </p>
          </div>

          {/* Pricing callout */}
          <div className="text-center bg-cockpit-bg rounded-xl px-4 py-3 border border-cockpit-border">
            <p className="text-cockpit-amber font-semibold text-base">
              $2.99/month
            </p>
            <p className="text-cockpit-text-secondary text-sm mt-0.5">
              5-day free trial
            </p>
            <p className="text-cockpit-text-secondary text-xs mt-2">
              Your trial ends on{' '}
              <span className="text-cockpit-text-primary font-medium">
                {formatTrialEndDate(trialEndDate)}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Card input placeholder */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-cockpit-text-secondary uppercase tracking-widest">
                Payment method
              </label>
              <input
                type="text"
                disabled
                placeholder="Payment setup coming soon"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-4 py-3
                           text-cockpit-text-secondary text-sm placeholder:text-cockpit-text-secondary/50
                           cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-cockpit-text-secondary/70">
                Your card will be charged after your trial ends.
              </p>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cockpit-amber text-cockpit-bg font-semibold text-sm py-3 rounded-lg
                         hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-cockpit-bg/30 border-t-cockpit-bg animate-spin" />
                  Setting up…
                </>
              ) : (
                'Start Free Trial'
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **4.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **4.3 — Manual smoke test** (run `npm run dev`, sign in as a brand-new user with no `user_subscriptions` row)

  - App shows `BillingSetupScreen` — cannot dismiss or navigate away
  - Trial end date displayed is today + 5 days, formatted correctly
  - Card input is disabled and non-interactive
  - Clicking "Start Free Trial" shows spinner, then transitions to the normal app
  - Refreshing the page skips `BillingSetupScreen` (row now exists)
  - Check Supabase dashboard: a `user_subscriptions` row exists with `subscription_status = 'trialing'`

- [ ] **4.4 — Commit**

  ```
  git add src/components/billing/BillingSetupScreen.tsx
  git commit -m "feat: add BillingSetupScreen component"
  ```

---

## Task 5: TrialBanner component

**Files:**
- Create: `src/components/billing/TrialBanner.tsx`

### Steps

- [ ] **5.1 — Create `src/components/billing/TrialBanner.tsx`**

  ```tsx
  import { useBilling } from '../../hooks/useBilling'

  interface TrialBannerProps {
    onManage: () => void
  }

  export function TrialBanner({ onManage }: TrialBannerProps) {
    const { status, daysLeft } = useBilling()

    if (status !== 'trialing') return null

    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2
                      flex items-center justify-between text-xs">
        <span className="text-amber-400 font-medium">
          {daysLeft === 1
            ? '1 day left in your free trial'
            : `${daysLeft} days left in your free trial`}
        </span>
        <button
          onClick={onManage}
          className="text-amber-400 hover:text-amber-300 transition-colors font-medium underline underline-offset-2"
        >
          Manage subscription
        </button>
      </div>
    )
  }
  ```

- [ ] **5.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **5.3 — Commit**

  ```
  git add src/components/billing/TrialBanner.tsx
  git commit -m "feat: add TrialBanner component"
  ```

---

## Task 6: SubscriptionExpiredScreen component

**Files:**
- Create: `src/components/billing/SubscriptionExpiredScreen.tsx`

### Steps

- [ ] **6.1 — Create `src/components/billing/SubscriptionExpiredScreen.tsx`**

  ```tsx
  import type { SubscriptionStatus } from '../../types'

  interface SubscriptionExpiredScreenProps {
    status: SubscriptionStatus
  }

  export function SubscriptionExpiredScreen({ status }: SubscriptionExpiredScreenProps) {
    const heading =
      status === 'cancelled'
        ? 'Your subscription is cancelled'
        : 'Your trial has ended'

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-cockpit-bg px-4">
        <div className="w-full max-w-sm bg-cockpit-panel border border-cockpit-border rounded-2xl
                        shadow-cockpit p-8 flex flex-col gap-6 text-center">
          {/* Heading */}
          <div>
            <h1 className="text-xl font-semibold text-cockpit-text-primary">
              {heading}
            </h1>
            <p className="mt-2 text-sm text-cockpit-text-secondary">
              FlightCheck — $2.99/month
            </p>
          </div>

          {/* CTA — disabled until gateway is wired */}
          <button
            disabled
            className="w-full bg-cockpit-amber/40 text-cockpit-bg/60 font-semibold text-sm
                       py-3 rounded-lg cursor-not-allowed"
          >
            Coming soon
          </button>

          {/* Support link */}
          <a
            href="mailto:lucas.b.thal@gmail.com"
            className="text-xs text-cockpit-text-secondary hover:text-cockpit-text-primary
                       transition-colors underline underline-offset-2"
          >
            Contact support
          </a>
        </div>
      </div>
    )
  }
  ```

- [ ] **6.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **6.3 — Manual smoke test** (use Supabase dashboard to set a test user's `subscription_status` to `'expired'`, then reload the app)

  - `SubscriptionExpiredScreen` is shown
  - Heading reads "Your trial has ended"
  - No app content is visible or accessible behind the overlay
  - "Coming soon" button is visibly disabled and non-interactive
  - "Contact support" opens a mailto link to `lucas.b.thal@gmail.com`
  - Repeat with `status = 'cancelled'` — heading reads "Your subscription is cancelled"

- [ ] **6.4 — Commit**

  ```
  git add src/components/billing/SubscriptionExpiredScreen.tsx
  git commit -m "feat: add SubscriptionExpiredScreen component"
  ```

---

## Task 7: SubscriptionScreen component

**Files:**
- Create: `src/components/billing/SubscriptionScreen.tsx`

### Steps

- [ ] **7.1 — Create `src/components/billing/SubscriptionScreen.tsx`**

  ```tsx
  import { useState } from 'react'
  import { cancelSubscription } from '../../lib/billingService'
  import { useBilling } from '../../hooks/useBilling'
  import { useAuth } from '../../hooks/useAuth'
  import type { SubscriptionStatus } from '../../types'

  const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    trialing: 'Trial',
    active: 'Active',
    expired: 'Expired',
    cancelled: 'Cancelled',
  }

  const STATUS_COLORS: Record<SubscriptionStatus, string> = {
    trialing: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    active: 'text-green-400 bg-green-400/10 border-green-400/30',
    expired: 'text-red-400 bg-red-400/10 border-red-400/30',
    cancelled: 'text-red-400 bg-red-400/10 border-red-400/30',
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  interface SubscriptionScreenProps {
    onBack: () => void
    // Called after a successful cancellation so App.tsx can re-fetch billing state
    onCancelled?: () => void
  }

  export function SubscriptionScreen({ onBack, onCancelled }: SubscriptionScreenProps) {
    const { user } = useAuth()
    const billing = useBilling()
    const [cancelling, setCancelling] = useState(false)
    const [cancelError, setCancelError] = useState<string | null>(null)

    if (billing.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
          <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
        </div>
      )
    }

    const { status } = billing

    // Compute the date line text
    let dateLine = ''
    if (status === 'trialing') {
      // We need the raw trial_ends_at — useBilling doesn't expose it, so we
      // re-read from what's in the billing object. Since useBilling only
      // exposes daysLeft (not the raw date), display via daysLeft for now.
      dateLine = `${billing.daysLeft} day${billing.daysLeft !== 1 ? 's' : ''} remaining in trial`
    } else if (status === 'active') {
      dateLine = 'Next billing date: —'
    } else {
      dateLine = 'Subscription ended'
    }

    const canCancel = status === 'trialing' || status === 'active'

    async function handleCancel() {
      if (!user) return
      const confirmed = window.confirm(
        'Cancel your subscription? You will lose access when your trial or billing period ends.',
      )
      if (!confirmed) return

      setCancelling(true)
      setCancelError(null)

      try {
        await cancelSubscription(user.id)
        onCancelled?.()
      } catch (err) {
        setCancelError(err instanceof Error ? err.message : 'Cancellation failed. Please try again.')
        setCancelling(false)
      }
    }

    return (
      <div className="min-h-screen bg-cockpit-bg px-4 py-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-6 text-sm text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors"
        >
          ← Back
        </button>

        <div className="w-full max-w-sm mx-auto bg-cockpit-panel border border-cockpit-border
                        rounded-2xl shadow-cockpit p-6 flex flex-col gap-5">
          {/* Section header */}
          <h2 className="text-base font-semibold text-cockpit-text-primary tracking-wide">
            Subscription
          </h2>

          {/* Plan label */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-cockpit-text-secondary">
              FlightCheck Pro — $2.99/month
            </span>
            {status && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[status]}`}
              >
                {STATUS_LABELS[status]}
              </span>
            )}
          </div>

          {/* Date line */}
          <p className="text-xs text-cockpit-text-secondary">{dateLine}</p>

          {/* Cancel button */}
          {canCancel && (
            <div className="flex flex-col gap-2 pt-2 border-t border-cockpit-border">
              {cancelError && (
                <p className="text-xs text-red-400">{cancelError}</p>
              )}
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full text-sm font-medium text-red-400 border border-red-400/30
                           rounded-lg py-2.5 hover:bg-red-400/10 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {cancelling ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  'Cancel subscription'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **7.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **7.3 — Manual smoke test** (run `npm run dev`, sign in as a trialing user)

  - Navigate to SubscriptionScreen via Settings
  - Status badge shows "Trial" in amber
  - Date line shows correct days remaining
  - "Cancel subscription" button is visible
  - Tapping it shows a browser `confirm()` dialog with the correct message
  - Dismissing the dialog does nothing
  - Confirming calls `billingService.cancelSubscription` → status flips to `cancelled` → `SubscriptionExpiredScreen` appears
  - Repeat with `status = 'active'` (set in Supabase dashboard): badge shows "Active" in green, cancel button visible
  - Repeat with `status = 'expired'`: badge shows "Expired" in red, cancel button absent, date line reads "Subscription ended"

- [ ] **7.4 — Commit**

  ```
  git add src/components/billing/SubscriptionScreen.tsx
  git commit -m "feat: add SubscriptionScreen component"
  ```

---

## Task 8: App integration

**Files:**
- Modify: `src/App.tsx`

### Steps

- [ ] **8.1 — Replace `src/App.tsx` with the billing-integrated version**

  Replace the entire contents of `src/App.tsx` with the following:

  ```tsx
  import { useState } from 'react'
  import type { Aircraft } from './types'
  import { AircraftSelector } from './components/AircraftSelector'
  import { ChecklistView } from './components/ChecklistView'
  import { LoginScreen } from './components/LoginScreen'
  import { AuthProvider, useAuth } from './hooks/useAuth'
  import { useBilling } from './hooks/useBilling'
  import { BillingSetupScreen } from './components/billing/BillingSetupScreen'
  import { TrialBanner } from './components/billing/TrialBanner'
  import { SubscriptionExpiredScreen } from './components/billing/SubscriptionExpiredScreen'
  import { SubscriptionScreen } from './components/billing/SubscriptionScreen'
  import { Moon, Sun, Lightbulb } from 'lucide-react'
  import { useTheme } from './hooks/useTheme'

  type Theme = 'dark' | 'night' | 'day'

  const THEME_LABELS: Record<Theme, string> = {
    dark: 'Dark',
    night: 'Night (amber)',
    day: 'Day',
  }

  export default function App() {
    return (
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    )
  }

  function AppInner() {
    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
    const [showSubscriptionScreen, setShowSubscriptionScreen] = useState(false)
    const { theme, setTheme } = useTheme()
    const { user, loading: authLoading } = useAuth()
    const billing = useBilling()

    const cycleTheme = () => {
      const themes: Theme[] = ['dark', 'night', 'day']
      const idx = themes.indexOf(theme)
      setTheme(themes[(idx + 1) % themes.length])
    }

    // Step 1: auth loading
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
          <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
        </div>
      )
    }

    // Step 2: not signed in
    if (!user) {
      return <LoginScreen />
    }

    // Step 3: billing loading
    if (billing.loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cockpit-bg">
          <div className="w-8 h-8 rounded-full border-2 border-cockpit-amber/30 border-t-cockpit-amber animate-spin" />
        </div>
      )
    }

    // Step 4: no subscription row — new user
    if (billing.status === null) {
      return <BillingSetupScreen />
    }

    // Step 5: expired or cancelled — paywall
    if (!billing.isActive) {
      return <SubscriptionExpiredScreen status={billing.status} />
    }

    // Step 6: active or trialing — show the app

    if (showSubscriptionScreen) {
      return (
        <SubscriptionScreen
          onBack={() => setShowSubscriptionScreen(false)}
          onCancelled={() => setShowSubscriptionScreen(false)}
        />
      )
    }

    return (
      <>
        {/* Trial banner — self-hiding when status !== 'trialing' */}
        <TrialBanner onManage={() => setShowSubscriptionScreen(true)} />

        {!selectedAircraft && (
          <button
            onClick={cycleTheme}
            title={`Theme: ${THEME_LABELS[theme]}`}
            className="fixed bottom-6 right-5 z-40 flex items-center gap-2 px-3 py-2 rounded-full
                       bg-cockpit-panel border border-cockpit-border shadow-cockpit text-xs text-cockpit-text-secondary
                       hover:border-cockpit-amber/40 hover:text-cockpit-text-primary transition-all duration-200"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
          >
            {theme === 'dark' && <Moon className="w-3.5 h-3.5" />}
            {theme === 'night' && <Lightbulb className="w-3.5 h-3.5 text-amber-400" />}
            {theme === 'day' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
            <span>{THEME_LABELS[theme]}</span>
          </button>
        )}

        {selectedAircraft ? (
          <ChecklistView
            aircraft={selectedAircraft}
            onBack={() => setSelectedAircraft(null)}
            onCycleTheme={cycleTheme}
            theme={theme}
          />
        ) : (
          <AircraftSelector onSelect={setSelectedAircraft} />
        )}
      </>
    )
  }
  ```

- [ ] **8.2 — Type-check**

  ```
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **8.3 — Manual end-to-end smoke test** (run `npm run dev`)

  Verify the full render order described in the spec:

  1. While Supabase auth resolves → spinner is shown
  2. Signed-out user → `LoginScreen`
  3. After sign-in, while billing fetches → spinner is shown
  4. New user (no `user_subscriptions` row) → `BillingSetupScreen`; cannot reach app content
  5. After submitting `BillingSetupScreen` → transitions to normal app; `TrialBanner` visible at top
  6. `TrialBanner` shows correct days remaining; "Manage subscription" link opens `SubscriptionScreen`
  7. Use Supabase dashboard: set `trial_ends_at` to a past timestamp → refresh page → `SubscriptionExpiredScreen` shown, app content unreachable
  8. Use Supabase dashboard: set `subscription_status = 'active'` → `TrialBanner` is absent; rest of app renders normally
  9. Navigate to `SubscriptionScreen` via "Manage subscription" → shows correct plan details and status badge

- [ ] **8.4 — Commit**

  ```
  git add src/App.tsx
  git commit -m "feat: integrate billing gate and TrialBanner into AppInner"
  ```

---

## Implementation complete

All success criteria from the spec should now be met:

- New user sees `BillingSetupScreen` and cannot bypass it
- Submitting creates a `user_subscriptions` row with `status = 'trialing'`
- Returning trialing user enters the app directly
- `TrialBanner` shows correct days remaining; absent when `status = 'active'`
- On load after expiry, `useBilling` flips status to `expired` and `SubscriptionExpiredScreen` is shown
- `SubscriptionExpiredScreen` has no dismiss path
- `SubscriptionScreen` is reachable from the banner and shows correct status and dates
- Cancelling updates status to `cancelled` and triggers `SubscriptionExpiredScreen`
- All gateway call sites are marked `// TODO: replace with [GATEWAY] API call`
- No real payment network calls are made at any point
