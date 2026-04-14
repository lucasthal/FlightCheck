import { useState } from 'react'
import type { ChecklistPhase } from '../types'
import { X, AlertTriangle, ChevronRight } from 'lucide-react'
import { ChecklistItems } from './ChecklistItems'

interface Props {
  phases: ChecklistPhase[]
  onClose: () => void
}

export function EmergencyPanel({ phases, onClose }: Props) {
  const [selectedPhase, setSelectedPhase] = useState<ChecklistPhase | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggleItem = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (selectedPhase) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-cockpit-bg">
        {/* Emergency header */}
        <header className="safe-top flex-shrink-0 bg-red-950/90 border-b border-red-800/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPhase(null)}
              className="p-2 rounded-lg hover:bg-red-800/30 text-red-300"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
              <div>
                <div className="font-bold text-red-100 text-sm">EMERGENCY PROCEDURE</div>
                <div className="text-xs text-red-400 uppercase tracking-wider">{selectedPhase.name}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-800/30 text-red-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Emergency checklist items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
          <div className="bg-red-950/30 border border-red-800/30 rounded-xl p-4 mb-4">
            <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">Caution</p>
            <p className="text-sm text-red-200">
              Emergency procedures are provided for reference only. Always verify against the
              current approved POH/AFM for the specific aircraft being operated.
            </p>
          </div>

          <ChecklistItems
            phase={selectedPhase}
            isItemChecked={id => checked[id] ?? false}
            onToggle={toggleItem}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cockpit-bg">
      {/* Header */}
      <header className="safe-top flex-shrink-0 bg-red-950/90 border-b border-red-800/50 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-900/50 border border-red-700/50">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="font-bold text-red-100">Emergency Procedures</h2>
              <p className="text-xs text-red-400">Select the applicable emergency</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-red-800/30 text-red-300 transition-colors"
            aria-label="Close emergency panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Warning banner */}
      <div className="bg-red-950/40 border-b border-red-900/50 px-4 py-3">
        <div className="flex items-start gap-2 max-w-2xl mx-auto">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">
            <strong>PRIORITY:</strong> Aviate · Navigate · Communicate.
            These are memory items — refer to POH/AFM for full procedures.
            Call Mayday on 121.5 MHz. Squawk 7700.
          </p>
        </div>
      </div>

      {/* Emergency procedure list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {phases.map(phase => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase)}
              className="w-full flex items-center justify-between gap-4 p-4 rounded-xl
                         bg-red-950/30 border border-red-800/30
                         hover:bg-red-950/50 hover:border-red-700/50
                         active:scale-98 transition-all duration-150 group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-900/50 border border-red-800/50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-red-100 text-sm">{phase.name}</div>
                  <div className="text-xs text-red-400 mt-0.5">
                    {phase.items.length} steps
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
