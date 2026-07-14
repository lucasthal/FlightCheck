// src/components/PhaseStrip.tsx
import { useEffect, useRef } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AircraftCategory, ChecklistPhase } from '../types'
import { PHASE_ICONS } from './phaseConstants'

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
  const accentVar = '--c-accent'
  const accent = `rgb(var(${accentVar}))`
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = stripRef.current
    if (!container) return
    const activeButton = container.querySelector<HTMLElement>(
      `[data-phase-id="${activePhaseId}"]`,
    )
    if (!activeButton) return
    const targetScroll =
      activeButton.offsetLeft - container.clientWidth / 2 + activeButton.offsetWidth / 2
    container.scrollTo({ left: targetScroll, behavior: 'smooth' })
  }, [activePhaseId])

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
      <div
        ref={stripRef}
        className="flex gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-4 overflow-x-auto scrollbar-none"
      >
        {normalPhases.map(phase => {
          const complete = isPhaseComplete(phase.id)
          const active = phase.id === activePhaseId
          const icon = PHASE_ICONS[phase.category]

          return (
            <button
              key={phase.id}
              data-phase-id={phase.id}
              onClick={() => onSelectPhase(phase.id)}
              className="relative flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2.5 rounded-full flex-shrink-0 text-[calc(0.75rem*var(--text-scale))] md:text-[calc(0.875rem*var(--text-scale))] font-medium border transition-colors duration-200 active:scale-95 touch-target"
              style={
                active
                  ? { borderColor: `rgb(var(${accentVar}) / 0.35)`, color: accent }
                  : complete
                  ? { borderColor: 'rgb(var(--c-accent) / 0.2)', color: 'rgb(var(--c-accent))' }
                  : { borderColor: 'rgb(var(--c-border))', color: 'rgb(var(--c-text-dim))' }
              }
            >
              {active && (
                <motion.span
                  layoutId="phase-pill-bg"
                  className="absolute inset-0 rounded-full"
                  style={{ background: `rgb(var(${accentVar}) / 0.1)` }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              {complete && !active && (
                <span className="absolute inset-0 rounded-full" style={{ background: 'rgb(var(--c-accent) / 0.07)' }} />
              )}
              <span className="relative text-[calc(0.875rem*var(--text-scale))] md:text-[calc(1rem*var(--text-scale))] leading-none">{icon}</span>
              <span className="relative">{complete ? `✓ ${phase.name}` : phase.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
