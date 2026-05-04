# Launch Strategy — Design Spec

**Date:** 2026-05-03
**Status:** Approved

---

## Overview

Two-phase strategy to validate the app with real pilots before investing in native infrastructure and monetization.

**Phase 1 — Stress Test (PWA):** Build and stabilize five features, then distribute a URL to pilot testers. No billing gate. Pilots install via "Add to Home Screen" and test in real cockpit conditions, including in flight without internet. Iterate on feedback.

**Phase 2 — Launch (Native):** After pilot validation, wrap the app in Capacitor, submit to the App Store and Google Play, and implement billing via RevenueCat (StoreKit + Play Billing). The existing `docs/superpowers/plans/2026-05-03-trial-billing.md` is superseded and archived — it assumed Stripe/web billing and is wrong for native.

---

## Phase 1 — Stress Test Features

### 1. Fix Google Sign-In (blocking bug — do first)

The "Create account with Google" button is non-functional. This is a blocking onboarding bug — pilots cannot create accounts without it. Fix before any stress test distribution. Likely cause: misconfigured OAuth redirect URI or missing Supabase Google provider setup.

**Success criteria:** A new user can create an account and sign in using their Google account on both iOS Safari and Android Chrome.

---

### 2. User Settings & Preferences

**Existing plan:** `docs/superpowers/plans/2026-05-03-user-settings.md` (42 tasks)

A new `usePreferences` hook replaces the existing `useTheme` hook and owns all preference state: theme (dark/night/day), text size (sm/md/lg/xl), keep-screen-awake, and default aircraft. Preferences persist to a Supabase `user_preferences` table and fall back to localStorage when offline. A `SettingsSheet` bottom-sheet UI is accessible from every screen via a gear icon. A standalone `useWakeLock` hook manages the Screen Wake Lock API (`navigator.wakeLock`), which is supported in WKWebView on iOS 16.4+ and Android WebView.

**Success criteria:** Preferences survive app close and reopening. Theme and text size apply immediately. Wake lock keeps the screen on during a checklist run.

---

### 3. Checklist Auto-Scroll

**New feature — needs implementation plan.**

When a pilot checks off an item, the checklist automatically scrolls so the next unchecked item is centered in the viewport. This keeps the active item in view without requiring the pilot to scroll manually — critical when hands are busy in the cockpit.

**Behavior:**
- On item check: find the next unchecked item in the current phase, call `scrollIntoView({ behavior: 'smooth', block: 'center' })` on its element ref.
- If the user manually scrolls, auto-scroll is suspended for that interaction.
- Auto-scroll re-engages on the next item check.

**Implementation:**
- Each checklist item row holds a `ref` registered into a ref map keyed by item ID.
- A `userScrolled` boolean flag is set on `wheel`/`touchmove` events and cleared when an item is checked.
- Auto-scroll fires only when `userScrolled` is false.

**Success criteria:** Checking an item smoothly scrolls the next unchecked item into center view. Manual scrolling interrupts this without breaking check functionality. Auto-scroll resumes on the next check.

---

### 4. Multi-Window Compatibility

**New feature — needs implementation plan.**

The app must reflow correctly when the window is narrowed to split-screen dimensions — typically 50% or 33% of screen width. The primary use case is iPad split-screen: checklist on one half, ForeFlight/charts on the other. This is a high-value pilot workflow.

**Target breakpoints:**
- ~320px effective width (iPhone SE / narrow split)
- ~400px effective width (half-screen on standard iPad)
- ~540px effective width (two-thirds on iPad Pro)

**Scope:** Tailwind responsive audit of all major layout components — top bar, phase banner, phase strip, checklist rows, settings sheet, home screen aircraft grid. Nothing should assume a minimum viewport width beyond 320px. No horizontal overflow. Touch targets remain ≥44px at all widths.

**Platform notes:**
- iPad: multi-window via Stage Manager / split-screen (iPadOS 16+)
- Android: multi-window via split-screen (Android 7+) and freeform windows

**Success criteria:** App is fully usable at 320px width with no overflow or broken layouts. iPad split-screen at 50% shows a readable, functional checklist.

---

### 5. Offline Support

**Existing plan:** `docs/superpowers/plans/2026-05-03-offline-support.md` (46 tasks)

Profile data fetched from Supabase is mirrored to localStorage after every successful fetch. On network failure the app falls back to the cached copy and raises an `isOffline` flag that disables all write operations with clear UI feedback. Check-state is re-keyed from one global localStorage key to per-profile keys so sessions on different profiles don't collide.

The Workbox/vite-plugin-pwa service-worker asset caching is valid and useful for this PWA phase. When Capacitor is added in Phase 2, assets are bundled natively and the service worker becomes non-essential — but it is harmless and does not need to be removed.

**Success criteria:** A pilot who last opened the app with internet can open it in airplane mode and run a full checklist. All write operations (profile edits, saving) are blocked with a clear "offline" message.

---

## Phase 2 — Native Launch

### 1. Capacitor Wrapping

Add Capacitor to the project (`npx cap init`, `npx cap add ios`, `npx cap add android`). Configure the Vite build output to `www/`. Verify the full app runs correctly in Xcode Simulator and Android Emulator. Resolve any WKWebView/WebView compatibility issues (CSS variables, font loading, wake lock API, etc.).

A new spec + implementation plan is written at this stage.

---

### 2. Billing — RevenueCat + StoreKit + Play Billing

Configure subscription products and 5-day free trial in App Store Connect and Google Play Console. Integrate the RevenueCat Capacitor plugin for a single API surface over both platforms. Add an entitlement check on app launch that gates access to the checklist. RevenueCat is the source of truth for subscription status — no `user_subscriptions` Supabase table needed.

**Pricing:** $2.99/month, 5-day free trial.
**Revenue split:** Apple/Google take 15% (Small Business Program) or 30% standard.

The existing `docs/superpowers/plans/2026-05-03-trial-billing.md` (Stripe/web architecture) is archived. A new spec + plan is written at this stage.

---

### 3. App Store and Google Play Submission

App icons (all required sizes), screenshots for each device class, app description, privacy policy URL, age rating questionnaire. Submit for App Store review. Run a TestFlight beta with pilot testers before public release. Parallel Google Play internal testing track.

---

## Existing Plans Status

| Plan | Status |
|---|---|
| `2026-05-03-user-settings.md` | Ready to execute (Phase 1, step 2) |
| `2026-05-03-offline-support.md` | Ready to execute (Phase 1, step 5) |
| `2026-05-03-trial-billing.md` | **Superseded** — archive after Phase 1; replace with native billing plan in Phase 2 |

Plans still needed:
- Fix Google Sign-In (Phase 1, step 1)
- Checklist Auto-Scroll (Phase 1, step 3)
- Multi-Window Compatibility (Phase 1, step 4)
- Capacitor Wrapping (Phase 2, step 1)
- Native Billing — RevenueCat (Phase 2, step 2)
- App Store Submission (Phase 2, step 3)
