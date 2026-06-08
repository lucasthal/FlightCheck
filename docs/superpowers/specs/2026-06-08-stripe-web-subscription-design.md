# Stripe Web Subscription + Cross-Platform Entitlement — Design

**Date:** 2026-06-08
**Status:** Approved, ready for implementation planning
**Project:** FlightCheck (lucasthal/FlightCheck)

## Goal

Add a paid subscription to the web app via Stripe, unified with the existing iOS App Store subscription through RevenueCat. A single subscription source-of-truth means a user who pays on one platform gets full access on the other without re-paying.

## Context

- **iOS app**: currently in App Store Review with hard wall + free trial via Apple's introductory offer; StoreKit subscription configured in App Store Connect.
- **Web app**: deployed to Netlify, currently free for any authenticated user — this is the leak this design closes.
- **Backend**: Supabase Auth + Postgres; row-level security policies gate per-user data.
- **Identity**: every user has a Supabase `user_id` UUID; same UUID resolves across all platforms when the user signs in with the same email / Apple ID / Google account.
- **Custom domain**: `flightcheckapp.com` owned, DNS unconfigured; web is at `*.netlify.app` for now.
- **No Android yet** — Google Play Billing is out of scope; will plug in later via the same architecture.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Hard wall + trial on web | Matches iOS pattern; cleanest cross-platform story |
| 2 | Cross-platform entitlement unified from day 1 | A user paying on iOS who visits the web (or vice versa) gets instant access; no awkward "subscribe again" surprise |
| 3 | Card upfront, 7-day free trial via Stripe | Matches iOS intro offer pattern; ~40-50% trial-to-paid conversion |
| 4 | Match iOS pricing exactly | Single price across all platforms; no anti-steering grey areas; cleanest marketing message |
| 5 | Stripe Checkout + Stripe Customer Portal (both hosted) | Minimal code, no PCI burden, Apple/Google Pay built-in, less branding control accepted |
| 6 | iOS shows "Subscribed via Web" in Settings (text only, no tap-to-open URL) | Transparent and helpful; informational only stays clear of Apple anti-steering rules |
| 7 | RevenueCat for entitlement orchestration | Saves ~5 days of Apple App Store Server API + ASSN V2 plumbing; free up to $10k MTR; we can migrate off later if revenue dictates |

## Architecture

```
                  ┌──────────────────────────────────┐
                  │   RevenueCat (entitlement SOT)   │
                  └───────┬──────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  ┌──────────┐    ┌──────────────┐    ┌──────────────┐
  │  Stripe  │    │  App Store   │    │ Clients      │
  │  Checkout│    │  StoreKit +  │    │ - Web app    │
  │  (web)   │    │  ASSN V2     │    │ - iOS app    │
  │          │    │  (iOS)       │    │              │
  └────┬─────┘    └──────┬───────┘    └──────┬───────┘
       │ webhook         │ webhook           │ RC SDK
       └────────RC ingests both──────────────┘


  Identity unification:
    Supabase Auth user_id  ──used as──>  RevenueCat app_user_id
```

### Pieces

- **Supabase Auth** stays the identity source of truth. Unchanged.
- **RevenueCat** holds entitlement state. Single entitlement called `premium`. Any user with `premium = active` has full access.
- **Stripe** is configured *in the RevenueCat dashboard*, not directly in our app. RC owns Stripe's webhook endpoint and ingests its events.
- **App Store** is configured similarly — RC owns the App Store Server Notifications V2 webhook and handles receipt validation.
- **iOS app + Web app** each install a RevenueCat SDK. After Supabase Auth signs the user in, the app calls `Purchases.logIn(user_id)` so RC knows who this user is. From then on, both clients query `getCustomerInfo()` for entitlement state.

### What we don't need

- No `entitlements` table in Supabase (RevenueCat is the source of truth)
- No Apple receipt validation code on our side
- No webhook handlers in Supabase Edge Functions
- No App Store Server API integration on our side

### Gating model: client-side, defense-in-depth optional

The lightest approach is purely client-side: UI hides paywalled content when `getCustomerInfo()` returns no active entitlement. Determined bypass via DevTools/IPA editing only exposes the same checklist data that's identical for all users — Supabase RLS still protects per-user data. Sufficient for v1.

Optional future hardening: a single RevenueCat → Supabase webhook that mirrors entitlement state into `user_metadata.is_subscribed`, queryable from RLS policies. Out of scope for v1.

## User flows

### Flow A — New user signs up on web, subscribes via Stripe

