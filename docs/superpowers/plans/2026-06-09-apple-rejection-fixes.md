# Apple Rejection Fixes (SIWA + Account Deletion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve App Store rejection of build 43 — add Sign in with Apple (guideline 4.8) and in-app account deletion (guideline 5.1.1(v)).

**Architecture:** Sign in with Apple uses the native sheet on iOS (`@capacitor-community/apple-sign-in` → `supabase.auth.signInWithIdToken`) and standard Supabase OAuth on web. Account deletion is a Supabase Edge Function (`delete-account`) that cancels billing via the RevenueCat customer-deletion API (verified: deleting an RC customer cancels Web Billing/Stripe subscriptions immediately), deletes all user rows, then deletes the auth user; triggered from a confirmation flow in Settings.

**Tech Stack:** React 18 + TypeScript + Vite, Capacitor (iOS via SPM — no Podfile), Supabase (auth + Edge Functions/Deno), RevenueCat.

**Spec:** `docs/superpowers/specs/2026-06-09-apple-rejection-fixes-design.md`

**Repo facts the implementer needs:**
- No test suite exists. Verification = `npx tsc --noEmit` and `npm run build`.
- DB schema chain: `checklist_profiles(user_id)` → `profile_phases(profile_id)` → `profile_items(phase_id)`. Also `favorites(user_id)`, `user_preferences(user_id)`, `feedback(user_id)`.
- iOS builds happen only in GitHub Actions (`.github/workflows/build-ios.yml`) on macOS runners with manual signing. Local machine is Windows.
- `ios/App/App/` currently has NO `.entitlements` file and `project.pbxproj` has no `CODE_SIGN_ENTITLEMENTS` setting.

---

### Task 1: iOS project config for Sign in with Apple

**Files:**
- Create: `ios/App/App/App.entitlements`
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Modify: `package.json` / `package-lock.json` (plugin install)
- Modify (generated): `ios/App/CapApp-SPM/Package.swift`, `ios/App/App/capacitor.config.json` (via `npx cap sync`)

- [ ] **Step 1: Install the plugin**

Run: `npm install @capacitor-community/apple-sign-in`
Expected: added to `dependencies` in package.json.

- [ ] **Step 2: Create the entitlements file**

Create `ios/App/App/App.entitlements` with exactly:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
```

- [ ] **Step 3: Reference the entitlements in the Xcode project**

Read `ios/App/App.xcodeproj/project.pbxproj`. Find the two `buildSettings` blocks that contain `PRODUCT_BUNDLE_IDENTIFIER = com.flightcheck.app;` (the App target's Debug and Release configurations). In **each** of the two blocks, add this line (alphabetical placement near the top of the block, e.g. after the `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;` line):

```
				CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
```

(Indentation: tabs, matching neighboring lines.)

Also: in the `PBXFileReference` section, no entry is needed — `CODE_SIGN_ENTITLEMENTS` works by path without a file reference. Do not add the file to any build phase.

- [ ] **Step 4: Sync Capacitor**

Run: `npx cap sync ios`
Expected: `ios/App/CapApp-SPM/Package.swift` now lists `CapacitorCommunityAppleSignIn` as a dependency, and `ios/App/App/capacitor.config.json` packages list includes the plugin. If the command fails on Windows for iOS-specific reasons, that is acceptable — CI runs `npx cap sync ios` on macOS before every build — but the Package.swift change should still be attempted; report what happened.

- [ ] **Step 5: Verify the web build is unaffected**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json ios/App/App/App.entitlements ios/App/App.xcodeproj/project.pbxproj ios/App/CapApp-SPM/Package.swift ios/App/App/capacitor.config.json
git commit -m "feat(ios): add Sign in with Apple entitlement and capacitor plugin"
```

(Only add the generated files if `cap sync` changed them.)

---

### Task 2: `signInWithApple` in useAuth

**Files:**
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Add the method to the context interface**

In `src/hooks/useAuth.tsx`, extend `AuthContextValue`:

```ts
interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthError | null>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<AuthError | null>
  signInWithApple: () => Promise<AuthError | null>
  resetPassword: (email: string) => Promise<AuthError | null>
}
```

- [ ] **Step 2: Implement the method**

Add after `signInWithGoogle` (around line 110):

