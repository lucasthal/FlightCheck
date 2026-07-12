// src/components/phaseConstants.ts
import type { AircraftCategory, PhaseCategory } from '../types'

export const PHASE_ICONS: Record<PhaseCategory, string> = {
  preflight: '',
  startup: '',
  taxi: '',
  runup: '',
  takeoff: '',
  climb: '',
  cruise: '',
  descent: '',
  approach: '',
  landing: '',
  shutdown: '',
  emergency: '',
}

export const ACCENT_VAR: Record<AircraftCategory, string> = {
  SEP:        '--c-cat-sep',
  MEP:        '--c-cat-mep',
  Turboprop:  '--c-cat-tp',
  Jet:        '--c-cat-jet',
  Helicopter: '--c-cat-heli',
}
