import { useState } from 'react'
import type { AircraftCategory } from '../types'

const CATEGORY_ACCENT: Record<AircraftCategory, string> = {
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

interface Props {
  vSpeeds: Record<string, string>
  category: AircraftCategory
}

export function VSpeedCard({ vSpeeds, category }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const accentColor = CATEGORY_ACCENT[category]

  const numericPart = (value: string) => value.split(' ')[0]

  return (
    <div className="relative mb-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(vSpeeds).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setActive(active === key ? null : key)}
            className={`flex-shrink-0 flex items-baseline gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono whitespace-nowrap transition-colors
              ${active === key
                ? 'bg-cockpit-card/80 border-cockpit-border text-cockpit-text-primary'
                : 'bg-cockpit-card/40 border-cockpit-border/60 text-cockpit-text-secondary hover:border-cockpit-border'
              }`}
          >
            <span className="text-cockpit-text-dim">{key}</span>
            <span className={`font-bold ${active === key ? accentColor : ''}`}>{numericPart(value)}</span>
          </button>
        ))}
      </div>

      {active && vSpeeds[active] && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setActive(null)}
          />
          <div className="absolute top-full left-0 mt-1.5 z-20 bg-cockpit-panel border border-cockpit-border rounded-xl px-4 py-2.5 shadow-cockpit text-sm flex items-center gap-2 whitespace-nowrap">
            <span className={`font-mono font-bold text-base ${accentColor}`}>{vSpeeds[active]}</span>
            <span className="text-cockpit-text-dim">·</span>
            <span className="text-cockpit-text-secondary">{active}</span>
          </div>
        </>
      )}
    </div>
  )
}
