# Phase 2: Checklist Customization — Design Spec

**Date:** 2026-05-01
**Scope:** Per-user named checklist profiles — edit, add, delete, and reorder items and phases
**Phase:** 2 of 2

---

## Overview

Users can create named checklist profiles for any aircraft. A profile is a full copy of the original POH checklist stored in Supabase. Users can edit item text, add/remove items, reorder items, and manage phases. The original POH checklist is always read-only and available as a reset baseline.

---

## Core Rules

- **Original is read-only.** Tapping Edit on the original forces a Save As — the user must name a new profile before any changes are stored.
- **One active profile per aircraft.** At most one profile is `is_active = true` per user+aircraft. If none is active, the app uses the original static data.
- **Save vs Save As.** On a custom profile, Save overwrites the current profile. Save As creates a new named copy and activates it.
- **Personal only (Phase 2).** All profiles are private to the user. Sharing and public templates are out of scope but the data model supports it (ownership is built in).

---

## UX Flows

### Opening a checklist
- No active profile → loads original static data, header shows "Original (POH)"
- Active profile exists → loads from Supabase, header shows the profile name

### Entering edit mode
- **On Original:** Tap Edit → Save As dialog appears (required). User enters a name → app copies the full checklist into Supabase → enters edit mode.
- **On custom profile:** Tap Edit → enters edit mode directly.

### In edit mode
- Each item shows: drag handle (reorder), pencil button (rename), delete button
- Phase headers show: drag handle (reorder phases), pencil (rename phase), delete phase
- "＋ Add item" row at the bottom of each phase
- "＋ Add phase" button below all phases
- Toolbar shows: **Save**, **Save As**, **Discard** buttons
- Discard prompts confirmation if there are unsaved changes

### Profile picker (in checklist header)
- Dropdown listing "Original (POH)" + all named profiles for that aircraft
- Active profile is highlighted
- Switching profile exits edit mode first (with unsaved-changes confirmation if needed)
- "＋ Save As new profile…" option at the bottom
- "Reset to original" link on a custom profile — confirms, deletes profile, reverts to original

### Checked progress on profile switch
- Progress state (checked items, completed phases) is keyed by item ID
- Profile items have their own UUIDs → switching profiles naturally resets progress

---

## Data Model

### Supabase Tables

```sql
-- Named profile: a user's saved version of one aircraft's checklist
CREATE TABLE checklist_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aircraft_id text NOT NULL,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, aircraft_id, name)
);

-- Phases in a profile (ordered by position)
CREATE TABLE profile_phases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES checklist_profiles(id) ON DELETE CASCADE,
  position   integer NOT NULL,
  title      text NOT NULL,
  category   text NOT NULL   -- matches PhaseCategory: 'preflight' | 'startup' | ... | 'emergency'
);

-- Items in a phase (ordered by position)
CREATE TABLE profile_items (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES profile_phases(id) ON DELETE CASCADE,
  position integer NOT NULL,
  action   text NOT NULL,
  response text,             -- optional (e.g. "CHECK" / "SET")
  note     text,             -- optional
  severity text              -- 'normal' | 'warning' | 'caution' | 'note' — preserved on copy, not editable in Phase 2
);
```

### Row-Level Security

```sql
ALTER TABLE checklist_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profiles" ON checklist_profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE profile_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phases" ON profile_phases
  USING (profile_id IN (SELECT id FROM checklist_profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM checklist_profiles WHERE user_id = auth.uid()));

ALTER TABLE profile_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON profile_items
  USING (phase_id IN (
    SELECT pp.id FROM profile_phases pp
    JOIN checklist_profiles cp ON cp.id = pp.profile_id
    WHERE cp.user_id = auth.uid()
  ))
  WITH CHECK (phase_id IN (
    SELECT pp.id FROM profile_phases pp
    JOIN checklist_profiles cp ON cp.id = pp.profile_id
    WHERE cp.user_id = auth.uid()
  ));
```

### Active Profile Constraint

Only one profile per user+aircraft can be `is_active = true`. Enforced via a Postgres partial unique index:

```sql
CREATE UNIQUE INDEX one_active_profile_per_aircraft
  ON checklist_profiles (user_id, aircraft_id)
  WHERE is_active = true;
```

---

## Frontend Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useProfiles.ts` | Fetch all profiles for an aircraft; create (copy from Aircraft), delete, rename, set active |
| `src/hooks/useProfileEditor.ts` | In-memory edit state: pending add/delete/rename/reorder — writes to Supabase on Save |
| `src/components/ProfilePicker.tsx` | Dropdown in checklist header: active profile name, all profiles, Save As, Reset to original |
| `src/components/SaveAsDialog.tsx` | Name-entry modal shown when editing original or choosing Save As |

