export type ItemSeverity = 'normal' | 'warning' | 'caution' | 'note'

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

export type ViewMode = 'home' | 'checklist' | 'emergency'
