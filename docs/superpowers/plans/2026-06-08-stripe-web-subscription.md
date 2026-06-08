# Stripe Web Subscription + Cross-Platform Entitlement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a paid web subscription via Stripe Checkout, unified with the existing iOS App Store subscription through RevenueCat, so users who subscribe on one platform get full access on the other without re-paying.

**Architecture:** RevenueCat is the entitlement source-of-truth. Both web (via `@revenuecat/purchases-js` + Stripe) and iOS (via `@revenuecat/purchases-capacitor` + StoreKit) use Supabase `user_id` as RevenueCat's `app_user_id` to keep identity unified. Clients query `getCustomerInfo()` for entitlement state; UI gates accordingly.

**Tech Stack:** Vite + React + TypeScript + Capacitor 8 + Supabase Auth/Postgres + RevenueCat (web + Capacitor SDKs) + Stripe Checkout + Stripe Customer Portal. iOS native uses StoreKit (already configured in App Store Connect).

**Spec:** `docs/superpowers/specs/2026-06-08-stripe-web-subscription-design.md`

---

## File structure

### New files

| Path | Responsibility |
|---|---|
| `src/lib/revenuecat.ts` | Platform-aware SDK init + thin wrappers (`initRevenueCat`, `logOutRevenueCat`, `getCurrentEntitlement`, `startCheckout`) |
| `src/hooks/useEntitlement.tsx` | React hook exposing `{ isEntitled, isLoading, trialEndsAt, source }` based on RC customerInfo; subscribes to RC updates |
| `src/components/Paywall.tsx` | Full-screen paywall component matching cockpit aesthetic; CTA wraps `startCheckout` |

### Modified files

| Path | Change |
|---|---|
| `package.json` | Add `@revenuecat/purchases-js`, `@revenuecat/purchases-capacitor` |
| `.env.example` | Add `VITE_REVENUECAT_WEB_KEY`, `VITE_REVENUECAT_IOS_KEY` placeholders |
| `src/vite-env.d.ts` | Type declarations for new env vars |
| `src/hooks/useAuth.tsx` | Call `initRevenueCat(user.id)` on sign-in, `logOutRevenueCat()` on sign-out |
| `src/App.tsx` (or wherever post-auth routing lives) | Gate behind `useEntitlement` |
| `src/components/SettingsSheet.tsx` | Add source-aware subscription management row |
| `ios/App/Podfile.lock` | Auto-updated by `cap sync ios` |

---

## Task 0: Manual prerequisites (blocks everything else)

**Files:** N/A — Stripe Dashboard, RevenueCat Dashboard, Netlify Dashboard, GitHub repo settings

- [ ] **Step 1: Create Stripe account**
  - Sign up at https://stripe.com
  - Submit business info (tax ID, address, bank for payouts)
  - Wait for activation (24-48h)
  - In test mode, create a Product named "FlightCheck Premium" with a recurring price matching your iOS subscription. Note the Price ID (`price_xxx`).

- [ ] **Step 2: Create RevenueCat account + project**
  - Sign up at https://app.revenuecat.com (free)
  - Create project "FlightCheck"
  - Apps section → add two apps:
    - **iOS app** — bundle ID `com.flightcheck.app`, upload App Store Connect API key (P8)
    - **Stripe app** — paste Stripe API key (RC will create the webhook in Stripe automatically)
  - **Entitlements** → create `premium`
  - **Products** → add iOS subscription product ID + Stripe Price ID, both linked to `premium`
  - **Offerings** → create `default` offering containing both products

- [ ] **Step 3: Copy SDK API keys**
  - From RC dashboard → Project Settings → API keys
  - Copy the **iOS public key** and the **web (Stripe) public key**

- [ ] **Step 4: Add env vars locally**
  - `.env.local`:
    ```
    VITE_REVENUECAT_WEB_KEY=<web public key>
    VITE_REVENUECAT_IOS_KEY=<ios public key>
    ```

- [ ] **Step 5: Add env vars to Netlify**
  - Netlify Dashboard → FlightCheck site → Site configuration → Environment variables
  - Add both keys
  - (These deploy to the web app — Netlify rebuilds will use them)

