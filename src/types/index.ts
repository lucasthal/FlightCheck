export type ItemSeverity = 'normal' | 'warning' | 'caution' | 'note' | 'setup'

export interface ChecklistItem {
  id: string
  action: string
  response?: string
  note?: string
  severity?: ItemSeverity
  subItems?: string[]
}

export type PhaseCategory =
  | 'preflight'
  | 'startup'
  | 'taxi'
  | 'runup'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'shutdown'
  | 'emergency'

export interface ChecklistPhase {
  id: string
  name: string
  category: PhaseCategory
  items: ChecklistItem[]
}

export type AircraftCategory = 'SEP' | 'MEP' | 'Turboprop' | 'Jet' | 'Helicopter'

export type ReferenceSection =
  | { kind: 'speeds';   title: string; items: Record<string, string> }
  | { kind: 'maneuver'; title: string; steps: string[]; standards?: string[] }
  | { kind: 'table';    title: string; columns: string[]; rows: (string | number)[][]; notes?: string[] }
  | { kind: 'keyval';   title: string; items: Record<string, string> }

export interface Aircraft {
  id: string
  name: string
  manufacturer: string
  model: string
  category: AircraftCategory
  description: string
  specs: {
    engines: number
    engineType: string
    maxSpeed?: string
    range?: string
    ceiling?: string
    seats: number
  }
  vSpeeds: Record<string, string>
  referenceData: ReferenceSection[]
  phases: ChecklistPhase[]
}

export interface ChecklistState {
  aircraftId: string
  phaseId: string
  checkedItems: Record<string, boolean>
  startedAt: string
  completedPhases: string[]
}

export interface ProfileItem {
  id: string
  action: string
  response?: string
  note?: string
  severity?: ItemSeverity
  position: number
}

export interface ProfilePhase {
  id: string
  title: string
  category: PhaseCategory
  position: number
  items: ProfileItem[]
}

export interface Profile {
  id: string
  name: string
  aircraft_id: string
  is_active: boolean
  phases: ProfilePhase[]
}

export type ViewMode = 'home' | 'checklist' | 'emergency'

// ── User Preferences ─────────────────────────────────────────────
export type Theme    = 'dark' | 'night' | 'day'
export type TextSize = 'sm' | 'md' | 'lg' | 'xl'

export interface UserPreferences {
  theme:               Theme
  text_size:           TextSize
  keep_screen_awake:   boolean
  default_aircraft_id: string | null
  autoscroll:          boolean
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme:               'dark',
  text_size:           'md',
  keep_screen_awake:   false,
  default_aircraft_id: null,
  autoscroll:          true,
}
