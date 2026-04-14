// src/components/PhaseBanner.tsx
import { CheckCircle2 } from 'lucide-react'
import type { AircraftCategory, ChecklistPhase } from '../types'

const PHASE_ICONS: Record<string, string> = {
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

const ACCENT_HEX: Record<AircraftCategory, string> = {
  SEP:        '#38bdf8',
  MEP:        '#a78bfa',
  Turboprop:  '#f59e0b',
  Jet:        '#fb7185',
  Helicopter: '#34d399',
}

interface Props {
  phase: ChecklistPhase
  checked: number
  total: number
  isComplete: boolean
  normalPhases: ChecklistPhase[]
  activePhaseId: string
  getPhaseProgress: (id: string) => { checked: number; total: number }
  isPhaseComplete: (id: string) => boolean
  category: AircraftCategory
}

export function PhaseBanner({
  phase,
  checked,
  total,
  isComplete,
  normalPhases,
  activePhaseId,
  getPhaseProgress,
  isPhaseComplete,
  category,
}: Props) {
  const hex = ACCENT_HEX[category]
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const icon = PHASE_ICONS[phase.category] ?? '📋'

  return (
    <div className="mb-5">
      {/* Banner */}
      <div
        className="rounded-r-xl px-3 py-3 flex items-center gap-3 relative overflow-hidden"
        style={{
          border: '1px solid #1e3a5f',
          borderLeft: `3px solid ${hex}`,
          background: `linear-gradient(90deg, ${hex}0f 0%, transparent 70%)`,
        }}
      >
        {/* Phase icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{
            border: `1px solid ${hex}4d`,
            background: `${hex}14`,
          }}
        >
          {icon}
        </div>

        {/* Name + item count */}
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-base text-cockpit-text-primary leading-tight truncate">
            {phase.name}
          </div>
          <div className="font-mono text-xs mt-0.5 uppercase tracking-wide">
            {isComplete ? (
              <span className="flex items-center gap-1 text-cockpit-green">
                <CheckCircle2 className="w-3 h-3" />
                {checked} of {total} · complete
              </span>
            ) : (
              <span className="text-cockpit-text-dim">
                {checked} of {total} items · in progress
              </span>
            )}
          </div>
        </div>

        {/* Percentage / complete mark */}
        <div
          className="font-mono font-bold text-2xl flex-shrink-0 tabular-nums"
          style={{ color: isComplete ? '#22c55e' : hex }}
        >
          {isComplete ? '✓' : `${pct}%`}
        </div>
      </div>

      {/* Segmented phase bar */}
      <div className="flex gap-0.5 mt-1.5">
        {normalPhases.map(p => {
          const complete = isPhaseComplete(p.id)
          const active = p.id === activePhaseId
          return (
            <div
              key={p.id}
              className="flex-1 h-0.5 rounded-full transition-all duration-500"
              style={{
                background: complete ? '#22c55e' : active ? hex : '#1e293b',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