- [ ] **Step 6: Add env vars to GitHub Actions secrets**
  - GitHub repo → Settings → Secrets and variables → Actions
  - Add both as repository secrets
  - Update `.github/workflows/build-ios.yml` and `build-android.yml` to inject them (handled in a later task)

- [ ] **Step 7: Decide iOS subscription price + duration**
  - These are the open questions from the spec
  - Whatever you set in App Store Connect must match what you create in Stripe (Decision #4: match exactly)

**Verification:** RC dashboard shows both apps configured, `premium` entitlement defined, `default` offering contains both products. `.env.local` populated.

**Commit:** none yet — no code changes in Task 0.

---

## Task 1: Install RevenueCat SDKs

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `ios/App/Podfile.lock` (auto)
- Modify: `.env.example`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Install web SDK**

```bash
cd C:/Users/Louie/.local/bin/PilotChecklist
npm install @revenuecat/purchases-js
```

Expected: package added to dependencies, no errors.

- [ ] **Step 2: Install Capacitor SDK**

```bash
npm install @revenuecat/purchases-capacitor
```

Expected: package added, no errors.

- [ ] **Step 3: Sync to iOS**

```bash
npx cap sync ios
```

Expected: "✔ Sync finished in Xs". `ios/App/Podfile.lock` will show new pod entries for `PurchasesHybridCommon` and `RevenueCat`.

- [ ] **Step 4: Update `.env.example`**

Add to existing file:
```
VITE_REVENUECAT_WEB_KEY=your-revenuecat-web-public-key
VITE_REVENUECAT_IOS_KEY=your-revenuecat-ios-public-key
```

- [ ] **Step 5: Update `src/vite-env.d.ts`**

Read current contents first. Then add to the `ImportMetaEnv` interface:
```ts
interface ImportMetaEnv {
  // ...existing entries...
  readonly VITE_REVENUECAT_WEB_KEY: string
  readonly VITE_REVENUECAT_IOS_KEY: string
}
```

- [ ] **Step 6: Verify build still compiles**

```bash
npx tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json ios/App/Podfile.lock .env.example src/vite-env.d.ts
git commit -m "$(cat <<'EOF'
feat(subs): install RevenueCat SDKs for web + Capacitor

Adds @revenuecat/purchases-js for web (Stripe-backed) and
@revenuecat/purchases-capacitor for iOS (StoreKit-backed). cap sync
ios pulls the native PurchasesHybridCommon + RevenueCat pods into
the iOS project. Adds VITE_REVENUECAT_WEB_KEY and
VITE_REVENUECAT_IOS_KEY to env type declarations and .env.example.

Part of: docs/superpowers/specs/2026-06-08-stripe-web-subscription-design.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create platform-aware RevenueCat wrapper

**Files:**
- Create: `src/lib/revenuecat.ts`

- [ ] **Step 1: Create `src/lib/revenuecat.ts`**

```ts
import { Capacitor } from '@capacitor/core'

let initialized = false

/**
 * Initialize RevenueCat with the current Supabase user_id. Idempotent: if
 * already initialized, switches identity to the new user_id.
 *
 * Web path uses @revenuecat/purchases-js (Stripe-backed checkout).
 * Native (iOS) path uses @revenuecat/purchases-capacitor → native StoreKit.
 */
export async function initRevenueCat(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    if (initialized) {
      await Purchases.logIn({ appUserID: userId })
    } else {
      await Purchases.configure({
        apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY,
        appUserID: userId,
      })
      initialized = true
    }
  } else {
    const Purchases = (await import('@revenuecat/purchases-js')).default
    if (initialized) {
      await Purchases.getSharedInstance().changeUser(userId)
    } else {
      Purchases.configure(import.meta.env.VITE_REVENUECAT_WEB_KEY, userId)
      initialized = true
    }
  }
}

/**
 * Logs the current user out of RevenueCat. Call on Supabase signOut so the
 * next user gets a clean slate.
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!initialized) return
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    await Purchases.logOut()
  } else {
    const Purchases = (await import('@revenuecat/purchases-js')).default
    await Purchases.getSharedInstance().logOut()
  }
}

/**
 * Returns the active entitlement source for the current user, or null if
 * no active entitlement.
 */
