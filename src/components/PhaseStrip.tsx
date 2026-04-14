// src/components/PhaseStrip.tsx
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { AircraftCategory, ChecklistPhase } from '../types'
import { PHASE_ICONS, ACCENT_HEX } from './phaseConstants'

interface Props {
  normalPhases: ChecklistPhase[]
  emergencyPhases: ChecklistPhase[]
  activePhaseId: string
  isPhaseComplete: (id: string) => boolean
  onSelectPhase: (id: string) => void
  onEmergency: () => void
  onReset: () => void
  category: AircraftCategory
}

export function PhaseStrip({
  normalPhases,
  emergencyPhases,
  activePhaseId,
  isPhaseComplete,
  onSelectPhase,
  onEmergency,
  onReset,
  category,
}: Props) {
  const hex = ACCENT_HEX[category]

  return (
    <div className="lg:hidden safe-bottom flex-shrink-0 bg-cockpit-panel border-t border-cockpit-border z-10">
      {/* Actions row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-cockpit-border/40">
        {emergencyPhases.length > 0 && (
          <button onClick={onEmergency} className="emergency-btn flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <span>EMERG</span>
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-cockpit-text-dim hover:text-cockpit-text-secondary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Flight
        </button>
      </div>

      {/* Scrollable phase pill strip */}
      <div className="flex gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none">
        {normalPhases.map(phase => {
          const complete = isPhaseComplete(phase.id)
          const active = phase.id === activePhaseId
          const icon = PHASE_ICONS[phase.category] ?? '📋'

          return (
            <button
              key={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 text-xs font-medium border transition-all duration-200 active:scale-95"
              style={
                active
                  ? { background: `${hex}1a`, borderColor: `${hex}59`, color: hex }
                  : complete
                  ? { background: '#22c55e12', borderColor: '#22c55e33', color: '#22c55e' }
                  : { background: 'transparent', borderColor: '#1e3a5f', color: '#475569' }
              }
            >
              <span className="text-sm leading-none">{icon}</span>
              <span>{complete ? `✓ ${phase.name}` : phase.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
