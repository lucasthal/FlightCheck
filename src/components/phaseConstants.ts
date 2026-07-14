// src/components/phaseConstants.ts
import type { PhaseCategory } from '../types'

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