```ts
  const signInWithApple = async (): Promise<AuthError | null> => {
    if (isNative) {
      try {
        // Apple requires the nonce in the request to be the SHA-256 hash of
        // the nonce Supabase verifies against the identity token.
        const rawNonce = crypto.randomUUID() + crypto.randomUUID()
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce))
        const hashedNonce = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
        const result = await SignInWithApple.authorize({
          clientId: 'com.flightcheck.app',
          redirectURI: `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback`,
          scopes: 'email name',
          nonce: hashedNonce,
        })

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
          nonce: rawNonce,
        })
        if (error) return error

        // Apple only provides the name on FIRST authorization — persist it
        if (result.response.givenName) {
          const fullName = [result.response.givenName, result.response.familyName]
            .filter(Boolean)
            .join(' ')
          await supabase.auth.updateUser({ data: { full_name: fullName } })
        }
        return null
      } catch (err) {
        // Native sheet dismissed by the user — not an error
        if (err instanceof Error && /cancel/i.test(err.message)) return null
        return { name: 'AuthApiError', message: 'Apple sign-in failed' } as AuthError
      }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    })
    return error
  }
```

Note: the web branch does NOT need the native deep-link redirect — Apple sign-in on iOS goes through the native sheet above, never the browser. Do not touch the existing `appUrlOpen` handler or `signInWithGoogle`.

- [ ] **Step 3: Expose it in the provider value**

```tsx
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, signInWithApple, resetPassword }}>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. The build should produce a separate lazy chunk for the apple-sign-in plugin (dynamic import).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat(auth): signInWithApple — native ID-token flow on iOS, OAuth on web"
```

---

### Task 3: Apple button on the login screen

**Files:**
- Modify: `src/components/LoginScreen.tsx`

- [ ] **Step 1: Destructure the new method**

Line 8 becomes:

```ts
  const { signIn, signUp, signInWithGoogle, signInWithApple, resetPassword } = useAuth()
```

- [ ] **Step 2: Add the Apple button ABOVE the Google button**

Inside the `{mode !== 'reset' && (<>` block (currently starting ~line 131), insert this as the FIRST element, before the existing Google `<button>`:

```tsx
              <button
                onClick={async () => {
                  setError(null)
                  setSubmitting(true)
                  const err = await signInWithApple()
                  setSubmitting(false)
                  if (err) setError(err.message)
                }}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-white text-black text-sm font-medium
                  hover:bg-gray-200 transition-all duration-150 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 384 512" className="w-4 h-4 flex-shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                {submitting ? 'Please wait…' : 'Continue with Apple'}
              </button>
```

The Google button keeps its existing `mb-4`; the Apple button's `mb-3` provides the gap between them. White button on the dark cockpit background follows Apple's HIG for dark UIs, and placing it first keeps it non-subordinate to Google (HIG requirement).

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open the login screen in a browser. Confirm: Apple button on top (white), Google below it, "or" divider, email form. Both buttons disable while submitting. (Clicking Apple on web will redirect to Apple's OAuth page and fail until Task 6's manual config is done — a redirect to `appleid.apple.com` is the expected behavior at this stage.)

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginScreen.tsx
git commit -m "feat(login): Continue with Apple button above Google (guideline 4.8)"
```

---

### Task 4: `delete-account` Edge Function

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

- [ ] **Step 1: Write the function**

Create `supabase/functions/delete-account/index.ts` with exactly:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !user) return json(401, { error: 'Unauthorized' })

  // 1. Billing first: deleting the RevenueCat customer cancels active Web
  // Billing (Stripe) subscriptions immediately. App Store subscriptions are
  // managed by Apple and unaffected (the UI warns those users). 404 means the
  // customer never purchased anything — safe to continue. Any other failure
  // aborts so we never delete an account that still has live billing.
  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${Deno.env.get('RC_SECRET_API_KEY')}` },
    },
  )
  if (!rcRes.ok && rcRes.status !== 404) {
    console.error('[delete-account] RC deletion failed', rcRes.status, await rcRes.text())
    return json(502, { error: 'Subscription cancellation failed' })
  }

  // 2. Data rows, child-first (profile_items/profile_phases have no user_id)
  const { data: profiles, error: profilesError } = await admin
    .from('checklist_profiles')
    .select('id')
    .eq('user_id', user.id)
  if (profilesError) return json(500, { error: 'Data deletion failed' })

  const profileIds = (profiles ?? []).map((p) => p.id)
  if (profileIds.length > 0) {
    const { data: phases, error: phasesError } = await admin
      .from('profile_phases')
      .select('id')
      .in('profile_id', profileIds)
    if (phasesError) return json(500, { error: 'Data deletion failed' })

    const phaseIds = (phases ?? []).map((p) => p.id)
    if (phaseIds.length > 0) {
      const { error } = await admin.from('profile_items').delete().in('phase_id', phaseIds)
      if (error) return json(500, { error: 'Data deletion failed' })
    }
    const { error: phasesDeleteError } = await admin
      .from('profile_phases')
      .delete()
      .in('profile_id', profileIds)
    if (phasesDeleteError) return json(500, { error: 'Data deletion failed' })
  }

  for (const table of ['checklist_profiles', 'favorites', 'user_preferences', 'feedback']) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id)
    if (error) return json(500, { error: 'Data deletion failed' })
  }

  // 3. Auth user last
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[delete-account] auth deletion failed', deleteUserError)
    return json(500, { error: 'Account deletion failed' })
  }

  return json(200, { success: true })
})
```

Notes for the implementer:
- This is a Deno file. `Deno.serve` and `npm:` imports are correct; the project's `tsc` does NOT type-check this file (it is outside `src/`), so `npx tsc --noEmit` passing on the web app is the only local check. Do not add Deno types to the web tsconfig.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into deployed Edge Functions. `RC_SECRET_API_KEY` is set manually in Task 7.

- [ ] **Step 2: Verify the web app still builds (no accidental tsconfig pickup)**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, no new errors about the Deno file.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/index.ts
git commit -m "feat(backend): delete-account Edge Function — cancels RC billing, wipes data, deletes auth user"
```

