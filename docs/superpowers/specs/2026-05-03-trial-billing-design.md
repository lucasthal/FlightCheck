# Trial and Billing — Design Spec

**Date:** 2026-05-03
**Scope:** 5-day free trial gate + $2.99/month subscription, with stubbed payment gateway

---

## Overview

FlightCheck gates all app access behind a subscription. New users enter a 5-day free trial before being charged. Payment information is collected at signup — a card is placed on file before the trial starts, but no charge is made for 5 days. All payment gateway calls are stubbed with clearly marked placeholders; the stubs are safe to deploy before a gateway is wired up.

---

## User Journey

1. User creates an account (email/password or Google OAuth — existing auth flow).
2. Immediately after first sign-in, before entering the app, the user sees **BillingSetupScreen**.
3. User reads the trial terms and submits the card-on-file form. This creates a `user_subscriptions` row with `status = 'trialing'` and records a stub `payment_customer_id`.
4. User is admitted to the app. A **TrialBanner** appears at the top of every screen showing days remaining.
5. On day 5 the trial ends. On next load, `useBilling` detects that `trial_ends_at < now` and updates status to `expired`.
6. Any user with `status = 'expired'` or `status = 'cancelled'` sees **SubscriptionExpiredScreen** instead of the app.
7. Users can view subscription details and cancel from **SubscriptionScreen**, accessible from Settings.

---

## Database

### New Table: `user_subscriptions`

```sql
CREATE TABLE user_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_started_at    timestamptz NOT NULL,
  trial_ends_at       timestamptz NOT NULL,  -- always trial_started_at + interval '5 days'
  subscription_status text NOT NULL,         -- 'trialing' | 'active' | 'expired' | 'cancelled'
  payment_customer_id text,                  -- nullable; populated when gateway is wired
  created_at          timestamptz DEFAULT now(),
  UNIQUE (user_id)
);
```

**Status values:**

| Value | Meaning |
|-------|---------|
| `trialing` | Trial period active; card on file but not yet charged |
| `active` | Paid subscription active |
| `expired` | Trial ended without converting to paid |
| `cancelled` | User cancelled an active subscription |

Only `trialing` and `active` are considered access-granting statuses. `expired` and `cancelled` both trigger the paywall screen.

### Row-Level Security

```sql
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription" ON user_subscriptions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Users may read and update only their own row. Inserts are performed by the client after the billing setup step.

---

## Billing Service Stub

**File:** `src/lib/billingService.ts`

Three exported async functions. Each contains a `// TODO: replace with [GATEWAY] API call` comment at the top of its body. No real network calls are made — the stubs operate entirely against the Supabase database.

### `setupPaymentMethod`

```ts
async function setupPaymentMethod(userId: string): Promise<{ customerId: string }>
```

- Stub returns `{ customerId: 'stub_customer' }` immediately.
- Caller is responsible for writing the returned `customerId` into `user_subscriptions.payment_customer_id`.
- When a real gateway is wired, this function will tokenize the card, create a customer object in the gateway, and return the resulting external customer ID.

### `getSubscriptionStatus`

```ts
async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus>
```

- Reads and returns `subscription_status` from the `user_subscriptions` row for `userId`.
- `SubscriptionStatus` is the union type `'trialing' | 'active' | 'expired' | 'cancelled'`.
- When a real gateway is wired, this function will also reconcile against the gateway's subscription state before returning.

### `cancelSubscription`

```ts
async function cancelSubscription(userId: string): Promise<void>
```

- Updates `subscription_status` to `'cancelled'` in the `user_subscriptions` row for `userId`.
- When a real gateway is wired, this function will also cancel the subscription in the gateway before writing to the database.

---

## Hook: `useBilling`

**File:** `src/hooks/useBilling.ts`

```ts
interface BillingState {
  status: SubscriptionStatus | null
  isActive: boolean
  daysLeft: number
  loading: boolean
}

function useBilling(): BillingState
```

### Behavior

**On mount (auth user present):**