export type EntitlementSource = 'stripe' | 'apple' | 'google' | null

export interface EntitlementState {
  isEntitled: boolean
  source: EntitlementSource
  trialEndsAt: Date | null
}

export async function getCurrentEntitlement(): Promise<EntitlementState> {
  if (!initialized) {
    return { isEntitled: false, source: null, trialEndsAt: null }
  }
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const info = await Purchases.getCustomerInfo()
    return parseEntitlement(info.customerInfo)
  } else {
    const Purchases = (await import('@revenuecat/purchases-js')).default
    const info = await Purchases.getSharedInstance().getCustomerInfo()
    return parseEntitlement(info)
  }
}

/**
 * Initiates checkout for the "premium" entitlement on the current platform.
 * On web, this returns a Stripe Checkout URL (caller redirects the browser).
 * On iOS, this presents the native StoreKit sheet.
 */
export async function startCheckout(): Promise<{ checkoutUrl?: string }> {
  if (Capacitor.isNativePlatform()) {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const offerings = await Purchases.getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) throw new Error('No subscription package available')
    await Purchases.purchasePackage({ aPackage: pkg })
    return {}
  } else {
    const Purchases = (await import('@revenuecat/purchases-js')).default
    const offerings = await Purchases.getSharedInstance().getOfferings()
    const pkg = offerings.current?.availablePackages[0]
    if (!pkg) throw new Error('No subscription package available')
    const result = await Purchases.getSharedInstance().purchase({ rcPackage: pkg })
    return { checkoutUrl: result.redirectURL }
  }
}

function parseEntitlement(customerInfo: any): EntitlementState {
  const ent = customerInfo?.entitlements?.active?.premium
  if (!ent) return { isEntitled: false, source: null, trialEndsAt: null }
  const store = ent.store?.toLowerCase()
  const source: EntitlementSource =
    store === 'app_store' ? 'apple'
    : store === 'play_store' ? 'google'
    : store === 'stripe' ? 'stripe'
    : null
  const trialEndsAt =
    ent.periodType?.toLowerCase() === 'trial' && ent.expirationDate
      ? new Date(ent.expirationDate)
      : null
  return { isEntitled: true, source, trialEndsAt }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output. If there are type errors from the RC SDK types not perfectly aligning with `any`, add minimal type assertions inside `parseEntitlement` only.

- [ ] **Step 3: Commit**

```bash
git add src/lib/revenuecat.ts
git commit -m "$(cat <<'EOF'
feat(subs): add platform-aware RevenueCat wrapper

src/lib/revenuecat.ts exposes initRevenueCat, logOutRevenueCat,
getCurrentEntitlement, and startCheckout. Dynamic imports keep web
and iOS bundles separate. Returns a normalized EntitlementState
{isEntitled, source, trialEndsAt} used by the rest of the app.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire RevenueCat into useAuth lifecycle

**Files:**
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Read current useAuth.tsx**

Confirm structure of `onAuthStateChange` handler and `signOut` function.

- [ ] **Step 2: Import the wrappers**

Add to imports at top of file:
```ts
import { initRevenueCat, logOutRevenueCat } from '../lib/revenuecat'
```

- [ ] **Step 3: Initialize RC on sign-in**

In the existing `onAuthStateChange` callback, after `setUser(session?.user ?? null)`:
```ts
if (session?.user) {
  initRevenueCat(session.user.id).catch(err =>
    console.error('[RC] init failed', err),
  )
}
```

The `.catch` is intentional — we don't want to block auth state if RC init fails (could be a transient network issue). The app will still show the paywall (entitlement defaults to false) and retry next session.

- [ ] **Step 4: Logout RC on sign-out**

Modify the existing `signOut` function:
```ts
const signOut = async () => {
  await logOutRevenueCat().catch(err => console.error('[RC] logout failed', err))
  await supabase.auth.signOut()
}
```

Order matters: log out of RC before Supabase signOut so the user_id is still in context.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "$(cat <<'EOF'
feat(subs): wire RevenueCat into useAuth lifecycle

Call initRevenueCat(user.id) on every auth state change with a
signed-in user; call logOutRevenueCat() before Supabase signOut so
the user_id is still in scope. Failures in RC ops are logged but
non-blocking — the UI will default to showing the paywall if RC
state is unknown, which is the safe default.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create useEntitlement hook

**Files:**
- Create: `src/hooks/useEntitlement.tsx`

- [ ] **Step 1: Create the hook**

```tsx
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  getCurrentEntitlement,
  type EntitlementState,
  type EntitlementSource,
} from '../lib/revenuecat'
import { useAuth } from './useAuth'