---

### Task 5: Delete-account UI in Settings

**Files:**
- Modify: `src/components/SettingsSheet.tsx`

- [ ] **Step 1: Add state and handler**

In `SettingsSheet`, change the `useAuth` destructure (line 29) to:

```ts
  const { user, signOut } = useAuth()
```

Below the existing `handleManageStripe` function, add:

```ts
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.functions.invoke('delete-account')
    if (error) {
      setDeleting(false)
      setDeleteError('Account deletion failed. Please try again or contact support@flightcheckapp.com.')
      return
    }
    // Account is gone server-side; sign out locally (server signOut may 403 — ignore)
    await signOut().catch(() => {})
  }
```

- [ ] **Step 2: Add the Danger zone section**

After the closing `</div>` of the "Default aircraft" section (currently ends ~line 219), inside the `px-4 pb-8 space-y-6` container, add:

```tsx
          {/* Danger zone */}
          <div className="space-y-2 border-t border-cockpit-border pt-4">
            <p className="text-xs text-red-400 uppercase tracking-wide">Danger zone</p>
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Delete account
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm font-medium text-cockpit-text-primary">
                  Permanently delete your account?
                </p>
                <p className="text-xs text-cockpit-text-secondary">
                  All your data — checklist profiles, custom items, favorites, and
                  preferences — will be permanently erased. This cannot be undone.
                </p>
                {isEntitled && source === 'stripe' && (
                  <p className="text-xs text-cockpit-text-secondary">
                    Your web subscription will be cancelled automatically.
                  </p>
                )}
                {isEntitled && source === 'apple' && (
                  <p className="text-xs text-cockpit-amber">
                    Your App Store subscription is billed by Apple and will not stop
                    when your account is deleted — cancel it in Settings → Apple ID →
                    Subscriptions.
                  </p>
                )}
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmingDelete(false); setDeleteError(null) }}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-cockpit-border bg-cockpit-card px-3 py-2 text-sm text-cockpit-text-primary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Permanently delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

Then `npm run dev` in a browser: open Settings → confirm the red "Delete account" row appears at the bottom; tapping it expands the confirmation card; Cancel collapses it. Do NOT click "Permanently delete" against the production database with a real account — the function isn't deployed yet, so it would error harmlessly, but keep the click for Task 8's E2E with a throwaway account.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsSheet.tsx
git commit -m "feat(settings): account deletion flow with confirmation (guideline 5.1.1(v))"
```

---

### Task 6: Apple portal + Supabase provider config [MANUAL — walk the user through]

No repo files. All browser-based. The controller (not a subagent) walks the user through:

- [ ] **Step 1: Enable the capability on the App ID**

developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → `com.flightcheck.app` → check **Sign In with Apple** → Save.

- [ ] **Step 2: Create the Sign in with Apple key**

Keys → **+** → name `FlightCheck SIWA` → check **Sign in with Apple** → Configure → primary App ID `com.flightcheck.app` → Register → **download the .p8** (one-time download) → note the **Key ID** and the **Team ID** (top-right of the portal).

- [ ] **Step 3: Create the Services ID (for web)**

Identifiers → **+** → **Services IDs** → description `FlightCheck Web`, identifier `com.flightcheck.app.web` → Register. Then open it → check **Sign In with Apple** → Configure → primary App ID `com.flightcheck.app` → Domains: `<project-ref>.supabase.co` → Return URLs: `https://<project-ref>.supabase.co/auth/v1/callback` → Save. (`<project-ref>` is the host part of `VITE_SUPABASE_URL`.)

- [ ] **Step 4: Generate the Supabase client secret from the .p8**

Supabase's Apple provider needs a signed JWT as "Secret Key". Run locally (uses `jose`, installed ad hoc):