```
1. User lands on web app
2. Clicks "Sign up" → Supabase Auth creates account → user_id assigned
3. After sign-in, app calls Purchases.logIn(user_id)
4. RC knows this user but has no entitlement
5. UI shows paywall: "7-day free trial, $X/mo after"
6. User clicks "Start free trial"
7. RC SDK returns Stripe Checkout URL → browser redirects to checkout.stripe.com
8. User enters card details, confirms
9. Stripe sends webhook to RC (customer.subscription.created with trial)
10. RC marks entitlement "premium" active with trial end date
11. Stripe redirects back to web app with ?rc_checkout=success
12. RC SDK auto-refetches customerInfo → entitlement active → paywall disappears
13. (Day 8) Stripe auto-charges card → RC entitlement remains active
```

### Flow B — Existing iOS subscriber visits web

```
1. iOS sub from earlier; iOS app already called Purchases.logIn(user_id)
   → RC has entitlement linked to user_id
2. User opens web app for the first time
3. Signs in with same email/Apple ID/Google → Supabase resolves to same user_id
4. Web app calls Purchases.logIn(user_id)
5. RC SDK returns: user already has entitlement → active
6. UI unlocks immediately, no paywall
7. Optional banner: "Subscribed via iOS App Store"
```

### Flow C — New user signs up on iOS, subscribes via StoreKit

```
1. User installs iOS app from App Store
2. Signs up via Supabase Auth → user_id assigned
3. iOS app calls Purchases.logIn(user_id)
4. UI shows paywall (rendered against StoreKit prices)
5. User taps "Start free trial"
6. StoreKit purchase flow → confirm with Face ID
7. Purchase completes → SDK sends receipt to RevenueCat
8. RC validates with App Store Server API → marks entitlement active
9. UI unlocks
10. Apple sends ASSN V2 webhook events for renewals/cancellations → RC ingests
```

### Flow D — Existing web subscriber downloads iOS app

```
1. User subscribed on web earlier; RC has entitlement linked to user_id
2. User downloads iOS app
3. Signs in with same email → same Supabase user_id
4. iOS app calls Purchases.logIn(user_id)
5. RC SDK returns: existing entitlement (from Stripe) → active
6. iOS app hides StoreKit paywall, unlocks UI
7. Settings tab shows "Subscribed via Web" (informational text, no URL link
   per Decision #6)
```

### Edge cases

- **Trial expiring without conversion (web)**: Stripe sends `customer.subscription.deleted` → RC marks inactive → next `getCustomerInfo()` returns no active → UI gates again. User can re-subscribe via Stripe Checkout.
- **Trial expiring without conversion (iOS)**: App Store sends `EXPIRED` → RC marks inactive → same gating behavior.
- **Card declines on renewal (web)**: Stripe smart retry (4 attempts over 14 days). Status `past_due` but entitlement stays active during configured grace. Final failure → `customer.subscription.deleted`.
- **Refund (either platform)**: webhook event arrives → RC marks inactive immediately → UI re-gates on next check.
- **Family Sharing (iOS)**: enabled on the subscription in App Store Connect → RC handles it. One subscription serves a household, which is usually what families want.
- **Account collision (different sign-in methods/emails)**: treated as separate users. Each subscribes independently. No automatic linking. Account-linking UI deferred to post-launch.

## Web app changes

### New dependencies

```
npm install @revenuecat/purchases-js
```

### New files

**`src/lib/revenuecat.ts`** — SDK init with platform detection (≈30 lines combined with iOS path; see iOS section)

**`src/hooks/useEntitlement.tsx`** — React hook (≈50 lines)
- Fetches `getCustomerInfo()` on mount + on user change
- Subscribes to RC's customer-info updates (RC SDK emits these when entitlement state changes, e.g., after a checkout return)
- Returns `{ isEntitled, isLoading, trialEndsAt, source }` where `source` is `'stripe' | 'apple' | 'google' | null`

**`src/components/Paywall.tsx`** — full-screen paywall (≈100 lines)
- Renders when `useEntitlement().isEntitled === false`
- Shows pricing, "7-day free trial" copy, single CTA "Start free trial"
- On CTA click: calls `Purchases.purchasePackage(...)` → SDK returns Stripe Checkout URL → `window.location.href = url`
- Bottom: "Already subscribed on iOS? Sign in here." — clarifies the cross-platform model

### Modified files

**`src/hooks/useAuth.tsx`** — wire RC into auth lifecycle
- On `onAuthStateChange` with a user → call `initRevenueCat(user.id)`
- On sign-out → call `Purchases.logOut()` for clean slate

**`src/App.tsx`** (or top-level routing) — gate behind entitlement
- After auth resolves, check `useEntitlement().isEntitled`
- `false` → render `<Paywall />`
- `true` → render existing `<AppInner />`
- Loading → spinner

**`src/components/SettingsSheet.tsx`** — add "Manage subscription" row
- Calls RC SDK to get Customer Portal URL for current user
- Opens in new tab
- Only visible when entitlement `source === 'stripe'`
- Apple-source users go through iOS Settings → Apple ID → Subscriptions instead

