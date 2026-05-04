# Fix Google Sign-In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Continue with Google" button functional by surfacing OAuth errors in the UI and correctly configuring the Google provider in Supabase and Google Cloud Console.

**Architecture:** The code path is already correct (`supabase.auth.signInWithOAuth` → Google OAuth redirect). The bug is two-fold: (1) errors are silently swallowed so the button appears dead, and (2) the Google provider is not configured in Supabase / Google Cloud Console. Fix the code first so errors are visible, then complete the configuration.

**Tech Stack:** Supabase Auth, Google Cloud Console OAuth 2.0, React, TypeScript

---

## File Map

| File | What changes |
|---|---|
| `src/hooks/useAuth.tsx` | `signInWithGoogle` returns `Promise<AuthError \| null>` instead of `Promise<void>` |
| `src/components/LoginScreen.tsx` | Google button `onClick` handles the returned error |

---

## Task 1: Surface errors from `signInWithGoogle`

**Files:**
- Modify: `src/hooks/useAuth.tsx`
- Modify: `src/components/LoginScreen.tsx`

- [ ] **Step 1.1 — Update the `AuthContextValue` interface in `src/hooks/useAuth.tsx`**

  At line 16, change:

  ```ts
  signInWithGoogle: () => Promise<void>
  ```

  To:

  ```ts
  signInWithGoogle: () => Promise<import('@supabase/supabase-js').AuthError | null>
  ```

- [ ] **Step 1.2 — Update the `signInWithGoogle` implementation in `src/hooks/useAuth.tsx`**

  Replace lines 57-61:

  ```ts
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }
  ```

  With:

  ```ts
  const signInWithGoogle = async (): Promise<import('@supabase/supabase-js').AuthError | null> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error
  }
  ```

- [ ] **Step 1.3 — Update the Google button `onClick` in `src/components/LoginScreen.tsx`**

  At line 131, the button currently has `onClick={signInWithGoogle}`. Replace the entire button element:

  ```tsx
  <button
    onClick={async () => {
      setError(null)
      setSubmitting(true)
      const err = await signInWithGoogle()
      setSubmitting(false)
      if (err) setError(err.message)
    }}
    disabled={submitting}
    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
      bg-cockpit-card border border-cockpit-border text-cockpit-text-primary text-sm
      hover:border-cockpit-amber/40 transition-all duration-150 mb-4 disabled:opacity-50"
  >
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
    Continue with Google
  </button>
  ```

- [ ] **Step 1.4 — Type-check**

  Run:
  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

---

## Task 2: Configure Google provider in Supabase

These are dashboard steps — no code changes.

- [ ] **Step 2.1 — Open Supabase Auth providers**

  Go to: `https://supabase.com/dashboard/project/<your-project-ref>/auth/providers`

  Scroll to **Google** and expand it.

- [ ] **Step 2.2 — Enable the Google provider**

  Toggle **Enable Sign in with Google** to ON. Leave the page open — you need the **Callback URL** shown here. It looks like:

  ```
  https://<project-ref>.supabase.co/auth/v1/callback
  ```

  Copy this URL — you'll paste it into Google Cloud Console in Task 3.

- [ ] **Step 2.3 — Get a Google OAuth Client ID and Secret (continue to Task 3 first)**

  You need a **Client ID** and **Client Secret** from Google Cloud Console before you can save this page. Complete Task 3, then return here to paste them in and click **Save**.

---

## Task 3: Configure Google Cloud Console

- [ ] **Step 3.1 — Open Google Cloud Console**

  Go to: `https://console.cloud.google.com/`

  Select your project (or create one for FlightCheck).

- [ ] **Step 3.2 — Enable the Google Identity API**

  Navigate to: **APIs & Services → Library**

  Search for **"Google Identity"** or **"People API"**, enable it if not already.

- [ ] **Step 3.3 — Configure the OAuth consent screen**

  Navigate to: **APIs & Services → OAuth consent screen**

  - User Type: **External** (unless you have a Google Workspace org)
  - App name: `FlightCheck`
  - User support email: your email
  - Developer contact email: your email
  - Scopes: add `email` and `profile` (standard OpenID scopes)
  - Save and continue through all steps.

- [ ] **Step 3.4 — Create an OAuth 2.0 Client ID**

  Navigate to: **APIs & Services → Credentials → Create Credentials → OAuth Client ID**

  - Application type: **Web application**
  - Name: `FlightCheck Web`
  - **Authorized JavaScript origins** — add both:
    ```
    http://localhost:5173
    https://<your-production-domain>
    ```
  - **Authorized redirect URIs** — add the Supabase callback URL from Step 2.2:
    ```
    https://<project-ref>.supabase.co/auth/v1/callback
    ```
  - Click **Create**.

- [ ] **Step 3.5 — Copy Client ID and Secret**

  The dialog shows your **Client ID** and **Client Secret**. Copy both.

- [ ] **Step 3.6 — Paste into Supabase and save**

  Return to the Supabase Auth Providers page (from Step 2.1).

  Paste the **Client ID** and **Client Secret** into the Google provider fields. Click **Save**.

---

## Task 4: Test and commit

- [ ] **Step 4.1 — Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 4.2 — Test Google sign-in on desktop**

  Open `http://localhost:5173`. Click **Continue with Google**. Verify:
  - Google OAuth popup/redirect opens
  - After selecting a Google account, you are redirected back and signed in
  - No error message appears

- [ ] **Step 4.3 — Test error display**

  Temporarily break the redirect URI (e.g., change `redirectTo` to `'http://bad-url'`) and verify the error message appears in the UI. Revert the change.

- [ ] **Step 4.4 — Commit**

  ```bash
  git add src/hooks/useAuth.tsx src/components/LoginScreen.tsx
  git commit -m "fix: surface Google OAuth errors and wire disabled state to Google button"
  ```