### Modified Files

| File | Change |
|------|--------|
| `src/components/ChecklistView.tsx` | Add Edit toggle + ProfilePicker in header; feed active profile data into checklist |
| `src/components/ChecklistItems.tsx` | Conditional drag handles, pencil, delete buttons and Add Item row in edit mode |

### New Dependency

`@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop for item and phase reordering (React 18 compatible).

### Hook Contracts

**`useProfiles(aircraftId: string)`**
```ts
{
  profiles: Profile[]          // all profiles for this aircraft
  activeProfile: Profile | null
  loading: boolean
  createFromAircraft: (aircraft: Aircraft, name: string) => Promise<Profile>
  createFromProfile: (profile: Profile, name: string) => Promise<Profile>
  deleteProfile: (profileId: string) => Promise<void>
  renameProfile: (profileId: string, name: string) => Promise<void>
  setActive: (profileId: string | null) => Promise<void>  // null = deactivate current (keeps profile, shows original)
  // Note: "Reset to original" in the UI calls deleteProfile(activeProfile.id), not setActive(null)
}

interface Profile {
  id: string
  name: string
  is_active: boolean
  phases: ProfilePhase[]
}

interface ProfilePhase {
  id: string
  title: string
  category: string
  position: number
  items: ProfileItem[]
}

interface ProfileItem {
  id: string
  action: string
  response?: string
  note?: string
  position: number
}
```

**`useProfileEditor(profile: Profile | null)`**
```ts
{
  phases: ProfilePhase[]         // current in-memory state (starts as profile copy)
  isDirty: boolean               // true if unsaved changes exist
  addItem: (phaseId: string, item: Omit<ProfileItem, 'id' | 'position'>) => void
  updateItem: (phaseId: string, itemId: string, patch: Partial<ProfileItem>) => void
  deleteItem: (phaseId: string, itemId: string) => void
  reorderItems: (phaseId: string, newOrder: string[]) => void  // array of item IDs
  addPhase: (phase: Omit<ProfilePhase, 'id' | 'position' | 'items'>) => void
  updatePhase: (phaseId: string, patch: Partial<Pick<ProfilePhase, 'title' | 'category'>>) => void
  deletePhase: (phaseId: string) => void
  reorderPhases: (newOrder: string[]) => void  // array of phase IDs
  save: (profileId: string) => Promise<void>   // writes all phases+items to Supabase
  reset: () => void                            // discard all pending changes
}
```

### Data Flow

`useProfiles` fetches the active profile. When active, it constructs an `Aircraft`-shaped object with the profile's phases/items substituted in (specs, vSpeeds, referenceData unchanged from original). `ChecklistView` and `useChecklist` receive this object and work without modification.

`useProfileEditor` is only active during edit mode. It holds the pending changes in local state. On Save it writes the final phases and items to Supabase, then triggers a re-fetch in `useProfiles`.

---

## Behavior Details

### Copy on Save As

When a user saves as from the original, the app:
1. Creates a `checklist_profiles` row
2. Inserts all phases from `aircraft.phases` as `profile_phases` rows (preserving order)
3. Inserts all items from each phase as `profile_items` rows (preserving order, mapping ChecklistItem fields)
4. Sets the new profile as `is_active = true` and sets any previous active profile to `is_active = false` — both in a single Supabase `rpc` call to keep the unique index constraint satisfied atomically

### Saving Edits

On Save, `useProfileEditor.save()`:
1. Deletes all existing `profile_phases` (cascade deletes items)
2. Re-inserts the full current phase+item tree with updated positions
3. Updates `checklist_profiles.updated_at`

Simple full-replace avoids complex diff logic.

### Unsaved Changes Guard

Before any action that would lose edits (switching profile, tapping Back, tapping Discard), the app checks `isDirty`. If true, shows a confirmation sheet: "You have unsaved changes. Save, Discard, or Cancel."

---

## Out of Scope

- Sharing profiles with other users (Phase 3)
- Publishing public templates
- Editing vSpeeds or reference data
- Per-profile aircraft nickname (display name always comes from the static Aircraft record)

---

## Success Criteria

- [ ] User can Save As from original to create a named profile
- [ ] User can edit item text in a custom profile
- [ ] User can add and delete items
- [ ] User can reorder items within a phase via drag-and-drop
- [ ] User can rename, add, delete, and reorder phases
- [ ] Save persists all changes to Supabase
- [ ] Save As creates a new named copy and activates it
- [ ] Profile picker shows all profiles and allows switching
- [ ] Reset to original deletes the profile and reverts to POH data
- [ ] Original checklist is never modified
- [ ] Unsaved changes prompt appears when navigating away with pending edits