1. Fetches the `user_subscriptions` row for the current user from Supabase.
2. If the row exists and `subscription_status === 'trialing'` and `trial_ends_at < Date.now()`, updates `subscription_status` to `'expired'` in Supabase before returning state. This client-side expiry check is the source of truth until a server-side cron or webhook is added at launch.
3. Sets state from the (possibly just-updated) row.

**`isActive`:**

```ts
isActive = status === 'trialing' || status === 'active'
```

**`daysLeft`:**

```ts
daysLeft = Math.max(0, Math.ceil((trial_ends_at.getTime() - Date.now()) / 86_400_000))
```

- Only meaningful when `status === 'trialing'`. When `status === 'active'` or when no trial date applies, `daysLeft` is `0`.
- Clamped to a minimum of `0` — never negative.

**`loading`:**

- `true` from mount until the Supabase fetch (and optional expiry write) completes.
- Components should not render access-gated content until `loading === false`.

**No subscription row:**

- If no row exists for the user, `status` is `null`, `isActive` is `false`, `daysLeft` is `0`.
- `App.tsx` treats a `null` status as the pre-billing-setup state and shows `BillingSetupScreen`.

---

## UI Components

All new files live under `src/components/billing/`.

### BillingSetupScreen

**File:** `src/components/billing/BillingSetupScreen.tsx`

Shown once, immediately after the user's first authenticated session, before the app is entered. Displayed whenever `useBilling().status === null` (no `user_subscriptions` row exists). Cannot be dismissed — the user must complete the form to proceed.

**Layout:** Centered card on a full-page cockpit-themed background, matching the LoginScreen aesthetic.

**Content:**

- App name and tagline at the top of the card
- Pricing callout: "$2.99/month — 5-day free trial"
- Trial end date displayed as a formatted date (e.g. "Your trial ends on May 8, 2026"), computed from `now + 5 days`
- Card input section: a single disabled text input with placeholder text "Payment setup coming soon" and a subtext line "Your card will be charged after your trial ends." This input accepts no user input until a gateway is wired.
- Primary CTA button: "Start Free Trial"

**On submit:**

1. Calls `billingService.setupPaymentMethod(userId)` → receives `{ customerId }`.
2. Inserts a row into `user_subscriptions`:
   - `user_id`: current user's ID
   - `trial_started_at`: `now()`
   - `trial_ends_at`: `now() + 5 days`
   - `subscription_status`: `'trialing'`
   - `payment_customer_id`: the returned `customerId` (stub: `'stub_customer'`)
3. `useBilling()` detects the new row on re-render and returns `status = 'trialing'`.
4. `App.tsx` transitions to the normal app flow.

**Loading state:** Button shows a spinner during the async sequence; the form is non-interactive while loading.

**Error state:** If the Supabase insert fails, an inline error message appears below the button. The button re-enables.

---

### TrialBanner

**File:** `src/components/billing/TrialBanner.tsx`

A thin, non-dismissible banner rendered at the top of the main app layout when `status === 'trialing'`. Not shown when `status === 'active'`.

**Content:**

- Left-aligned: "X days left in your free trial" where X is `daysLeft` from `useBilling()`
- Right-aligned: "Manage subscription" — a tappable link that opens `SubscriptionScreen`

**Sizing:** One text row, minimal vertical padding. Uses the app's warning/amber token so it is visually distinct from navigation chrome without being alarming.

---

### SubscriptionExpiredScreen

**File:** `src/components/billing/SubscriptionExpiredScreen.tsx`

Full-screen overlay shown when `useBilling().isActive === false` and `loading === false`. Covers the entire viewport; there is no way to dismiss it or access the app behind it.

**Content:**

- Heading: "Your trial has ended" (when `status === 'expired'`) or "Your subscription is cancelled" (when `status === 'cancelled'`)
- Plan summary: "FlightCheck — $2.99/month"
- Primary CTA button: "Subscribe for $2.99/month" — currently renders as a disabled button with label "Coming soon" until gateway is wired
- Secondary link: "Contact support" — `mailto:lucas.b.thal@gmail.com`

