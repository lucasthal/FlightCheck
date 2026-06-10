# Apple Rejection Fixes (Build 43) — Design Spec

**Date:** 2026-06-09
**Context:** App Store review of v1.0 (43) rejected on three guidelines. Two require code changes (this spec); one requires a written reply only (drafted at resubmission time, not covered here).

| Guideline | Issue | Resolution |
|-----------|-------|------------|
| 4.8 Login Services | Google login offered without a privacy-equivalent alternative | Add Sign in with Apple (iOS native + web) |
| 5.1.1(v) Data Collection | Account creation without in-app account deletion | Add account deletion (Settings + Edge Function) |
| 3.2 Business | Reviewer thinks app is enterprise-only | Written reply to App Review (out of scope here); add demo account credentials to App Review Information |

---

## Feature 1: Sign in with Apple

### Scope
Offered on **both** platforms:
- **iOS:** native Apple sign-in sheet (Face ID) — what the reviewer will test
- **Web:** standard OAuth redirect — required so Apple-account users can log into flightcheckapp.com (they have no password; without this they could never reach the web app or its Stripe subscription)

### iOS native flow
- Plugin: `@capacitor-community/apple-sign-in`
- Flow: generate a cryptographically random nonce → SHA-256 hash it → pass the **hashed** nonce to the plugin → receive Apple identity token → call `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce: rawNonce })`
- No browser, no deep-link redirect. The existing `appUrlOpen` PKCE handler is untouched.
- Full name is only provided by Apple on **first** authorization — capture it then and pass via `options.data.full_name` if available (matches the email signup convention).

### Web flow
- `supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } })`
- Identical pattern to the existing Google web path in `useAuth.tsx`.

### Code changes
1. **`src/hooks/useAuth.tsx`** — new `signInWithApple(): Promise<AuthError | null>` in `AuthContextValue`, branching native (plugin + `signInWithIdToken`) vs web (`signInWithOAuth`).
2. **`src/components/LoginScreen.tsx`** — "Continue with Apple" button placed **above** the Google button (Apple HIG: their button must not be visually subordinate). Black button, white Apple logo SVG, standard "Continue with Apple" label.
3. **`ios/App/App/App.entitlements`** — new file:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>com.apple.developer.applesignin</key>
     <array><string>Default</string></array>
   </dict>
   </plist>
   ```
4. **`ios/App/App.xcodeproj/project.pbxproj`** — add `CODE_SIGN_ENTITLEMENTS = App/App.entitlements;` to both (Debug + Release) App target build configurations. Edited as text; no Xcode involved.
5. **`package.json`** — add `@capacitor-community/apple-sign-in`.

### Manual configuration (all browser-based, no Mac)
1. **Apple Developer portal:**
   - App ID `com.flightcheck.app`: enable "Sign In with Apple" capability
   - Create a **Services ID** (e.g. `com.flightcheck.app.web`) with Sign In with Apple enabled; return URL = Supabase auth callback (`https://<project-ref>.supabase.co/auth/v1/callback`); authorized domain = the Supabase project domain
   - Create a **Sign in with Apple key** (.p8) + note Key ID and Team ID
   - **Regenerate** the "FlightCheck App Store" provisioning profile (capability change invalidates it) → update GitHub secret `PROVISIONING_PROFILE_BASE64`
2. **Supabase dashboard:** Authentication → Providers → Apple: client ID = Services ID, plus secret generated from the .p8/Key ID/Team ID. Native iOS requires the app bundle ID (`com.flightcheck.app`) listed in the provider's authorized client IDs.

### Identity continuity
Apple returns a stable user identifier and a stable relay email (if "Hide My Email" chosen) per Apple ID per team. Supabase keys the identity on Apple's `sub` claim, so iOS-native and web sign-ins resolve to the **same Supabase user** → same RevenueCat `app_user_id` → entitlements work cross-platform with no changes to subscription code.

---

## Feature 2: Account Deletion

### UX (in `SettingsSheet.tsx`)
1. New "Danger zone" section at the bottom of Settings: red **Delete account** row.
2. Tapping opens a confirmation view stating:
   - All data (checklist profiles, custom items, favorites, preferences, feedback) is permanently erased
   - **Stripe subscribers** (source = `stripe`): subscription will be cancelled automatically
   - **Apple subscribers** (source = `apple`): we cannot cancel App Store subscriptions — instructions to cancel in iOS Settings → Apple ID → Subscriptions (text only, no link — anti-steering does not apply since this directs INTO Apple's own subscription management, but text keeps it simple)
   - Subscription messaging keyed off the existing `source` from `useEntitlement`
3. Red "Permanently delete my account" button → loading state → on success: local sign-out, return to login screen. On failure: error message, account untouched.

### Backend: Supabase Edge Function `delete-account`
First Edge Function in the repo: `supabase/functions/delete-account/index.ts`.

**Auth:** derives the caller's user ID from the request JWT (`Authorization` header via `supabase.auth.getUser(jwt)`). A user can only delete themselves. No request body needed.

**Steps, in order:**
1. **RevenueCat:** `DELETE https://api.revenuecat.com/v1/subscribers/{user_id}` with the RC **secret** API key. Deletes the RC customer; per RC docs this also cancels active Web Billing (Stripe) subscriptions. **Verification required during planning** — if RC customer deletion does *not* auto-cancel Web Billing subscriptions, the function must instead cancel via RC's Web Billing cancellation endpoint or the Stripe API before deleting the customer. RC failure (e.g. customer never existed) is non-fatal — log and continue.
2. **Data rows:** explicit deletes in FK-safe order: `profile_items` → `profile_phases` → `checklist_profiles`, then `favorites`, `user_preferences`, `feedback` — all filtered by `user_id`. Explicit deletes; do not rely on unverified cascade rules.
3. **Auth user:** `supabase.auth.admin.deleteUser(userId)` using `SUPABASE_SERVICE_ROLE_KEY` (auto-injected into Edge Functions).

Any failure in steps 2–3 returns 500 and the client shows an error; partial deletion is acceptable only in the direction of "subscription cancelled but account remains" (user can retry), never "account gone but subscription billing".
Ordering rationale: cancel billing first so a failure mid-flow can never leave a paying ghost.

**Client call:** `supabase.functions.invoke('delete-account')` (SDK attaches the JWT automatically).

### Manual configuration
1. RevenueCat dashboard → API keys: copy the **secret** key (`sk_…`)
2. `npx supabase login` (one-time access token), `npx supabase link --project-ref <ref>`
3. `npx supabase secrets set RC_SECRET_API_KEY=sk_…`
4. `npx supabase functions deploy delete-account`

### App Review evidence
Screen recording on a physical device demonstrating: sign-in → Settings → Delete account → confirmation → deletion → return to login. Attached to App Review notes for the resubmission. Also add demo account credentials to App Review Information (supports the 3.2 reply).

---

## Out of scope
- Guideline 3.2 written reply (drafted separately when resubmitting)
- "No subscription package available" RC offerings bug (pre-existing, tracked separately)
- Android parity for SIWA (Apple sign-in not required on Android; web flow would work if ever needed)

## Testing
- **Web:** local dev + Netlify preview — Apple OAuth round-trip, delete-account E2E with a throwaway account (verify rows gone, auth user gone, RC customer gone)
- **iOS:** TestFlight build 44 — native Apple sheet (with Hide My Email), then cross-login on web with the same Apple ID reaching the same account; deletion flow recorded for App Review
- **Regression:** Google + email/password sign-in unchanged; existing PKCE deep-link handler unchanged