### Environment vars

- `VITE_REVENUECAT_WEB_KEY` (new) — RevenueCat web SDK public key
- `VITE_REVENUECAT_IOS_KEY` (new) — RevenueCat iOS SDK public key
- Added to: `.env.example` (placeholders), Netlify env settings (real), GitHub Actions secrets (real)

### Stripe Checkout redirect

Stripe redirects back to:
```
https://flightcheck.netlify.app/?rc_checkout=success
https://flightcheck.netlify.app/?rc_checkout=cancelled
```

RC SDK auto-refetches `customerInfo` on page load with these params. Our `useEntitlement` hook subscribes to updates and re-renders. No custom redirect-handler code needed.

### Estimated work

| Piece | Hours |
|---|---|
| SDK install + init wrapper | 1 |
| `useEntitlement` hook | 3 |
| Paywall UI (cockpit aesthetic) | 4 |
| Auth lifecycle wiring | 1 |
| Settings: Customer Portal link | 1 |
| Stripe test mode testing | 3 |
| **Web total** | **~1.5 days** |

## iOS app changes

### The platform split

Same React/TS codebase, two different RevenueCat SDKs depending on runtime:

| Platform | SDK | Purchase flow |
|---|---|---|
| Web | `@revenuecat/purchases-js` | Stripe Checkout redirect |
| iOS (Capacitor) | `@revenuecat/purchases-capacitor` | Native StoreKit sheet via RC's iOS native SDK |

Detect platform once and route through a thin wrapper so the rest of the app calls a unified API.

### New dependencies

```
npm install @revenuecat/purchases-capacitor
npx cap sync ios
```

`cap sync` auto-adds RC's native iOS Purchases pod to the Podfile. CI workflow (`build-ios.yml`) already runs `pod install` so no workflow changes needed.

### Platform-aware SDK init

**`src/lib/revenuecat.ts`** extends to detect platform:
```ts
import { Capacitor } from '@capacitor/core'

export async function initRevenueCat(userId: string) {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    await Purchases.configure({
      apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY,
      appUserID: userId,
    })
  } else {
    const Purchases = (await import('@revenuecat/purchases-js')).default
    Purchases.configure(import.meta.env.VITE_REVENUECAT_WEB_KEY, userId)
  }
}
```

