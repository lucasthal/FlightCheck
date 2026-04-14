// src/components/phaseConstants.ts
import type { AircraftCategory, PhaseCategory } from '../types'

export const PHASE_ICONS: Record<PhaseCategory, string> = {
  preflight: '🔍',
  startup: '🔑',
  taxi: '🛞',
  runup: '⚙️',
  takeoff: '↑',
  climb: '📈',
  cruise: '✈',
  descent: '📉',
  approach: '🎯',
  landing: '⬇',
  shutdown: '🔒',
  emergency: '🚨',
}

export const ACCENT_HEX: Record<AircraftCategory, string> = {
  SEP:        '#38bdf8',
  MEP:        '#a78bfa',
  Turboprop:  '#f59e0b',
  Jet:        '#fb7185',
  Helicopter: '#34d399',
}
