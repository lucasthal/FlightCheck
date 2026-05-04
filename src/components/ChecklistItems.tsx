import { useState } from 'react'
import type { ChecklistPhase, ChecklistItem } from '../types'
import { AlertTriangle, Info, ChevronDown, Sparkles } from 'lucide-react'

interface Props {
  phase: ChecklistPhase
  isItemChecked: (id: string) => boolean
  onToggle: (id: string) => void
}

export function ChecklistItems({ phase, isItemChecked, onToggle }: Props) {
  return (
    <div className="space-y-1.5">
      {phase.items.map((item, idx) => (
        <ChecklistItemRow
          key={item.id}
          item={item}
          index={idx + 1}
          checked={isItemChecked(item.id)}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  )
}

interface RowProps {
  item: ChecklistItem
  index: number
  checked: boolean
  onToggle: () => void
}

function ChecklistItemRow({ item, index, checked, onToggle }: RowProps) {
  const [noteOpen, setNoteOpen] = useState(false)

  const hasNote = !!item.note
  const isWarning = item.severity === 'warning'
  const isCaution = item.severity === 'caution'
  const isSetup = item.severity === 'setup'

  return (
    <div
      data-item-id={item.id}
      className={`
        relative rounded-lg border transition-all duration-150 overflow-hidden
        ${checked
          ? 'border-cockpit-green/20 bg-cockpit-green/5'
          : isWarning
          ? 'border-cockpit-amber/30 bg-cockpit-amber/5'
          : isCaution
          ? 'border-yellow-500/20 bg-yellow-500/5'
          : isSetup
          ? 'border-cockpit-blue/25 bg-cockpit-blue/5'
          : 'border-cockpit-border bg-cockpit-card/50 hover:border-cockpit-border hover:bg-cockpit-card'
        }
      `}
    >
      {/* Left severity stripe */}
      {(isWarning || isCaution || isSetup) && !checked && (
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isWarning ? 'bg-cockpit-amber' : isCaution ? 'bg-yellow-500' : 'bg-cockpit-blue'}`} />
      )}

      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left touch-target"
        aria-label={`${checked ? 'Uncheck' : 'Check'}: ${item.action}`}
      >
        {/* Checkbox */}
        <div className={`
          flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
          ${checked
            ? 'border-cockpit-green bg-cockpit-green shadow-green-glow'
            : isWarning
            ? 'border-cockpit-amber/60'
            : 'border-cockpit-border'
          }
        `}>
          {checked && (
            <svg className="w-3 h-3 text-cockpit-bg animate-check-bounce" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6L4.5 9L10.5 3" />
            </svg>
          )}
        </div>

        {/* Item number + content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <span className={`text-xs font-mono flex-shrink-0 tabular-nums ${checked ? 'text-cockpit-text-dim' : 'text-cockpit-text-dim'}`}>
                {String(index).padStart(2, '0')}
              </span>
              <span
                className={`text-sm font-medium leading-snug transition-colors ${
                  checked ? 'text-cockpit-text-dim line-through decoration-cockpit-text-dim/50' : 'text-cockpit-text-primary'
                }`}
                style={{ fontSize: 'calc(0.875rem * var(--text-scale))' }}
              >
                {item.action}
              </span>
              {isSetup && !checked && (
                <span title="Added by setup wizard"><Sparkles className="w-3 h-3 text-cockpit-blue flex-shrink-0 self-center" /></span>
              )}
            </div>

            {/* Severity icon */}
            {(isWarning || isCaution) && !checked && (
              <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isWarning ? 'text-cockpit-amber' : 'text-yellow-500'}`} />
            )}
          </div>

          {/* Response */}
          {item.response && (
            <div className={`mt-1.5 flex items-start gap-1.5`}>
              <span className="text-xs text-cockpit-text-dim flex-shrink-0 font-mono mt-0.5">→</span>
              <span
                className={`text-sm font-mono font-semibold tracking-tight ${
                  checked ? 'text-cockpit-green/70' : 'text-cockpit-amber'
                }`}
                style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}
              >
                {item.response}
              </span>
            </div>
          )}

          {/* Severity label */}
          {isWarning && !checked && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-cockpit-amber font-semibold uppercase tracking-wide">
              <AlertTriangle className="w-3 h-3" />
              WARNING
            </div>
          )}
          {isCaution && !checked && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-yellow-500 font-semibold uppercase tracking-wide">
              <AlertTriangle className="w-3 h-3" />
              CAUTION
            </div>
          )}

          {/* Note toggle */}
          {hasNote && (
            <button
              onClick={e => { e.stopPropagation(); setNoteOpen(v => !v) }}
              className={`mt-2 flex items-center gap-1 text-xs font-medium transition-colors
                ${noteOpen
                  ? isCaution ? 'text-yellow-500' : 'text-cockpit-blue'
                  : 'text-cockpit-text-dim hover:text-cockpit-text-secondary'}`}
            >
              <Info className="w-3.5 h-3.5" />
              {noteOpen ? 'Hide note' : 'Show note'}
              <ChevronDown className={`w-3 h-3 transition-transform ${noteOpen ? 'rotate-180' : ''}`} />
            </button>
          )}

          {/* Note content */}
          {hasNote && noteOpen && (
            <div className={`mt-2 px-3 py-2 rounded-lg text-xs leading-relaxed animate-fade-in
              ${isCaution
                ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200'
                : 'bg-cockpit-blue/10 border border-cockpit-blue/20 text-cockpit-text-secondary'}`}>
              {item.note}
            </div>
          )}

          {/* Sub-items */}
          {item.subItems && item.subItems.length > 0 && (
            <ul className="mt-2 space-y-1 pl-4">
              {item.subItems.map((sub, i) => (
                <li key={i} className="text-xs text-cockpit-text-secondary flex items-start gap-1.5">
                  <span className="text-cockpit-text-dim flex-shrink-0 mt-0.5">•</span>
                  {sub}
                </li>
              ))}
            </ul>
          )}
        </div>
      </button>
    </div>
  )
}