Dynamic imports keep the web bundle small (doesn't ship the Capacitor SDK) and vice versa.

### Paywall behavior differs under the hood

Same `<Paywall />` React component, different `startCheckout()` behavior:
- Web: returns Stripe Checkout URL → redirect
- iOS: presents StoreKit sheet directly → user confirms with Face ID → SDK callback

Wrapper function hides the difference from the React component.

### Settings UI: source-aware messaging

```
source === 'apple':
  "Subscribed via App Store"
  "Manage in Settings → Apple ID → Subscriptions"
  (text only; deep-linking to iOS Settings is OK)

source === 'stripe':
  "Subscribed via Web"
  "Manage your subscription at flightcheckapp.com"
  (informational text only — NO clickable URL on iOS per Decision #6)

source === null:
  no row shown (user is unsubscribed)
```

On web, the Stripe-source row gets a clickable "Manage subscription" button → Customer Portal URL (covered in Web changes).

### Coordination with App Store Review

The currently-in-review iOS build does NOT have RevenueCat. All iOS changes here ship in a v1.1 follow-up submission:

1. Current review (v1.0) approves → app live with iOS-only paywall
2. Build, test, submit v1.1 with RevenueCat integration
3. Apple reviews v1.1 (typically 24-48h)
4. v1.1 goes live → cross-platform entitlement now working

If web subscriptions go live *before* iOS v1.1 ships, there's an awkward window where iOS-only subscribers visiting the web have to pay again, and web subscribers downloading iOS see the iOS paywall. Mitigation: coordinate launch timing (see Launch Sequence below).

### What does NOT change on iOS

- `capacitor.config.ts`
- Auth flow (`useAuth.tsx` already wires RC `logIn` regardless of platform)
- `ios/App/App/Info.plist` (StoreKit IAP entitlement already set up since iOS subscription is configured)
- `build-ios.yml` workflow

### Estimated work

| Piece | Hours |
|---|---|
| SDK install + platform wrapper | 2 |
| App Store Connect ↔ RevenueCat config (one-time) | 1 |
| Settings UI source-aware messaging | 2 |
| Sandbox testing via TestFlight | 4 |
| **iOS dev work** | **~1 day** |
| **+ App Store review wait** | **24-48h external** |

## Testing, manual steps, and launch sequence

### Testing strategy

**Web (Stripe test mode)** — separate from live mode forever; test cards from stripe.com/docs/testing.

Test scenarios:
- New signup → start trial → entitlement active
- Trial countdown ("advance the clock" in Stripe test mode)
- Trial ends + auto-charge succeeds → entitlement remains
- Trial ends + auto-charge fails → past_due → eventually deleted
- User cancels in Customer Portal → active until period end → expires
- Refund issued → entitlement immediately revoked

**iOS (StoreKit sandbox)** — sandbox testers from App Store Connect → Users and Access → Sandbox Testers. Sandbox subscriptions accelerate (1 month = 5 minutes; 7-day trial ≈ 3 minutes).

Test scenarios:
- New signup → start trial → entitlement active
- Sign out + sign in with different account → entitlement scoped correctly
- Cancel in Settings → Apple ID → expires at period end
- Refund from App Store Connect → ASSN webhook → entitlement revoked

**Cross-platform**
- Same Supabase user across both platforms
- iOS subscribe → sign in on web with same email → entitlement active on web, `source = 'apple'`
- Web subscribe (test mode) → sign in on iOS TestFlight with same email → entitlement active on iOS, `source = 'stripe'`
- Both should hide paywall appropriately

### Manual steps (user, not code)

**Stripe account (1-2 days)**
1. Sign up at stripe.com (~10 min)
2. Submit business info (tax ID, address, bank for payouts)
3. Wait for activation (24-48h typical)
4. Meanwhile: create products + prices in test mode (carries over)

**RevenueCat account (~30 min)**
1. Sign up at app.revenuecat.com (free up to $10k MTR)
2. Create project "FlightCheck"
3. Add Stripe integration: paste Stripe API key — RC creates webhook in Stripe automatically
4. Add App Store integration: upload App Store Connect API key (P8 file), bundle ID
5. Entitlements tab: create `premium`
6. Products tab: one product per platform, link each to its store SKU
7. Offerings tab: create "default" offering containing both products
8. Copy SDK keys (one for web, one for iOS) to env vars

**App Store Connect**
- No new subscription SKU — use existing one
- Create at least 1 sandbox tester under Users and Access → Sandbox Testers

**Stripe Tax (optional but recommended)**
- Enable Stripe Tax in Stripe dashboard
- Stripe handles VAT/sales tax automatically at checkout
- Adds ~0.5% fee but solves the multi-jurisdiction tax compliance problem

### Launch sequence

```
Day 0 (today)       Brainstorm complete, spec written
Day 0-1             Stripe + RevenueCat accounts, env vars added
Day 1-3             Build web side, test in Stripe test mode
Day 3-4             Build iOS side (RC SDK + Settings UI)
Day 4               Sandbox test iOS via TestFlight
Day 4-5             Submit iOS v1.1 to App Store
Day 5-7             Apple review (24-48h)
Day 7 (estimated)   ── LAUNCH ───
                    Flip Stripe to live mode
                    Web subscription goes live
                    iOS v1.1 goes live
                    Both surfaces share entitlement from day 1
```

Add 1-2 days buffer for the inevitable "wait, this edge case…"

### Monitoring (built in)

- **RevenueCat dashboard** — real-time subscribers across both platforms, MRR, churn, trial-to-paid conversion
- **Stripe dashboard** — web subscribers, payment failures, disputes
- **App Store Connect** — iOS subscribers, refunds, sandbox testing logs
- **RC webhook health** — alerts via email if RC's connection to Stripe or App Store starts failing

## Out of scope (deferred)

- **Android subscription** via Google Play Billing — plug into RevenueCat once Play Console account + closed testing rule are sorted
- **Annual subscription option** — monthly only at launch; annual at a discount is an easy add later
- **Promo / discount codes** — Stripe supports natively, add when needed for a launch campaign
- **Account linking UI** — for users who signed up with different emails on iOS vs web
- **Localized pricing** — RC supports per-region; defer to post-launch
- **Server-side entitlement enforcement** via Supabase RLS — a RC → Supabase webhook mirroring entitlement to `user_metadata.is_subscribed`, queryable from RLS policies; defense-in-depth, not required for v1
- **Custom domain `flightcheckapp.com`** — DNS work is separate and unblocks moving Stripe Checkout return URLs off `*.netlify.app`

## Open questions for implementation

1. **iOS subscription price** — need exact value to mirror in Stripe (will be picked up during the writing-plans phase)
2. **iOS subscription duration** — monthly only? matches the 7-day trial decision
3. **Stripe business type** — sole proprietor vs LLC affects payout/tax setup. Independent of code; can decide during Stripe signup

## Implementation plan reference

A task-by-task implementation plan will be created next at:
`docs/superpowers/plans/2026-06-08-stripe-web-subscription.md`
