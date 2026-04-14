import type { ChecklistPhase, PhaseCategory } from '../types'
import { CheckCircle2, Circle } from 'lucide-react'

const PHASE_ICONS: Record<PhaseCategory, string> = {
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

interface Props {
  phase: ChecklistPhase
  isActive: boolean
  isComplete: boolean
  progress: { checked: number; total: number }
  onClick: () => void
}

export function PhaseNav({ phase, isActive, isComplete, progress, onClick }: Props) {
  const pct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0

  return (
    <button
      onClick={onClick}
      className={`phase-nav-btn ${isActive ? 'active' : ''} ${isComplete ? 'completed' : ''}`}
    >
      <span className="text-base flex-shrink-0 leading-none">{PHASE_ICONS[phase.category]}</span>
      <span className="flex-1 text-left truncate text-sm">{phase.name}</span>

      {isComplete ? (
        <CheckCircle2 className="w-4 h-4 text-cockpit-green flex-shrink-0" />
      ) : progress.checked > 0 ? (
        <span className="text-xs font-mono text-cockpit-text-dim flex-shrink-0 tabular-nums">
          {progress.checked}/{progress.total}
        </span>
      ) : (
        <Circle className="w-4 h-4 text-cockpit-text-dim flex-shrink-0 opacity-30" />
      )}

      {/* Progress underline */}
      {!isComplete && pct > 0 && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-cockpit-amber/40 transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }} />
      )}
    </button>
  )
}