**No sign-out prompt.** The user remains authenticated. This keeps their data intact and allows them to resume immediately once a subscription is reactivated.

---

### SubscriptionScreen

**File:** `src/components/billing/SubscriptionScreen.tsx`

Accessible from the Settings panel (existing settings entry point). Displayed as a standard settings sub-screen.

**Content:**

- Section header: "Subscription"
- Current plan label: "FlightCheck Pro — $2.99/month"
- Status badge: one of "Trial", "Active", "Expired", "Cancelled" — styled with appropriate color tokens (amber for trial, green for active, red for expired/cancelled)
- Date line:
  - When `status === 'trialing'`: "Trial ends [formatted trial_ends_at]"
  - When `status === 'active'`: "Next billing date: [date]" (value is `null` until gateway is wired; display "—" in that case)
  - When `status === 'expired'` or `'cancelled'`: "Subscription ended"
- "Cancel subscription" button — visible only when `status === 'trialing'` or `status === 'active'`
  - On tap: confirmation alert "Cancel your subscription? You will lose access when your trial or billing period ends." with "Cancel subscription" (destructive) and "Keep subscription" options
  - On confirm: calls `billingService.cancelSubscription(userId)` → `useBilling()` refetches → status updates to `'cancelled'`
  - Button shows spinner during async call; re-enables on error with an inline error message

---

## App Integration

### `App.tsx` / `AppInner`

The billing gate is inserted after the existing auth check and before any other app content is rendered.

**Render order:**

```
1. useAuth().loading === true        → loading spinner
2. useAuth().user === null           → LoginScreen
3. useBilling().loading === true     → loading spinner (same indicator as step 1)
4. useBilling().status === null      → BillingSetupScreen
5. useBilling().isActive === false   → SubscriptionExpiredScreen
6. otherwise                         → normal app layout
```

**Normal app layout** wraps the existing content tree with `TrialBanner` at the top. `TrialBanner` is self-hiding when `status !== 'trialing'`, so no conditional is needed at the layout level.

**Hook placement:** `useBilling()` is called inside `AppInner` (the component that renders only when a user is present), not at the root, so it only runs after auth is resolved.

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `src/lib/billingService.ts` | Stubbed payment gateway functions |
| `src/hooks/useBilling.ts` | Subscription state, trial expiry logic |
| `src/components/billing/BillingSetupScreen.tsx` | Card-on-file + trial start screen |
| `src/components/billing/TrialBanner.tsx` | Thin in-app trial countdown banner |
| `src/components/billing/SubscriptionExpiredScreen.tsx` | Full-screen paywall for expired/cancelled |
| `src/components/billing/SubscriptionScreen.tsx` | Settings sub-screen for subscription management |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add billing gate (steps 3–5) and `TrialBanner` to app layout |

---

## What Is Not Built

- Real payment gateway calls — all network calls are stubbed
- Webhooks (Stripe/Paddle/RevenueCat) — not needed until launch
- Server-side trial expiry cron — expiry is detected client-side on load
- Invoice or payment history UI
- Plan upgrades — there is exactly one plan

---

## Success Criteria

- [ ] New user sees BillingSetupScreen after first sign-in and cannot proceed without submitting
- [ ] Submitting BillingSetupScreen creates a `user_subscriptions` row with `status = 'trialing'`
- [ ] Returning user with an active trial enters the app directly without seeing BillingSetupScreen again
- [ ] TrialBanner shows correct days remaining throughout the trial
- [ ] TrialBanner is absent when status is `active`
- [ ] On load after trial expiry, `useBilling` updates status to `expired` and SubscriptionExpiredScreen is shown
- [ ] SubscriptionExpiredScreen has no dismiss path; the app content is not accessible behind it
- [ ] SubscriptionScreen is accessible from Settings and shows correct status and dates
- [ ] Cancelling from SubscriptionScreen updates status to `cancelled` and triggers SubscriptionExpiredScreen
- [ ] All payment gateway call sites are clearly marked with `// TODO: replace with [GATEWAY] API call`
- [ ] No real payment calls are made at any point — safe to deploy before gateway integration