```bash
npm install --no-save jose
node --input-type=module -e "
import { SignJWT, importPKCS8 } from 'jose'
import { readFileSync } from 'fs'
const p8 = readFileSync(process.argv[1], 'utf8')
const key = await importPKCS8(p8, 'ES256')
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: 'KEY_ID_HERE' })
  .setIssuer('TEAM_ID_HERE')
  .setIssuedAt()
  .setExpirationTime('180d')
  .setAudience('https://appleid.apple.com')
  .setSubject('com.flightcheck.app.web')
  .sign(key)
console.log(jwt)
" "path/to/AuthKey_XXXXXX.p8"
```

Replace `KEY_ID_HERE`, `TEAM_ID_HERE`, and the .p8 path. **This secret expires in ~6 months — calendar a regeneration.**

- [ ] **Step 5: Configure the Supabase Apple provider**

Supabase Dashboard → Authentication → Sign In / Providers → Apple → enable:
- **Client IDs:** `com.flightcheck.app.web,com.flightcheck.app` (Services ID for web OAuth + bundle ID so native `signInWithIdToken` tokens are accepted)
- **Secret Key:** the JWT from Step 4

- [ ] **Step 6: Regenerate the provisioning profile**

The capability change invalidated the existing profile. Profiles → `FlightCheck App Store` → Edit → Save (regenerates) → Download. Then update the GitHub secret from PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Downloads\FlightCheck_App_Store.mobileprovision")) | Set-Clipboard
gh secret set PROVISIONING_PROFILE_BASE64 --repo lucasthal/FlightCheck
```

(paste from clipboard when prompted, or pipe directly).

---

### Task 7: Deploy the Edge Function [MANUAL — run with the user]

- [ ] **Step 1: Link the Supabase project (one-time)**

```bash
npx supabase login          # opens browser for an access token
npx supabase link --project-ref <project-ref>
```

- [ ] **Step 2: Set the RevenueCat secret**

RevenueCat dashboard → API keys → copy the **secret** key (`sk_…`), then:

```bash
npx supabase secrets set RC_SECRET_API_KEY=sk_xxxxxxxx
```

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy delete-account
```

Expected: deploy succeeds; function visible in Supabase Dashboard → Edge Functions with "Verify JWT" enabled (default).

- [ ] **Step 4: Commit any generated supabase config** (the CLI may create `supabase/config.toml` / `.gitignore` entries)

```bash
git add supabase/
git commit -m "chore(backend): supabase project config for edge functions"
```

(Skip if nothing was generated.)

---

### Task 8: End-to-end verification + resubmission collateral [MANUAL]

- [ ] **Step 1: Web E2E — account deletion**

On the production web app with a **throwaway** email account: sign up → confirm → (optionally create a checklist profile) → Settings → Delete account → confirm. Verify: returned to login; sign-in with the old credentials fails; Supabase Dashboard shows the auth user gone and no orphan rows in `checklist_profiles`/`profile_phases`/`profile_items`/`user_preferences`; RevenueCat customer (if any) gone.

- [ ] **Step 2: Web E2E — Apple sign-in**

Login screen → Continue with Apple → authenticate (try **Hide My Email**) → lands in the app as a new user (paywall expected — correct behavior).

- [ ] **Step 3: Push to master → CI builds 44**

Verify the iOS workflow succeeds with the regenerated provisioning profile (the SIWA entitlement requires it — a signing failure here means Task 6 Step 6 didn't take).

- [ ] **Step 4: TestFlight on a physical device**

- Native Apple sheet appears (Face ID), Hide My Email works, user lands in app
- Same Apple ID on web reaches the same account (cross-platform identity)
- **Record the deletion flow**: screen recording of sign-in → Settings → Delete account → confirmation → deletion → login screen. Save for App Review notes.

- [ ] **Step 5: Resubmission package**

- Upload the recording reference + demo account credentials (a pre-created reviewer account) to App Review Information
- Draft + send the guideline 3.2 reply (general-public audience: anyone can sign up, consumer GA-pilot app, users pay their own subscription)
- Reply to 4.8 and 5.1.1(v) noting the fixes in the new build
- Submit build 44+ for review

---

## Execution notes

- Tasks 1–5 are code tasks (subagent-executable, sequential). Tasks 6–8 are manual, done with the user — Task 6 can happen in parallel with Tasks 1–5 since it's portal-only.
- Every push to `master` triggers TestFlight + Netlify builds. If the user wants to avoid shipping partial work, hold pushes until Tasks 1–5 are all committed.
- The web Apple button will hard-fail until Task 6 Step 5 (Supabase provider) is configured — deploy order matters only for user-visible correctness, not for build success.
