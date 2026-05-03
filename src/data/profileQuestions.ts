import type { PhaseCategory } from '../types'

export interface ProfileQuestion {
  id: string
  label: string
  description: string
  injections: Array<{
    targetCategory: PhaseCategory
    fallbackCategory?: PhaseCategory
    action: string
    response: string
  }>
}

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: 'pfd_mfd',
    label: 'PFD / MFD avionics cross-check',
    description: 'Confirms both displays are communicating and sharing sensor data',
    injections: [{
      targetCategory: 'startup',
      fallbackCategory: 'taxi',
      action: 'PFD / MFD — CROSS-CHECK',
      response: 'CONFIRMED',
    }],
  },
  {
    id: 'gps_integrity',
    label: 'GPS integrity check',
    description: 'Verifies GPS/RAIM availability before departure',
    injections: [{
      targetCategory: 'startup',
      fallbackCategory: 'taxi',
      action: 'GPS integrity / RAIM',
      response: 'CHECKED',
    }],
  },
  {
    id: 'avionics_config',
    label: 'Avionics configuration verification',
    description: 'Confirms FMS and avionics fields are configured for the flight',
    injections: [{
      targetCategory: 'startup',
      fallbackCategory: 'taxi',
      action: 'Avionics / FMS configuration',
      response: 'VERIFIED',
    }],
  },
]