interface UseEntitlementResult {
  isEntitled: boolean
  isLoading: boolean
  trialEndsAt: Date | null
  source: EntitlementSource
  refresh: () => Promise<void>
}

const INITIAL: EntitlementState = {
  isEntitled: false,
  source: null,
  trialEndsAt: null,
}

/**
 * Returns the current user's entitlement state from RevenueCat. Refetches on
 * user change and when the page is shown after returning from Stripe Checkout
 * (visibility change). Exposes a manual refresh for components that need to
 * force-refresh after an in-app action.
 */
export function useEntitlement(): UseEntitlementResult {
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<EntitlementState>(INITIAL)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = async () => {
    if (!user) {
      setState(INITIAL)
      setIsLoading(false)
      return
    }
    try {
      const next = await getCurrentEntitlement()
      setState(next)
    } catch (err) {
      console.error('[useEntitlement] refresh failed', err)
      setState(INITIAL)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    setIsLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  // Refetch when the page becomes visible again — covers Stripe Checkout
  // return on web, and resume-from-background on iOS.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return // iOS handled via app state events
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return {
    isEntitled: state.isEntitled,
    isLoading,
    trialEndsAt: state.trialEndsAt,
    source: state.source,
    refresh,
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEntitlement.tsx
git commit -m "$(cat <<'EOF'
feat(subs): add useEntitlement React hook

Exposes {isEntitled, isLoading, trialEndsAt, source, refresh} based on
the current Supabase user's RevenueCat entitlement. Refreshes on user
change and on web visibility-change (catches Stripe Checkout return).
isLoading is true on first fetch; once resolved, isEntitled is the
gating signal for UI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create Paywall component

**Files:**
- Create: `src/components/Paywall.tsx`

- [ ] **Step 1: Create the paywall**

```tsx
import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Loader2 } from 'lucide-react'
import { startCheckout } from '../lib/revenuecat'
import { useAuth } from '../hooks/useAuth'

interface Props {
  priceLabel?: string // e.g. "$4.99/mo" — falls back to generic copy if absent
}

/**
 * Full-screen paywall. Rendered when the authenticated user has no active
 * entitlement. Single CTA initiates platform-appropriate checkout.
 */
export function Paywall({ priceLabel }: Props) {
  const { signOut } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const result = await startCheckout()
      if (result.checkoutUrl) {
        // Web: redirect to Stripe Checkout
        window.location.href = result.checkoutUrl
      }
      // iOS: StoreKit sheet handles UX; the useEntitlement hook will
      // pick up the new state on resume
    } catch (err) {
      console.error('[Paywall] startCheckout failed', err)
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_60%)]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M 3.5 13 Q 5.5 15 8.5 18 Q 9.5 18 14.5 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path transform="translate(17.5 8) rotate(-50)" d="M2.5 0 L1.2 -0.45 L1.2 -2.2 L-0.2 -2.2 L-0.2 -0.45 L-2 -0.45 L-2.5 0 L-2 0.45 L-0.2 0.45 L-0.2 2.2 L1.2 2.2 L1.2 0.45 Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
            Flight<span className="text-cockpit-amber">Check</span>
          </h1>
        </div>

        <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit">
          <h2 className="text-lg font-semibold text-cockpit-text-primary mb-1 text-center">
            Start your free trial
          </h2>
          <p className="text-sm text-cockpit-text-secondary mb-5 text-center">
            7 days free, then {priceLabel ?? 'subscription pricing'}.
            Cancel anytime before the trial ends.
          </p>

          <ul className="text-sm text-cockpit-text-secondary space-y-2 mb-6">
            <li>• 19 aircraft with full POH reference data</li>
            <li>• Phase-by-phase checklists with auto-advance</li>
            <li>• Cross-device sync of preferences and notes</li>
            <li>• V-speeds, performance tables, emergency procedures</li>
          </ul>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
              hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Opening checkout…' : 'Start free trial'}
          </button>

          {!Capacitor.isNativePlatform() && (
            <p className="text-center text-xs text-cockpit-text-dim mt-4">
              Already subscribed on iOS? Sign in with the same email
              and access unlocks automatically.
            </p>
          )}
        </div>

        <button
          onClick={() => { signOut() }}
          className="w-full mt-4 text-center text-xs text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
        >
          Sign out
        </button>

        <p className="text-center text-xs text-cockpit-text-dim mt-3">
          For reference only — always verify against current POH/AFM
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Visually verify in dev (web only)**

```bash
npm run dev
```

Force the paywall to render by temporarily hard-coding `isEntitled = false` in `useEntitlement` (do NOT commit this), confirm:
- Layout matches the LoginScreen aesthetic
- "Already subscribed on iOS?" footer only shows on web
- "Sign out" works
- Clicking "Start free trial" attempts checkout (will fail without RC config — that's expected at this stage)

Revert the hard-coded entitlement value before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/Paywall.tsx
git commit -m "$(cat <<'EOF'
feat(subs): add Paywall component

Full-screen paywall in cockpit aesthetic. Single CTA calls startCheckout
which routes to Stripe Checkout on web or StoreKit on iOS. Includes
sign-out escape hatch, error display, and a web-only footer pointing
iOS subscribers at the same-email cross-platform path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Gate the app behind entitlement

**Files:**
- Modify: `src/App.tsx` (verify path with `Grep "AuthProvider" src/`)

- [ ] **Step 1: Locate the top-level component that renders after auth**

```bash
# In project root:
grep -rn "AuthProvider\|<LoginScreen" src/ | head -20
```

Look for the file where `LoginScreen` is conditionally rendered when the user is not authenticated. The gating insertion point is: render `<Paywall />` instead of the main app when `user` exists but `isEntitled === false`.

- [ ] **Step 2: Add entitlement gating logic**

At the same level where `<LoginScreen />` is rendered for unauthenticated users, add a Paywall branch for entitled-false users.

Pattern (adapt to whatever the file looks like):

```tsx
import { Paywall } from './components/Paywall'
import { useEntitlement } from './hooks/useEntitlement'
// ...existing imports

function AppGate() {
  const { user, loading: authLoading } = useAuth()
  const { isEntitled, isLoading: entLoading } = useEntitlement()

  if (authLoading) return <LoadingSpinner />
  if (!user) return <LoginScreen />
  if (entLoading) return <LoadingSpinner />
  if (!isEntitled) return <Paywall />
  return <AppInner /> // or whatever the existing post-auth component is named
}
```

(`LoadingSpinner` — use existing app spinner pattern, or a simple `<div className="min-h-screen flex items-center justify-center bg-cockpit-bg"><Loader2 className="w-6 h-6 animate-spin text-cockpit-amber" /></div>`)

Replace the equivalent block in the existing file with this pattern. The exact diff depends on the current structure — the implementer needs to read the file first.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Visually verify in dev**

```bash
npm run dev
```

- Sign out → see LoginScreen
- Sign in → see Paywall (because no entitlement yet; RC dashboard has no subscription for this user)
- (Optional) In RC dashboard, manually grant this user the `premium` entitlement (Test → Customers → user → grant entitlement) → reload web → app should now show `<AppInner />`

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat(subs): gate main app behind active entitlement

Authenticated users without an active premium entitlement see the
Paywall instead of the main app. Both auth and entitlement loading
states show a centered spinner so we never flash the wrong UI. The
isEntitled signal is sourced from useEntitlement -> RevenueCat
customerInfo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add source-aware subscription management to SettingsSheet

**Files:**
- Modify: `src/components/SettingsSheet.tsx` (verify path with `Grep "SettingsSheet" src/`)

- [ ] **Step 1: Locate SettingsSheet**

```bash
ls src/components/SettingsSheet.tsx 2>/dev/null && echo "exists" || echo "not found"
```

If not at that path, find it:
```bash
# Use Grep tool: pattern="SettingsSheet", glob="src/**/*.tsx"
```

- [ ] **Step 2: Read it to understand the existing row pattern**

Important to match the visual style of existing settings rows (toggles, etc.).

- [ ] **Step 3: Add the subscription row**

Near the top of the settings list (above preferences, below account info), add:

```tsx
import { Capacitor } from '@capacitor/core'
import { useEntitlement } from '../hooks/useEntitlement'

// Inside the component:
const { source, trialEndsAt, isEntitled } = useEntitlement()

const handleManageStripe = async () => {
  const { default: Purchases } = await import('@revenuecat/purchases-js')
  // RC web SDK provides a method to get the Customer Portal URL.
  // Look up the exact method name from the installed SDK at implementation
  // time (it's typically getManagementURL or similar).
  const url = await Purchases.getSharedInstance().getManagementURL()
  if (url) window.open(url, '_blank')
}

// In the JSX, before any preference toggles:
{isEntitled && source && (
  <div className="px-4 py-3 border-b border-cockpit-border">
    <div className="text-xs text-cockpit-text-dim uppercase tracking-wide mb-1">
      Subscription
    </div>
    {source === 'apple' && (
      <>
        <div className="text-sm text-cockpit-text-primary">Subscribed via App Store</div>
        <div className="text-xs text-cockpit-text-dim mt-0.5">
          Manage in Settings → Apple ID → Subscriptions
        </div>
      </>
    )}
    {source === 'stripe' && (
      <>
        <div className="text-sm text-cockpit-text-primary">
          Subscribed via Web
        </div>
        {Capacitor.isNativePlatform() ? (
          <div className="text-xs text-cockpit-text-dim mt-0.5">
            Manage your subscription at flightcheckapp.com
          </div>
        ) : (
          <button
            onClick={handleManageStripe}
            className="text-xs text-cockpit-amber hover:underline mt-1"
          >
            Manage subscription →
          </button>
        )}
      </>
    )}
    {trialEndsAt && (
      <div className="text-xs text-cockpit-amber mt-1">
        Trial ends {trialEndsAt.toLocaleDateString()}
      </div>
    )}
  </div>
)}
```

The critical anti-steering detail: the iOS branch for Stripe-source users shows informational text only — NO clickable button or URL link. The web branch gets the button.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsSheet.tsx
git commit -m "$(cat <<'EOF'
feat(subs): source-aware subscription row in Settings

Shows entitlement source (App Store / Web) and provides the correct
management path per platform:
- Apple source: text-only direction to iOS Settings → Apple ID
- Stripe source on web: clickable "Manage subscription" → Stripe
  Customer Portal
- Stripe source on iOS: text-only "manage at flightcheckapp.com" with
  no clickable URL (anti-steering safe)
- Trial expiration shown in amber when active

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Web end-to-end test in Stripe test mode

**Files:** N/A — manual verification only.

Run through these in order. Each "scenario" is a full sign-up + flow walkthrough. Use Stripe's test cards (https://stripe.com/docs/testing). If any scenario fails, stop and fix before continuing.

- [ ] **Scenario 1: New user → trial → entitlement active**
  - `npm run dev`
  - Open fresh incognito window
  - Sign up with a throwaway email
  - Confirm email (Supabase sends real email — use a real address or use Supabase Auth admin to bypass)
  - Sign in → Paywall renders
  - Click "Start free trial"
  - Stripe Checkout opens
  - Use test card `4242 4242 4242 4242`, any future expiry, any CVC
  - Submit
  - Browser redirects back to web app
  - Within a few seconds, Paywall disappears and AppInner renders
  - In RC dashboard, confirm a new Customer row appears with active premium entitlement

- [ ] **Scenario 2: Returning subscribed user**
  - Sign out
  - Sign back in with same email
  - Should land directly in AppInner (no paywall)

- [ ] **Scenario 3: Trial cancellation via Customer Portal**
  - In Settings → "Manage subscription" → opens Stripe Customer Portal
  - Click "Cancel plan"
  - Confirm cancellation
  - Return to app — should still have access (cancellation takes effect at period end)
  - In Stripe dashboard, set the test clock to advance past the trial end date
  - Reload the app → Paywall should now render

- [ ] **Scenario 4: Failed renewal**
  - Sign up another test user with card `4000 0000 0000 0341` (auto-fails on attached charge)
  - Trial completes → renewal fails → user enters past_due
  - During Stripe's smart retry window, entitlement stays active (configurable on RC side)
  - After final failure, entitlement is revoked → Paywall renders

- [ ] **Scenario 5: Sign out doesn't leak entitlement**
  - Sign in as Subscriber A → see AppInner
  - Sign out
  - Sign in as un-subscribed User B → must see Paywall (NOT AppInner — would be a critical bug)

- [ ] **Step 6: Commit any fixes**

If any scenario revealed a bug, fix it in the appropriate file and commit:
```bash
git add <fixed file>
git commit -m "fix(subs): <specific scenario>"
```

---

## Task 9: iOS sandbox testing via TestFlight

**Files:** N/A — TestFlight + sandbox testers.

- [ ] **Step 1: Create sandbox testers**
  - App Store Connect → Users and Access → Sandbox Testers → add at least 2 (different territories OK)

- [ ] **Step 2: Build for TestFlight**

The existing `build-ios.yml` workflow handles this on push to master. Since all the code from tasks 1-7 is already committed:
```bash
git push origin master
```

Wait for the GitHub Action to complete (15-25 min). Then check App Store Connect → TestFlight for the new build.

- [ ] **Step 3: Install on physical device**
  - Add yourself as an internal tester in App Store Connect
  - Install the new TestFlight build on your iPhone
  - Sign out of your real Apple ID in Settings → Media & Purchases (this is the iOS-15+ way to switch to sandbox)
  - Sign in with a sandbox tester account

- [ ] **Scenario 1: New iOS user → StoreKit purchase**
  - Open FlightCheck → sign up via Supabase Auth
  - Paywall appears (StoreKit-rendered because iOS)
  - Tap "Start free trial"
  - StoreKit sheet appears → confirm with Face ID
  - Returns to app → AppInner renders
  - In RC dashboard, verify new Customer with active premium from `app_store`

- [ ] **Scenario 2: Cross-platform — iOS user visits web**
  - In Stripe test mode setup: this won't fully test prod, but you can verify the cross-platform flow in test
  - On a desktop browser, sign in to the web app with the same Supabase email/Google
  - Web should NOT show Paywall (because iOS sandbox subscription is active in RC)
  - Settings should show "Subscribed via App Store"

- [ ] **Scenario 3: Cross-platform — web user opens iOS**
  - In an incognito browser, sign up as a new user
  - Subscribe via Stripe test mode (use `4242` card)
  - On iPhone (signed out, then signed in with same email), launch the iOS app
  - iOS should NOT show Paywall (RC sees existing Stripe entitlement)
  - Settings should show "Subscribed via Web" with NO clickable URL

- [ ] **Scenario 4: Sandbox renewal speed**
  - Sandbox trials last ~3 min (vs 7 days in production)
  - Wait through trial → confirm auto-renewal → entitlement remains
  - Cancel in iOS Settings → Apple ID → Subscriptions
  - Wait for expiration → entitlement should revoke → Paywall renders

- [ ] **Step 5: Commit any fixes**

---

## Task 10: Submit iOS v1.1 to App Store

**Files:** None directly — version bump + submission.

- [ ] **Step 1: Bump iOS version**

Edit `ios/App/App.xcodeproj/project.pbxproj`:
- Find `MARKETING_VERSION` → change `1.0.0` to `1.1.0`
- `CURRENT_PROJECT_VERSION` (build number) → increment by 1 from whatever it is

Or use the version bumping logic already in `build-ios.yml` (per memory, CFBundleVersion auto-increments).

- [ ] **Step 2: Commit version bump**

```bash
git add ios/App/App.xcodeproj/project.pbxproj
git commit -m "chore(ios): bump version to 1.1.0 for RevenueCat integration release"
git push origin master
```

- [ ] **Step 3: Wait for build to land in App Store Connect**

GitHub Action runs → archive uploads → ~30 min later, build appears as "Ready to Submit" in App Store Connect.

- [ ] **Step 4: Submit for review**

In App Store Connect:
- App Store tab → "+ Version or Platform" → 1.1.0
- Fill in "What's New" text:
  ```
  Subscription updates: FlightCheck Pro is now available with full
  access on iOS and the web (flightcheckapp.com). If you previously
  subscribed on iOS, signing into the web app with the same Apple ID
  or email automatically grants access — no second subscription
  required.

  Also includes accessibility improvements (text size now scales
  across all screens), fixes for OAuth sign-in, and a more readable
  Settings view.
  ```
- Select build 1.1.0
- App Review Notes:
  ```
  This release adds RevenueCat for cross-platform subscription
  unification. Users who subscribe on the web (Stripe) will see
  "Subscribed via Web" in Settings, with text-only management
  guidance per App Store Guideline 3.1.3(b) — no clickable URLs
  to external billing. Users continue to be able to subscribe via
  StoreKit on iOS.

  Test account:
  Email: <a sandbox tester or real account>
  Password: <password>
  ```
- Submit for review

- [ ] **Step 5: Wait** — usually 24-48h.

---

## Task 11: Production launch

**Files:** N/A — Stripe live mode + env var swap.

- [ ] **Step 1: Activate Stripe live mode**
  - Stripe Dashboard → toggle from Test to Live (top right)
  - Recreate the Product + Price in live mode with the same details
  - Note the new live Price ID

- [ ] **Step 2: Update RevenueCat to use live Stripe**
  - RC Dashboard → Apps → Stripe app → swap test API key for live API key
  - In Products, link to the live Stripe Price ID
  - In Offerings, ensure the default offering points to the live product

- [ ] **Step 3: Update env vars to live keys**

There's no separate "live" RC SDK key — same public key works for both modes; what changes is what RC has configured server-side. Just verify:
  - Netlify: env vars present (same names as before)
  - GitHub Actions: secrets present

- [ ] **Step 4: Verify iOS v1.1 is approved**
  - App Store Connect → wait for "Ready for Sale" status
  - In Pricing and Availability, set release timing to "Manual" if you want to control launch moment

- [ ] **Step 5: Launch**
  - Tap "Release" in App Store Connect for iOS v1.1
  - Smoke test on web: subscribe with a real card (use a small amount card; cancel immediately if you don't want to charge yourself)
  - Smoke test on iOS: same with TestFlight + sandbox
  - Monitor RC dashboard for first hour

- [ ] **Step 6: Post-launch verification**
  - Real subscriber on web → entitlement appears in RC
  - Real subscriber on iOS → entitlement appears in RC
  - Cross-platform smoke test with same email on both

---

## Self-review (done at plan-writing time)

**Spec coverage:** all 7 decisions traced through to tasks. Decision #2 (cross-platform unification) shows up in Tasks 2, 3, 4, 7, 9. Decision #6 (no clickable URLs on iOS for Stripe source) explicitly called out in Task 7 Step 3 and Task 10 review notes.

**Placeholder scan:** clean. The only place an exact value is needed is the price label (Task 5 prop is optional); implementer fills in actual iOS price when they have it.

**Type consistency:** `EntitlementState` type defined in Task 2 (`revenuecat.ts`), consumed in Task 4 (`useEntitlement.tsx`) and Task 7 (`SettingsSheet.tsx`). Same field names throughout.

**Known soft spots / things that may need adjustment during implementation:**
1. The RC SDK method names in `getManagementURL()` (Task 7) and `purchase()` return shape (Task 2) should be verified against the installed SDK docs at implementation time — these APIs evolve.
2. The `App.tsx` modification in Task 6 is "pattern not diff" because the existing top-level routing structure varies; implementer reads first, then adapts.
3. Stripe Customer Portal URL retrieval differs slightly across RC SDK versions; the inline TODO in Task 7 acknowledges this.

These are flagged inline in the relevant tasks rather than hidden — fine for an implementation plan that runs against a moving SDK.

---

## Execution options

Plan complete. Two ways to execute:

1. **Subagent-driven (recommended)** — fresh subagent per task, two-stage review (spec compliance + code quality) between tasks. Best for ensuring nothing slips.
2. **Inline execution** — execute tasks in this session via the `executing-plans` skill, with checkpoints between phases. Faster but uses main context.

Decide after reviewing the plan.
