# User Auth + My Fleet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase auth (email/password + Google OAuth) and per-user aircraft favorites ("My Fleet" strip) to FlightCheck. App requires sign-in to access.

**Architecture:** `AuthProvider` wraps the app and provides auth state via context. An auth gate in `App.tsx` shows `LoginScreen` until the user is signed in. `useFavorites` syncs per-user aircraft favorites to Supabase with optimistic UI. `AircraftSelector` gains a `FleetStrip` above the search bar and a star icon on each aircraft card.

**Tech Stack:** `@supabase/supabase-js` v2, React 18 context, Tailwind cockpit theme (CSS variables), Lucide React icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/supabase.ts` | Supabase client singleton |
| Create | `src/hooks/useAuth.ts` | `AuthProvider` + `useAuth` hook (context) |
| Create | `src/hooks/useFavorites.ts` | Favorites CRUD with optimistic updates |
| Create | `src/components/LoginScreen.tsx` | Full-page centered login/signup/reset UI |
| Create | `src/components/FleetStrip.tsx` | My Fleet horizontal strip + empty state |
| Modify | `src/App.tsx` | Wrap with `AuthProvider`, add auth gate + loading spinner |
| Modify | `src/components/AircraftSelector.tsx` | Add `FleetStrip`, star icons on cards, profile avatar in header |

---

## Task 1: Supabase Project Setup

> Manual steps — no code yet.

- [ ] **Step 1: Create Supabase project**

  Go to https://supabase.com, sign in, click "New project". Choose a name (e.g. `flightcheck`), set a database password, pick the closest region. Wait for it to provision (~2 min).

- [ ] **Step 2: Copy project credentials**

  In the Supabase dashboard → Settings → API. Copy:
  - **Project URL** (looks like `https://abcdefgh.supabase.co`)
  - **anon public** key (long JWT string)

- [ ] **Step 3: Create `.env` file**

  In the project root (next to `package.json`), create `.env`:

  ```
  VITE_SUPABASE_URL=https://your-project-ref.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

  Verify `.gitignore` already has `.env` listed. If not, add it.

- [ ] **Step 4: Install Supabase client**

  ```bash
  npm install @supabase/supabase-js
  ```

  Expected: package added to `package.json` dependencies.

---

## Task 2: Database Schema + Auto-Profile Trigger

> Run all SQL in Supabase dashboard → SQL Editor → New query.

- [ ] **Step 1: Create `profiles` and `favorites` tables with RLS**

  ```sql
  -- Profiles: one row per user, auto-created on sign-up
  CREATE TABLE profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    created_at   timestamptz DEFAULT now()
  );

  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "own profile" ON profiles
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

  -- Favorites: per-user aircraft references
  CREATE TABLE favorites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    aircraft_id text NOT NULL,
    created_at  timestamptz DEFAULT now(),
    UNIQUE (user_id, aircraft_id)
  );

  ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "own favorites" ON favorites
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```

  Click "Run". Expected: "Success. No rows returned."

- [ ] **Step 2: Create auto-profile trigger**

  ```sql
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
      )
    );
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  ```

  Click "Run". Expected: "Success. No rows returned."

- [ ] **Step 3: Enable Google OAuth (optional — skip to test email/password first)**

  Supabase dashboard → Authentication → Providers → Google → Enable.
  You'll need a Google Cloud OAuth client ID and secret. Follow Supabase's guide at: Authentication → Providers → Google → "How to set up Google OAuth".
  For the authorized redirect URI, add: `https://your-project-ref.supabase.co/auth/v1/callback`

---

## Task 3: Supabase Client

