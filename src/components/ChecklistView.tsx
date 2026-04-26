import { useState, useRef, useEffect } from 'react'
import type { Aircraft, ChecklistPhase, AircraftCategory } from '../types'
import { useChecklist } from '../hooks/useChecklist'
import { PhaseNav } from './PhaseNav'
import { ChecklistItems } from './ChecklistItems'
import { EmergencyPanel } from './EmergencyPanel'
import {
  ArrowLeft, AlertTriangle, RotateCcw, Menu, X, CheckCircle2,
  Moon, Sun, Lightbulb,
} from 'lucide-react'
import { PhaseBanner } from './PhaseBanner'
import { PhaseStrip } from './PhaseStrip'
import { VSpeedCard } from './VSpeedCard'
import { ReferenceTab } from './ReferenceTab'

const CATEGORY_ACCENT: Record<AircraftCategory, string> = {
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

const CATEGORY_BORDER: Record<AircraftCategory, string> = {
  SEP:        'border-sky-500/30',
  MEP:        'border-violet-500/30',
  Turboprop:  'border-amber-500/30',
  Jet:        'border-rose-500/30',
  Helicopter: 'border-emerald-500/30',
}

interface Props {
  aircraft: Aircraft
  onBack: () => void
  onCycleTheme: () => void
  theme: string
}

export function ChecklistView({ aircraft, onBack, onCycleTheme, theme }: Props) {
  const {
    activePhaseId,
    selectPhase,
    toggleItem,
    completePhase,
    resetFlight,
    getPhaseProgress,
    isItemChecked,
    isPhaseComplete,
  } = useChecklist(aircraft)

  const [showEmergency, setShowEmergency] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<'checklist' | 'reference'>('checklist')
  const contentRef = useRef<HTMLDivElement>(null)

  const normalPhases = aircraft.phases.filter(p => p.category !== 'emergency')
  const emergencyPhases = aircraft.phases.filter(p => p.category === 'emergency')
  const activePhase = aircraft.phases.find(p => p.id === activePhaseId)

  const { checked: phaseChecked, total: phaseTotal } = getPhaseProgress(activePhaseId)
  const phaseAllChecked = phaseTotal > 0 && phaseChecked === phaseTotal

  const totalItems = normalPhases.reduce((sum, p) => sum + p.items.length, 0)
  const totalChecked = normalPhases.reduce((sum, p) => sum + getPhaseProgress(p.id).checked, 0)
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  const accentColor = CATEGORY_ACCENT[aircraft.category]
  const accentBorder = CATEGORY_BORDER[aircraft.category]

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePhaseId])

  const handlePhaseSelect = (phaseId: string) => {
    selectPhase(phaseId)
    setSidebarOpen(false)
  }

  const handleCompletePhase = () => {
    completePhase(activePhaseId)
    const idx = normalPhases.findIndex(p => p.id === activePhaseId)
    if (idx < normalPhases.length - 1) {
      handlePhaseSelect(normalPhases[idx + 1].id)
    }
  }

  if (showEmergency) {
    return (
      <EmergencyPanel
        phases={emergencyPhases}
        onClose={() => setShowEmergency(false)}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen bg-cockpit-bg overflow-hidden">
      {/* Top bar */}
      <header className={`safe-top flex-shrink-0 bg-cockpit-panel border-b ${accentBorder} shadow-cockpit z-20`}>
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary hover:text-cockpit-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}>
                {aircraft.category}
              </span>
              <span className="text-cockpit-text-dim text-xs">·</span>
              <span className="text-xs text-cockpit-text-dim truncate">{aircraft.manufacturer}</span>
            </div>
            <div className={`font-bold text-sm truncate leading-tight text-cockpit-text-primary`}>
              {aircraft.model} — {aircraft.name.split(' ').slice(-1)[0]}
            </div>
          </div>

          {/* Overall progress badge */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border ${
              overallProgress === 100
                ? 'bg-cockpit-green/10 border-cockpit-green/30 text-cockpit-green'
                : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary'
            }`}>
              {overallProgress}%
            </div>
          </div>

          {/* Emergency button — desktop */}
          {emergencyPhases.length > 0 && (
            <button
              onClick={() => setShowEmergency(true)}
              className="hidden sm:flex emergency-btn"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>EMERG</span>
            </button>
          )}

          {/* Theme toggle */}
          <button onClick={onCycleTheme} className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-dim">
            {theme === 'dark' && <Moon className="w-4 h-4" />}
            {theme === 'night' && <Lightbulb className="w-4 h-4 text-amber-400" />}
            {theme === 'day' && <Sun className="w-4 h-4 text-yellow-400" />}
          </button>

          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-white/5 text-cockpit-text-secondary lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="h-0.5 bg-cockpit-card">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${overallProgress}%`,
              background: overallProgress === 100
                ? '#22c55e'
                : `linear-gradient(90deg, var(--color-amber), var(--color-amber-dim))`,
              ['--color-amber' as string]: '#f59e0b',
              ['--color-amber-dim' as string]: '#d97706',
            }}
          />
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-cockpit-border/40">
          {(['checklist', 'reference'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors
                ${activeTab === tab
                  ? `${accentColor} border-b-2 border-current`
                  : 'text-cockpit-text-dim hover:text-cockpit-text-secondary border-b-2 border-transparent'
                }`}
            >
              {tab === 'checklist' ? 'Checklist' : 'Reference'}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-cockpit-panel/60 border-r border-cockpit-border/50 overflow-y-auto">
          <PhaseNavContent
            aircraft={aircraft}
            normalPhases={normalPhases}
            emergencyPhases={emergencyPhases}
            activePhaseId={activePhaseId}
            onSelectPhase={handlePhaseSelect}
            onEmergency={() => setShowEmergency(true)}
            onReset={() => setShowResetConfirm(true)}
            getPhaseProgress={getPhaseProgress}
            isPhaseComplete={isPhaseComplete}
            totalChecked={totalChecked}
            totalItems={totalItems}
          />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-cockpit-panel border-r border-cockpit-border flex flex-col animate-slide-in-right">
              <div className="flex items-center justify-between px-4 py-4 border-b border-cockpit-border safe-top">
                <div>
                  <div className={`text-xs font-bold font-mono ${accentColor} uppercase tracking-wider`}>{aircraft.category}</div>
                  <div className="font-semibold text-cockpit-text-primary text-sm">{aircraft.name}</div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-white/5">
                  <X className="w-5 h-5 text-cockpit-text-secondary" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <PhaseNavContent
                  aircraft={aircraft}
                  normalPhases={normalPhases}
                  emergencyPhases={emergencyPhases}
                  activePhaseId={activePhaseId}
                  onSelectPhase={handlePhaseSelect}
                  onEmergency={() => { setShowEmergency(true); setSidebarOpen(false) }}
                  onReset={() => { setShowResetConfirm(true); setSidebarOpen(false) }}
                  getPhaseProgress={getPhaseProgress}
                  isPhaseComplete={isPhaseComplete}
                  totalChecked={totalChecked}
                  totalItems={totalItems}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main ref={contentRef} className="flex-1 overflow-y-auto">
          {activeTab === 'reference' ? (
            <ReferenceTab sections={aircraft.referenceData} />
          ) : activePhase ? (
            <div className="max-w-2xl mx-auto px-4 py-5 pb-40 lg:pb-10">
              {/* V-speed card */}
              {Object.keys(aircraft.vSpeeds).length > 0 && (
                <VSpeedCard vSpeeds={aircraft.vSpeeds} category={aircraft.category} />
              )}

              <PhaseBanner
                phase={activePhase}
                checked={phaseChecked}
                total={phaseTotal}
                isComplete={isPhaseComplete(activePhaseId)}
                normalPhases={normalPhases}
                activePhaseId={activePhaseId}
                isPhaseComplete={isPhaseComplete}
                category={aircraft.category}
              />

              <ChecklistItems
                phase={activePhase}
                isItemChecked={isItemChecked}
                onToggle={toggleItem}
              />

              <div className="mt-6">
                <button
                  onClick={handleCompletePhase}
                  disabled={!phaseAllChecked}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm border transition-all duration-200
                    ${phaseAllChecked
                      ? 'bg-cockpit-green/15 border-cockpit-green/40 text-cockpit-green hover:bg-cockpit-green/25 shadow-green-glow active:scale-98'
                      : 'bg-cockpit-card/30 border-cockpit-border/30 text-cockpit-text-dim cursor-not-allowed'
                    }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isPhaseComplete(activePhaseId) ? 'Phase Complete ✓' : 'Mark Phase Complete & Advance'}
                </button>

                {!phaseAllChecked && phaseTotal > 0 && (
                  <p className="text-center text-xs text-cockpit-text-dim mt-2">
                    {phaseTotal - phaseChecked} item{phaseTotal - phaseChecked !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-cockpit-text-dim">
              Select a phase to begin
            </div>
          )}
        </main>
      </div>

      <PhaseStrip
        normalPhases={normalPhases}
        emergencyPhases={emergencyPhases}
        activePhaseId={activePhaseId}
        isPhaseComplete={isPhaseComplete}
        onSelectPhase={handlePhaseSelect}
        onEmergency={() => setShowEmergency(true)}
        onReset={() => setShowResetConfirm(true)}
        category={aircraft.category}
      />

      {/* Reset modal */}
      {showResetConfirm && (
        <ResetModal
          aircraftName={aircraft.name}
          onConfirm={() => {
            const first = normalPhases[0]
            if (first) resetFlight(aircraft.id, first.id)
            setShowResetConfirm(false)
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}

interface PhaseNavContentProps {
  aircraft: Aircraft
  normalPhases: ChecklistPhase[]
  emergencyPhases: ChecklistPhase[]
  activePhaseId: string
  onSelectPhase: (id: string) => void
  onEmergency: () => void
  onReset: () => void
  getPhaseProgress: (id: string) => { checked: number; total: number }
  isPhaseComplete: (id: string) => boolean
  totalChecked: number
  totalItems: number
}

function PhaseNavContent({
  normalPhases, emergencyPhases, activePhaseId, onSelectPhase,
  onEmergency, onReset, getPhaseProgress, isPhaseComplete,
  totalChecked, totalItems,
}: PhaseNavContentProps) {
  const overallPct = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0

  return (
    <div className="flex flex-col gap-0.5 p-3">
      {/* Overall progress */}
      <div className="px-2 py-3 mb-1">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-cockpit-text-dim font-medium">Overall progress</span>
          <span className="font-mono font-semibold text-cockpit-text-secondary">{totalChecked}/{totalItems}</span>
        </div>
        <div className="h-1.5 bg-cockpit-card rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%`, background: overallPct === 100 ? '#22c55e' : '#f59e0b' }}
          />
        </div>
      </div>

      <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider px-2 pb-1.5">
        Normal Procedures
      </p>

      {normalPhases.map(phase => (
        <PhaseNav
          key={phase.id}
          phase={phase}
          isActive={phase.id === activePhaseId}
          isComplete={isPhaseComplete(phase.id)}
          progress={getPhaseProgress(phase.id)}
          onClick={() => onSelectPhase(phase.id)}
        />
      ))}

      {emergencyPhases.length > 0 && (
        <>
          <div className="my-2 border-t border-cockpit-border/40" />
          <button
            onClick={onEmergency}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold
                       text-red-400 border border-red-500/20 bg-red-500/5
                       hover:bg-red-500/10 hover:border-red-500/30 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Procedures
          </button>
        </>
      )}

      <div className="mt-3 pt-3 border-t border-cockpit-border/40">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                     text-cockpit-text-dim hover:text-cockpit-text-primary hover:bg-white/5 w-full transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Flight
        </button>
      </div>
    </div>
  )
}

function ResetModal({ aircraftName, onConfirm, onCancel }: {
  aircraftName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-cockpit-panel border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-cockpit animate-slide-up">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-xl bg-cockpit-amber/10 border border-cockpit-amber/20">
            <RotateCcw className="w-5 h-5 text-cockpit-amber" />
          </div>
          <div>
            <h3 className="font-bold text-cockpit-text-primary">Start New Flight?</h3>
            <p className="text-xs text-cockpit-text-dim mt-0.5">{aircraftName}</p>
          </div>
        </div>
        <p className="text-sm text-cockpit-text-secondary mb-5 leading-relaxed">
          All checked items will be cleared and the checklist reset to Preflight.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-cockpit-border text-cockpit-text-secondary text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-cockpit-amber/15 border border-cockpit-amber/40 text-cockpit-amber text-sm font-semibold hover:bg-cockpit-amber/25 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
