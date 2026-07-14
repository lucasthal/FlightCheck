// src/components/PhaseBanner.tsx
import { CheckCircle2 } from 'lucide-react'
import type { AircraftCategory, ChecklistPhase } from '../types'
import { PHASE_ICONS } from './phaseConstants'

interface Props {
  phase: ChecklistPhase
  checked: number
  total: number
  isComplete: boolean
  normalPhases: ChecklistPhase[]
  activePhaseId: string
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
  isPhaseComplete,
  category,
}: Props) {
  const accentVar = '--c-accent'
  const accent = `rgb(var(${accentVar}))`
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const icon = PHASE_ICONS[phase.category]

  return (
    <div className="mb-5">
      {/* Banner */}
      <div
        className="rounded-r-xl px-3 py-3 flex items-center gap-3 relative overflow-hidden"
        style={{
          border: '1px solid rgb(var(--c-border))',
          borderLeft: `3px solid ${accent}`,
          background: `linear-gradient(90deg, rgb(var(${accentVar}) / 0.06) 0%, transparent 70%)`,
        }}
      >
        {/* Phase icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{
            border: `1px solid rgb(var(${accentVar}) / 0.3)`,
            background: `rgb(var(${accentVar}) / 0.08)`,
          }}
        >
          {icon}
        </div>

        {/* Name + item count */}
        <div className="flex-1 min-w-0">
          <div
            className="font-extrabold text-base text-cockpit-text-primary leading-tight truncate"
            style={{ fontSize: 'calc(1rem * var(--text-scale))' }}
          >
            {phase.name}
          </div>
          <div
            className="font-mono text-xs mt-0.5 uppercase tracking-wide"
            style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}
          >
            {isComplete ? (
              <span className="flex items-center gap-1 text-cockpit-accent">
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
          style={{ color: isComplete ? 'rgb(var(--c-accent))' : accent, fontSize: 'calc(1.5rem * var(--text-scale))' }}
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
              className="flex-1 h-[3px] rounded-full transition-all duration-500"
              style={{
                background: complete ? 'rgb(var(--c-accent))' : active ? accent : 'rgb(var(--c-card))',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