- [ ] **Step 1: Create `src/lib/supabase.ts`**

  ```ts
  import { createClient } from '@supabase/supabase-js'

  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  export const supabase = createClient(url, key)
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add .env.example src/lib/supabase.ts package.json package-lock.json
  git commit -m "feat: add Supabase client and install supabase-js"
  ```

  Note: commit `.env.example` (with placeholder values) not `.env` (with real keys).

  Create `.env.example` first:
  ```
  VITE_SUPABASE_URL=https://your-project-ref.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

---

## Task 4: AuthProvider + useAuth Hook

- [ ] **Step 1: Create `src/hooks/useAuth.ts`**

  ```ts
  import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
  import type { User, AuthError } from '@supabase/supabase-js'
  import { supabase } from '../lib/supabase'

  interface AuthContextValue {
    user: User | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<AuthError | null>
    signUp: (email: string, password: string, displayName: string) => Promise<AuthError | null>
    signOut: () => Promise<void>
    signInWithGoogle: () => Promise<void>
    resetPassword: (email: string) => Promise<AuthError | null>
  }

  const AuthContext = createContext<AuthContextValue | null>(null)

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email: string, password: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error
    }

    const signUp = async (email: string, password: string, displayName: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName } },
      })
      return error
    }

    const signOut = async () => {
      await supabase.auth.signOut()
    }

    const signInWithGoogle = async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    }

    const resetPassword = async (email: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      return error
    }

    return (
      <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword }}>
        {children}
      </AuthContext.Provider>
    )
  }

  export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/useAuth.ts
  git commit -m "feat: add AuthProvider and useAuth hook"
  ```

---

## Task 5: LoginScreen Component

- [ ] **Step 1: Create `src/components/LoginScreen.tsx`**

  ```tsx
  import { useState } from 'react'
  import { AlertCircle } from 'lucide-react'
  import { useAuth } from '../hooks/useAuth'

  type Mode = 'signin' | 'signup' | 'reset'

  export function LoginScreen() {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
    const [mode, setMode] = useState<Mode>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [resetSent, setResetSent] = useState(false)

    const switchMode = (next: Mode) => {
      setMode(next)
      setError(null)
      setResetSent(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSubmitting(true)

      if (mode === 'reset') {
        const err = await resetPassword(email)
        setSubmitting(false)
        if (err) setError(err.message)
        else setResetSent(true)
        return
      }

      const err = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, displayName)

      setSubmitting(false)
      if (err) setError(err.message)
    }

    const inputClass = `w-full px-3 py-2.5 rounded-xl bg-cockpit-bg border border-cockpit-border
      text-cockpit-text-primary text-sm placeholder-cockpit-text-dim
      focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
      transition-all duration-150`

    return (
      <div className="min-h-screen flex items-center justify-center bg-cockpit-bg px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.06),transparent_60%)]" />

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3,15 C5,15 7,12 10,9 L14,15 L22,5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
              Flight<span className="text-cockpit-amber">Check</span>
            </h1>
          </div>

          {/* Card */}
          <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 shadow-cockpit">
            <h2 className="text-lg font-semibold text-cockpit-text-primary mb-1">
              {mode === 'signin' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
              {mode === 'reset' && 'Reset password'}
            </h2>
            <p className="text-xs text-cockpit-text-dim mb-5">
              {mode === 'signin' && 'Welcome back, pilot.'}
              {mode === 'signup' && 'Join FlightCheck to save your fleet.'}
              {mode === 'reset' && "We'll send a reset link to your email."}
            </p>

            {/* Google OAuth — sign in / sign up only */}
            {mode !== 'reset' && (
              <>
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                    bg-cockpit-card border border-cockpit-border text-cockpit-text-primary text-sm
                    hover:border-cockpit-amber/40 transition-all duration-150 mb-4"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-cockpit-border" />
                  <span className="text-xs text-cockpit-text-dim">or</span>
                  <div className="flex-1 h-px bg-cockpit-border" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs text-cockpit-text-dim mb-1">Display name</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                    required placeholder="Your name" className={inputClass} />
                </div>
              )}
              <div>
                <label className="block text-xs text-cockpit-text-dim mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="pilot@example.com" className={inputClass} />
              </div>
              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs text-cockpit-text-dim mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required placeholder="••••••••" className={inputClass} />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              {resetSent && (
                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  Reset link sent — check your email.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-cockpit-amber text-black font-semibold text-sm
                  hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {submitting
                  ? 'Please wait…'
                  : mode === 'signin' ? 'Sign In'
                  : mode === 'signup' ? 'Create Account'
                  : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-cockpit-text-dim">
              {mode === 'signin' && (
                <>
                  <button onClick={() => switchMode('signup')} className="hover:text-cockpit-text-secondary transition-colors">
                    Create account
                  </button>
                  <button onClick={() => switchMode('reset')} className="hover:text-cockpit-text-secondary transition-colors">
                    Forgot password?
                  </button>
                </>
              )}
              {mode === 'signup' && (
                <button onClick={() => switchMode('signin')} className="hover:text-cockpit-text-secondary transition-colors">
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'reset' && (
                <button onClick={() => switchMode('signin')} className="hover:text-cockpit-text-secondary transition-colors">
                  ← Back to sign in
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-cockpit-text-dim mt-4">
            For reference only — always verify against current POH/AFM
          </p>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/LoginScreen.tsx
  git commit -m "feat: add LoginScreen with email/password, Google OAuth, and password reset"
  ```

---

## Task 6: Auth Gate in App.tsx

- [ ] **Step 1: Replace `src/App.tsx` entirely**

  ```tsx
  import { useState } from 'react'
  import type { Aircraft } from './types'
  import { AircraftSelector } from './components/AircraftSelector'
  import { ChecklistView } from './components/ChecklistView'
  import { LoginScreen } from './components/LoginScreen'
  import { AuthProvider, useAuth } from './hooks/useAuth'
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
    const { theme, setTheme } = useTheme()
    const { user, loading } = useAuth()

    const cycleTheme = () => {
      const themes: Theme[] = ['dark', 'night', 'day']
      const idx = themes.indexOf(theme)
      setTheme(themes[(idx + 1) % themes.length])
    }

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

    return (
      <>
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

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

  ```bash
  npm run dev
  ```

  Open http://localhost:5173. Expected: login screen appears (centered card with FlightCheck logo). Console should show no errors. Existing app content is gated.

- [ ] **Step 4: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: add auth gate — app requires sign-in"
  ```

---

## Task 7: useFavorites Hook

- [ ] **Step 1: Create `src/hooks/useFavorites.ts`**

  ```ts
  import { useEffect, useState, useCallback } from 'react'
  import { supabase } from '../lib/supabase'
  import { useAuth } from './useAuth'

  export function useFavorites() {
    const { user } = useAuth()
    const [favorites, setFavorites] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      if (!user) {
        setFavorites([])
        return
      }
      setLoading(true)
      supabase
        .from('favorites')
        .select('aircraft_id')
        .eq('user_id', user.id)
        .then(({ data }) => {
          setFavorites(data?.map((r: { aircraft_id: string }) => r.aircraft_id) ?? [])
          setLoading(false)
        })
    }, [user])

    const toggle = useCallback(async (aircraftId: string) => {
      if (!user) return
      const wasFav = favorites.includes(aircraftId)

      // Optimistic update
      setFavorites(prev =>
        wasFav ? prev.filter(id => id !== aircraftId) : [...prev, aircraftId]
      )

      if (wasFav) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('aircraft_id', aircraftId)
        if (error) setFavorites(prev => [...prev, aircraftId]) // revert
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, aircraft_id: aircraftId })
        if (error) setFavorites(prev => prev.filter(id => id !== aircraftId)) // revert
      }
    }, [user, favorites])

    const isFavorite = useCallback(
      (aircraftId: string) => favorites.includes(aircraftId),
      [favorites]
    )

    return { favorites, loading, toggle, isFavorite }
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/useFavorites.ts
  git commit -m "feat: add useFavorites hook with optimistic Supabase sync"
  ```

---

## Task 8: FleetStrip Component

- [ ] **Step 1: Create `src/components/FleetStrip.tsx`**

  ```tsx
  import { Star } from 'lucide-react'
  import { allAircraft } from '../data'
  import type { Aircraft, AircraftCategory } from '../types'

  const CATEGORY_TEXT: Record<AircraftCategory, string> = {
    SEP:        'text-sky-400',
    MEP:        'text-violet-400',
    Turboprop:  'text-amber-400',
    Jet:        'text-rose-400',
    Helicopter: 'text-emerald-400',
  }

  interface Props {
    favorites: string[]
    onSelect: (aircraft: Aircraft) => void
  }

  export function FleetStrip({ favorites, onSelect }: Props) {
    const fleet = favorites
      .map(id => allAircraft.find(a => a.id === id))
      .filter((a): a is Aircraft => a !== undefined)

    if (fleet.length === 0) {
      return (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-cockpit-card/50 border border-dashed border-cockpit-border/50 rounded-xl text-xs text-cockpit-text-dim">
          <Star className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          <span>Tap ★ on any aircraft to add it to your fleet</span>
        </div>
      )
    }

    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-cockpit-amber uppercase tracking-wider mb-2">
          ★ My Fleet
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {fleet.map(aircraft => (
            <button
              key={aircraft.id}
              onClick={() => onSelect(aircraft)}
              className="flex-shrink-0 flex flex-col items-start gap-0.5 px-3 py-2
                         bg-cockpit-card border border-cockpit-amber/20 rounded-xl
                         hover:border-cockpit-amber/50 transition-all duration-150 min-w-[80px]"
            >
              <span className={`text-xs font-bold leading-tight ${CATEGORY_TEXT[aircraft.category]}`}>
                {aircraft.model}
              </span>
              <span className="text-xs text-cockpit-text-dim leading-tight">{aircraft.category}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/FleetStrip.tsx
  git commit -m "feat: add FleetStrip component with empty state and quick-launch cards"
  ```

---

## Task 9: AircraftSelector — Fleet Strip + Star Icons + Profile Avatar

This is the largest modification. Replace `src/components/AircraftSelector.tsx` with the updated version below. The changes are:
1. Import `useAuth`, `useFavorites`, `FleetStrip`
2. Add profile avatar + dropdown to the logo row
3. Insert `FleetStrip` between stats bar and search input
4. Pass `isFavorite` and `onToggleFavorite` to `AircraftCard`
5. Add star icon to `AircraftCard`

- [ ] **Step 1: Update `src/components/AircraftSelector.tsx`**

  Replace the entire file:

  ```tsx
  import { useState, useRef, useEffect, type ReactNode } from 'react'
  import { allAircraft, aircraftByCategory } from '../data'
  import type { Aircraft, AircraftCategory } from '../types'
  import { Search, Zap, Users, Gauge, ArrowUp, Star, LogOut, ChevronDown } from 'lucide-react'
  import { useAuth } from '../hooks/useAuth'
  import { useFavorites } from '../hooks/useFavorites'
  import { FleetStrip } from './FleetStrip'

  interface Props {
    onSelect: (aircraft: Aircraft) => void
  }

  const CATEGORIES: { key: AircraftCategory | 'All'; label: string; emoji: string }[] = [
    { key: 'All',        label: 'All',       emoji: '✈' },
    { key: 'SEP',        label: 'Single',    emoji: '🛩' },
    { key: 'MEP',        label: 'Multi',     emoji: '🛫' },
    { key: 'Turboprop',  label: 'Turboprop', emoji: '⚡' },
    { key: 'Jet',        label: 'Jet',       emoji: '🚀' },
    { key: 'Helicopter', label: 'Helo',      emoji: '🚁' },
  ]

  const CATEGORY_COLORS: Record<AircraftCategory | 'All', string> = {
    All:        'from-slate-500 to-slate-600',
    SEP:        'from-sky-500 to-blue-600',
    MEP:        'from-violet-500 to-purple-600',
    Turboprop:  'from-amber-500 to-orange-500',
    Jet:        'from-rose-500 to-red-600',
    Helicopter: 'from-emerald-500 to-teal-600',
  }

  const CATEGORY_TEXT: Record<AircraftCategory | 'All', string> = {
    All:        'text-slate-400',
    SEP:        'text-sky-400',
    MEP:        'text-violet-400',
    Turboprop:  'text-amber-400',
    Jet:        'text-rose-400',
    Helicopter: 'text-emerald-400',
  }

  const CATEGORY_BG: Record<AircraftCategory | 'All', string> = {
    All:        'bg-slate-500/10 border-slate-500/20',
    SEP:        'bg-sky-500/10 border-sky-500/20',
    MEP:        'bg-violet-500/10 border-violet-500/20',
    Turboprop:  'bg-amber-500/10 border-amber-500/20',
    Jet:        'bg-rose-500/10 border-rose-500/20',
    Helicopter: 'bg-emerald-500/10 border-emerald-500/20',
  }

  // ── Silhouettes (unchanged from original) ──────────────────────────────
  const CATEGORY_SILHOUETTE: Record<AircraftCategory, ReactNode> = {
    SEP: (
      <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
        <path d="M40 8 L52 20 L70 20 L70 22 L52 22 L50 32 L46 32 L44 22 L16 22 L10 28 L8 28 L12 20 L8 12 L10 12 L16 18 L44 18 L46 8 Z"/>
      </svg>
    ),
    MEP: (
      <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
        <path d="M40 6 L54 18 L72 17 L72 20 L54 20 L52 32 L46 32 L44 20 L36 20 L34 32 L28 32 L26 20 L8 20 L8 17 L26 18 Z"/>
        <circle cx="22" cy="14" r="3"/>
        <circle cx="58" cy="14" r="3"/>
      </svg>
    ),
    Turboprop: (
      <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
        <path d="M38 5 L54 18 L74 17 L74 20 L54 21 L52 33 L46 33 L44 21 L36 21 L34 33 L28 33 L26 21 L6 21 L6 17 L26 18 Z"/>
        <ellipse cx="10" cy="14" rx="2" ry="8"/>
        <ellipse cx="70" cy="14" rx="2" ry="8"/>
      </svg>
    ),
    Jet: (
      <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
        <path d="M44 8 C50 8 58 14 66 20 L76 20 L76 22 L66 22 C58 26 50 28 44 28 L38 28 L36 22 L8 22 L8 19 L36 19 L38 8 Z"/>
        <path d="M50 28 L54 36 L56 36 L52 28 Z"/>
        <path d="M54 8 L56 4 L58 4 L56 8 Z"/>
      </svg>
    ),
    Helicopter: (
      <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
        <ellipse cx="36" cy="20" rx="14" ry="8"/>
        <rect x="10" y="18" width="60" height="2" rx="1"/>
        <rect x="34" y="10" width="4" height="10"/>
        <path d="M34 28 L30 36 L32 36 L36 30 L40 36 L42 36 L38 28 Z"/>
        <rect x="60" y="17" width="14" height="2" rx="1"/>
      </svg>
    ),
  }

  const AIRCRAFT_SILHOUETTE: Record<string, ReactNode> = {
    'cessna-152': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L26,6 L42,6 L42,20 L42,34 L26,34 Z"/><path d="M8,19.5 C12,17.5 22,16.5 50,17 C60,17 67,18.5 71,20 C67,21.5 60,23 50,23 C22,23.5 12,22.5 8,20.5 Z"/><path d="M66,20 L64,16 L72,16 L72,24 L64,24 Z"/><circle cx="8" cy="20" r="1.8"/></svg>),
    'cessna-172': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L25,5 L43,5 L43,20 L43,35 L25,35 Z"/><path d="M8,19 C12,17 22,16 50,17 C60,17 67,18 72,20 C67,22 60,23 50,23 C22,24 12,23 8,21 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="8" cy="20" r="2"/></svg>),
    'cessna-182t': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M26,20 L23,5 L44,5 L44,20 L44,35 L23,35 Z"/><path d="M8,19 C12,17 22,15.5 50,16.5 C60,16.5 67,18 72,20 C67,22 60,23.5 50,23.5 C22,24.5 12,23 8,21 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><circle cx="8" cy="20" r="2"/></svg>),
    'piper-warrior-iii': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L28,7 L44,7 L44,20 L44,33 L28,33 Z"/><path d="M10,18.5 C15,17 24,16 52,17 C62,17 68,18.5 72,20 C68,21.5 62,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="10" cy="20" r="2"/></svg>),
    'piper-pa28-archer': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M29,20 L27,6 L45,6 L45,20 L45,34 L27,34 Z"/><path d="M10,18.5 C15,17 24,16 52,17 C62,17 68,18.5 72,20 C68,21.5 62,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><circle cx="10" cy="20" r="2"/></svg>),
    'cirrus-sr22': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M46,20 L30,8 L52,11 L50,20 L52,29 L30,32 Z"/><path d="M10,19 C16,17 28,16 56,17 C64,17 70,18 73,20 C70,22 64,23 56,23 C28,24 16,23 10,21 Z"/><path d="M68,20 L66,15 L74,15 L74,25 L66,25 Z"/><ellipse cx="38" cy="20" rx="5" ry="2.5"/></svg>),
    'diamond-da40': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M36,20 L30,8 L48,10 L46,20 L48,30 L30,32 Z"/><path d="M8,19.5 C12,18 22,17 52,17.5 C62,17.5 68,18.5 72,20 C68,21.5 62,22.5 52,22.5 C22,23 12,22 8,20.5 Z"/><path d="M68,20 L65,13 L75,13 L75,27 L65,27 Z"/></svg>),
    'beech-bonanza-g36': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M34,20 L30,8 L48,10 L46,20 L48,30 L30,32 Z"/><path d="M10,19 C14,17 24,16 54,17 C63,17 69,18.5 72,20 C69,21.5 63,23 54,23 C24,24 14,23 10,21 Z"/><path d="M68,20 L64,14 L73,18 Z"/><path d="M68,20 L64,26 L73,22 Z"/></svg>),
    'mooney-m20v': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M36,20 L32,9 L46,10 L44,20 L46,30 L32,31 Z"/><path d="M8,19.5 C12,18.5 24,17.5 54,18 C63,18 69,19 72,20 C69,21 63,22 54,22 C24,22.5 12,21.5 8,20.5 Z"/><path d="M67,20 L65,16 L73,16 L73,24 L65,24 Z"/></svg>),
    'piper-seminole': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M32,20 L28,7 L46,9 L44,20 L46,31 L28,33 Z"/><ellipse cx="30" cy="12" rx="5" ry="2"/><ellipse cx="30" cy="28" rx="5" ry="2"/><path d="M10,18.5 C15,17 24,16 52,17 C61,17 67,18.5 71,20 C67,21.5 61,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M66,20 L64,13 L73,13 L73,27 L64,27 Z"/></svg>),
    'beech-baron-g58': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L26,6 L48,8 L46,20 L48,32 L26,34 Z"/><ellipse cx="27" cy="11" rx="6" ry="2.5"/><ellipse cx="27" cy="29" rx="6" ry="2.5"/><path d="M10,18 C15,16 25,15 52,16 C62,16 68,18 72,20 C68,22 62,24 52,24 C25,25 15,24 10,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/></svg>),
    'cessna-208b-caravan': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M26,20 L22,5 L46,5 L46,20 L46,35 L22,35 Z"/><path d="M8,18 C12,15.5 22,14.5 50,15.5 C60,15.5 67,17.5 72,20 C67,22.5 60,24.5 50,24.5 C22,25.5 12,24.5 8,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><path d="M4,19 L8,17 L8,23 L4,21 Z"/></svg>),
    'daher-tbm-960': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M40,20 L26,8 L50,11 L48,20 L50,29 L26,32 Z"/><path d="M8,19 C12,17 24,16 58,17 C65,17 70,18 74,20 C70,22 65,23 58,23 C24,24 12,23 8,21 Z"/><path d="M69,20 L67,13 L76,13 L76,27 L67,27 Z"/><path d="M4,19.5 L8,18 L8,22 L4,20.5 Z"/></svg>),
    'pilatus-pc12-ngx': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M34,20 L28,7 L50,9 L48,20 L50,31 L28,33 Z"/><path d="M8,18 C12,15.5 22,14.5 54,15.5 C63,15.5 69,17.5 73,20 C69,22.5 63,24.5 54,24.5 C22,25.5 12,24.5 8,22 Z"/><path d="M68,20 L66,13 L75,13 L75,27 L66,27 Z"/><path d="M4,19.5 L8,17.5 L8,22.5 L4,20.5 Z"/></svg>),
    'king-air-c90': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L25,6 L47,8 L45,20 L47,32 L25,34 Z"/><path d="M17,9 L30,10.5 L30,13.5 L17,13 Z"/><path d="M17,27 L30,26.5 L30,29.5 L17,31 Z"/><circle cx="16" cy="11" r="2.5"/><circle cx="16" cy="29" r="2.5"/><path d="M10,18 C15,16 26,15 54,16 C63,16 69,18 72,20 C69,22 63,24 54,24 C26,25 15,24 10,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/></svg>),
    'king-air-b200gt': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L23,6 L49,8 L47,20 L49,32 L23,34 Z"/><path d="M23,10 L21,8 L23,6 Z"/><path d="M23,30 L21,32 L23,34 Z"/><path d="M15,9 L28,10.5 L28,13.5 L15,13 Z"/><path d="M15,27 L28,26.5 L28,29.5 L15,31 Z"/><circle cx="14" cy="11" r="2.5"/><circle cx="14" cy="29" r="2.5"/><path d="M10,18 C15,16 26,15 54,16 C64,16 70,18 73,20 C70,22 64,24 54,24 C26,25 15,24 10,22 Z"/><path d="M68,20 L66,12 L75,12 L75,28 L66,28 Z"/></svg>),
    'cessna-citation-cj4': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M44,20 L32,7 L50,10 L48,20 L50,30 L32,33 Z"/><ellipse cx="60" cy="14" rx="8" ry="2.5" transform="rotate(-8,60,14)"/><ellipse cx="60" cy="26" rx="8" ry="2.5" transform="rotate(8,60,26)"/><path d="M8,19 C14,17 30,16 62,17 C67,17 71,18 74,20 C71,22 67,23 62,23 C30,24 14,23 8,21 Z"/><path d="M70,20 L68,13 L76,13 L76,27 L68,27 Z"/></svg>),
    'embraer-phenom-300e': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M42,20 L28,6 L52,10 L49,20 L52,30 L28,34 Z"/><ellipse cx="58" cy="13" rx="9" ry="3"/><ellipse cx="58" cy="27" rx="9" ry="3"/><path d="M8,18 C14,16 30,15 60,16 C67,16 71,18 74,20 C71,22 67,24 60,24 C30,25 14,24 8,22 Z"/><path d="M70,20 L67,12 L76,12 L76,28 L67,28 Z"/></svg>),
    'robinson-r44-raven-ii': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><rect x="18" y="18.5" width="36" height="3" rx="1.5"/><rect x="33.5" y="2" width="3" height="36" rx="1.5"/><ellipse cx="35" cy="20" rx="10" ry="7"/><rect x="44" y="18.5" width="28" height="3" rx="1"/><ellipse cx="72" cy="20" rx="2" ry="7"/></svg>),
  }

  export function AircraftSelector({ onSelect }: Props) {
    const { user, signOut } = useAuth()
    const { favorites, toggle, isFavorite } = useFavorites()
    const [filter, setFilter] = useState<AircraftCategory | 'All'>('All')
    const [search, setSearch] = useState('')
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    // Close profile dropdown when clicking outside
    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
          setProfileOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const filtered = allAircraft.filter(a => {
      const matchesCategory = filter === 'All' || a.category === filter
      const q = search.toLowerCase()
      const matchesSearch = !q || [a.name, a.manufacturer, a.model, a.description]
        .some(s => s.toLowerCase().includes(q))
      return matchesCategory && matchesSearch
    })

    const categoryCount = (cat: AircraftCategory | 'All') =>
      cat === 'All' ? allAircraft.length : (aircraftByCategory[cat as AircraftCategory]?.length ?? 0)

    const displayName = user?.user_metadata?.full_name as string | undefined
      ?? user?.email?.split('@')[0]
      ?? 'Pilot'

    const initials = displayName.slice(0, 2).toUpperCase()
    const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

    return (
      <div className="min-h-screen flex flex-col bg-cockpit-bg">
        <header className="relative overflow-hidden border-b border-cockpit-border/40">
          <div className="absolute inset-0 bg-gradient-to-b from-cockpit-amber/5 via-cockpit-panel to-cockpit-bg" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_70%)]" />

          <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-6 safe-top">
            {/* Logo row + profile */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3,15 C5,15 7,12 10,9 L14,15 L22,5"/>
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
                    Flight<span className="text-cockpit-amber">Check</span>
                  </h1>
                  <p className="text-xs text-cockpit-text-dim">Best in class Pilot's checklist</p>
                </div>
              </div>

              {/* Profile avatar + dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-cockpit-border/50
                             bg-cockpit-card/50 hover:border-cockpit-amber/30 transition-all duration-150"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center text-black text-xs font-bold">
                      {initials}
                    </div>
                  )}
                  <span className="text-xs text-cockpit-text-secondary hidden sm:block max-w-[100px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-cockpit-text-dim" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-cockpit-panel border border-cockpit-border rounded-xl shadow-cockpit z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-cockpit-border/50">
                      <p className="text-xs font-semibold text-cockpit-text-primary truncate">{displayName}</p>
                      <p className="text-xs text-cockpit-text-dim truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); signOut() }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cockpit-text-secondary
                                 hover:bg-cockpit-card hover:text-cockpit-text-primary transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 mt-4 mb-5">
              {CATEGORIES.filter(c => c.key !== 'All').map(cat => {
                const count = categoryCount(cat.key)
                if (count === 0) return null
                return (
                  <div key={cat.key} className="flex items-center gap-1.5 text-xs">
                    <span>{cat.emoji}</span>
                    <span className={`font-semibold ${CATEGORY_TEXT[cat.key]}`}>{count}</span>
                    <span className="text-cockpit-text-dim">{cat.label}</span>
                  </div>
                )
              })}
            </div>

            {/* My Fleet strip */}
            <FleetStrip favorites={favorites} onSelect={onSelect} />

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-dim" />
              <input
                type="search"
                placeholder="Search by aircraft, manufacturer, or type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-cockpit-card border border-cockpit-border
                           text-cockpit-text-primary placeholder-cockpit-text-dim text-sm
                           focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                           transition-all duration-150"
              />
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => {
                const isActive = filter === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => setFilter(cat.key)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150
                      ${isActive
                        ? `bg-gradient-to-r ${CATEGORY_COLORS[cat.key]} text-white border-transparent shadow-lg`
                        : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary hover:border-cockpit-border hover:text-cockpit-text-primary'
                      }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    <span className={`text-xs ${isActive ? 'text-white/70' : 'text-cockpit-text-dim'}`}>
                      {categoryCount(cat.key)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-cockpit-text-dim">
              <div className="text-5xl mb-4">✈</div>
              <p className="font-semibold text-cockpit-text-secondary">No aircraft found</p>
              <p className="text-sm mt-1">Try a different search or category filter</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-cockpit-text-dim mb-3 font-medium">
                {filtered.length} aircraft · tap to open checklist
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(aircraft => (
                  <AircraftCard
                    key={aircraft.id}
                    aircraft={aircraft}
                    onSelect={onSelect}
                    isFavorite={isFavorite(aircraft.id)}
                    onToggleFavorite={() => toggle(aircraft.id)}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        <footer className="safe-bottom py-4 text-center text-cockpit-text-dim text-xs border-t border-cockpit-border/20 pb-20 lg:pb-4">
          For reference only — always verify against current POH/AFM
        </footer>
      </div>
    )
  }

  interface CardProps {
    aircraft: Aircraft
    onSelect: (a: Aircraft) => void
    isFavorite: boolean
    onToggleFavorite: () => void
  }

  function AircraftCard({ aircraft, onSelect, isFavorite, onToggleFavorite }: CardProps) {
    const normalPhases = aircraft.phases.filter(p => p.category !== 'emergency')
    const emergencyPhases = aircraft.phases.filter(p => p.category === 'emergency')
    const cat = aircraft.category

    return (
      <div className="aircraft-card group relative overflow-hidden">
        {/* Background silhouette */}
        <div className={`absolute right-2 top-2 w-32 h-16 ${CATEGORY_TEXT[cat]}`}>
          {AIRCRAFT_SILHOUETTE[aircraft.id] ?? CATEGORY_SILHOUETTE[cat]}
        </div>

        {/* Star toggle — top right, above silhouette */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          className="absolute top-2.5 right-2.5 z-10 p-1 rounded-lg transition-colors
                     hover:bg-cockpit-bg/80"
          title={isFavorite ? 'Remove from fleet' : 'Add to fleet'}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              isFavorite ? 'text-cockpit-amber fill-cockpit-amber' : 'text-cockpit-text-dim'
            }`}
          />
        </button>

        {/* Card content — clicking opens checklist */}
        <button onClick={() => onSelect(aircraft)} className="w-full text-left block">
          <div className="mb-2 relative">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${CATEGORY_BG[cat]} ${CATEGORY_TEXT[cat]}`}>
              {cat}
            </span>
          </div>
          <h2 className={`font-bold text-base leading-tight text-cockpit-text-primary group-hover:${CATEGORY_TEXT[cat]} transition-colors mb-0.5`}>
            {aircraft.name}
          </h2>
          <p className="text-xs text-cockpit-text-dim font-mono mb-2">{aircraft.manufacturer} · {aircraft.model}</p>
          <p className="text-xs text-cockpit-text-secondary leading-relaxed mb-3 line-clamp-2 relative">
            {aircraft.description}
          </p>
          <div className="flex flex-wrap gap-2 mb-3 relative">
            <MiniSpec icon={<Zap className="w-3 h-3" />} value={aircraft.specs.engineType.split('(')[0].trim()} />
            <MiniSpec icon={<Users className="w-3 h-3" />} value={`${aircraft.specs.seats} seats`} />
            {aircraft.specs.maxSpeed && (
              <MiniSpec icon={<Gauge className="w-3 h-3" />} value={aircraft.specs.maxSpeed} />
            )}
            {aircraft.specs.ceiling && (
              <MiniSpec icon={<ArrowUp className="w-3 h-3" />} value={aircraft.specs.ceiling} />
            )}
          </div>
          <div className="flex items-center gap-3 pt-2.5 border-t border-cockpit-border/40 text-xs text-cockpit-text-dim relative">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_TEXT[cat].replace('text-', 'bg-')}`} />
              {normalPhases.length} checklists
            </span>
            {emergencyPhases.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {emergencyPhases.length} emergency
              </span>
            )}
            <span className="ml-auto text-cockpit-text-dim">
              {aircraft.phases.reduce((s, p) => s + p.items.length, 0)} items
            </span>
          </div>
        </button>
      </div>
    )
  }

  function MiniSpec({ icon, value }: { icon: ReactNode; value: string }) {
    return (
      <span className="flex items-center gap-1 text-xs text-cockpit-text-dim bg-cockpit-bg/80 px-2 py-1 rounded-lg border border-cockpit-border/30">
        {icon}
        <span className="text-cockpit-text-secondary">{value}</span>
      </span>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 3: Smoke test in browser**

  ```bash
  npm run dev
  ```

  Open http://localhost:5173. Sign in with an account. Verify:
  - Profile avatar appears in the header logo row (top-right)
  - My Fleet strip shows the empty state ("Tap ★ on any aircraft…")
  - Star icons appear on each aircraft card
  - Tapping a star fills it amber immediately (optimistic update)
  - Tapping the profile avatar opens the dropdown with email + Sign Out
  - Tapping Sign Out returns to the login screen
  - Refreshing the page while signed in goes directly to the aircraft selector (no login flash)
  - Tapping a card in My Fleet opens that aircraft's checklist

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/AircraftSelector.tsx
  git commit -m "feat: add My Fleet strip, star icons, and profile avatar to AircraftSelector"
  ```

---

## Task 10: Final Verification Against Success Criteria

- [ ] **User can create an account with email/password**
  Sign out → Create account → fill email, password, display name → Create Account. Check Supabase dashboard → Authentication → Users for the new row. Check `profiles` table for the auto-created row.

- [ ] **User can create an account with Google**
  (Requires Google OAuth configured in Task 2 Step 3.) Sign out → Continue with Google → authorize → redirected back to app, signed in.

- [ ] **User can sign in and is returned to the aircraft selector**
  Sign in with known credentials → lands on AircraftSelector with My Fleet strip.

- [ ] **User can sign out and is returned to login screen**
  Profile dropdown → Sign Out → LoginScreen appears.

- [ ] **Favorites persist across sessions**
  Star 2-3 aircraft → refresh browser → My Fleet strip shows the same aircraft.

- [ ] **My Fleet empty state for new users**
  Create a new account → My Fleet shows "Tap ★ on any aircraft to add it to your fleet."

- [ ] **App never shows aircraft selector to unauthenticated user**
  Open browser in incognito → should see LoginScreen, not AircraftSelector.

- [ ] **Commit final state**

  ```bash
  git add -A
  git commit -m "feat: Phase 1 complete — user auth and My Fleet"
  ```
