# Phase 1: User Auth + My Fleet — Design Spec

**Date:** 2026-04-29
**Scope:** Supabase authentication gate + per-user aircraft favorites ("My Fleet")
**Phase:** 1 of 2 (Phase 2 covers full checklist customization)

---

## Overview

Add user accounts to FlightCheck. The app requires sign-in to use — no anonymous access. Once signed in, users can favorite aircraft that appear in a "My Fleet" quick-launch strip on the home screen.

---

## Auth Flow

The app performs an auth check on load:
- **Not signed in → LoginScreen** (full page, replaces AircraftSelector)
- **Signed in → AircraftSelector** with My Fleet strip

### LoginScreen

- Centered card layout on a full-page cockpit-themed background
- "Continue with Google" button (primary CTA, top of form)
- Divider, then email + password fields
- "Sign In" / "Create Account" toggle below the form (same screen, no separate page)
- "Forgot password?" link → triggers Supabase password reset email
- On success: auth state updates, app transitions to AircraftSelector

---

## Home Screen Changes

### My Fleet Strip

Inserted between the stats bar and the search box in `AircraftSelector`.

**Empty state (0 favorites):**
> "Tap ★ on any aircraft to add it to your fleet"

**With favorites:**
- Horizontally scrollable row of compact quick-launch cards
- Each card: aircraft name + category color chip
- Tapping a card opens that aircraft's checklist directly

### Star Icon on Aircraft Cards

- Positioned top-right corner of each `AircraftCard`
- Filled amber star (★) when favorited, outline (☆) when not
- Tapping toggles favorite with optimistic UI update (instant visual, syncs to Supabase in background)
- If sync fails, reverts to previous state with a brief error indicator

### Profile in Header

- Small avatar (initials or Google photo) + display name placed in the logo row of the AircraftSelector header (same line as the FlightCheck logo, pushed to the right)
- Tapping opens a dropdown with: display name, Sign Out
- Sign Out clears auth state and returns to LoginScreen

---

## Data Model

### Supabase Tables

```sql
-- Extends auth.users with a display name
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Per-user aircraft favorites
CREATE TABLE favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aircraft_id text NOT NULL,  -- matches Aircraft.id e.g. "cessna-172"
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, aircraft_id)
);
```

### Row-Level Security

```sql
-- profiles: users read/update only their own row
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- favorites: users read/write only their own rows
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favorites" ON favorites
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### Auth Methods

- Email/password (built-in Supabase)
- Google OAuth (configured in Supabase dashboard, no extra service required)

### Profile Creation

A Supabase database trigger creates a `profiles` row automatically when a new `auth.users` row is inserted. Display name defaults to the Google display name (OAuth) or the part of the email before `@` (email/password).

---

## Frontend Architecture

### Environment Variables

```
VITE_SUPABASE_URL=<project url>
VITE_SUPABASE_ANON_KEY=<anon key>
```

Both stored in `.env` (already in `.gitignore`).

### New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client singleton, initialized from env vars |
| `src/hooks/useAuth.ts` | Auth state: `user`, `loading`, `signIn`, `signUp`, `signOut`, `signInWithGoogle` |
| `src/hooks/useFavorites.ts` | `favorites[]`, `toggle(aircraftId)`, `isFavorite(aircraftId)` — optimistic updates |
| `src/components/LoginScreen.tsx` | Full-page login/signup UI |
| `src/components/FleetStrip.tsx` | My Fleet horizontal strip + empty state |

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Auth gate: show `LoginScreen` until `user` is set; pass `user` down |
| `src/components/AircraftSelector.tsx` | Add `FleetStrip` between stats bar and search; add star icon + profile avatar to header |

### Hook Contracts

**`useAuth`**
```ts
{
  user: User | null
  loading: boolean
  signIn: (email, password) => Promise<AuthError | null>
  signUp: (email, password, displayName) => Promise<AuthError | null>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
}
```

**`useFavorites`**
```ts
{
  favorites: string[]        // aircraft IDs
  isFavorite: (id) => boolean
  toggle: (id) => void       // optimistic, syncs to Supabase
  loading: boolean
}
```

---

## Behavior Details

### Auth Gate

`App.tsx` checks `useAuth().loading` first — shows a minimal loading indicator (not the full login screen) while Supabase resolves the session from localStorage. This prevents a flash of the login screen on returning users.

### Optimistic Favorites

`toggle()` updates local state immediately, then fires the Supabase insert/delete. On network error, reverts the local state. This keeps the star icon feel instant on mobile.

### Sign-Up Profile Trigger

A Postgres function runs on `auth.users` insert and creates the corresponding `profiles` row. This avoids a race condition where the app reads `profiles` before the client has a chance to insert it.

---

## Out of Scope (Phase 2)

- Editing checklist item text
- Adding/removing/reordering checklist items
- Custom phases
- Sharing customizations between users

---

## Success Criteria

- [ ] User can create an account with email/password or Google
- [ ] User can sign in and is returned to the aircraft selector
- [ ] User can sign out and is returned to the login screen
- [ ] User can favorite/unfavorite aircraft; favorites persist across sessions
- [ ] My Fleet strip shows favorited aircraft as quick-launch cards
- [ ] Empty My Fleet state is shown for new users
- [ ] App never shows aircraft selector to an unauthenticated user
