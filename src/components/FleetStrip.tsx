import { Star } from 'lucide-react'
import { allAircraft } from '../data'
import type { Aircraft, AircraftCategory } from '../types'

const CATEGORY_TEXT: Record<AircraftCategory, string> = {
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

interface Props {
  favorites: string[]
  onSelect: (aircraft: Aircraft) => void
}

export function FleetStrip({ favorites, onSelect }: Props) {
  const fleet = favorites
    .map(id => allAircraft.find(a => a.id === id))
    .filter((a): a is Aircraft => a !== undefined)

  if (fleet.length === 0) {
    return (
      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-cockpit-card/50 border border-dashed border-cockpit-border/50 rounded-xl text-xs text-cockpit-text-dim">
        <Star className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
        <span>Tap ★ on any aircraft to add it to your fleet</span>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-cockpit-amber uppercase tracking-wider mb-2">
        ★ My Fleet
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {fleet.map(aircraft => (
          <button
            key={aircraft.id}
            onClick={() => onSelect(aircraft)}
            className="flex-shrink-0 flex flex-col items-start gap-0.5 px-3 py-2
                       bg-cockpit-card border border-cockpit-amber/20 rounded-xl
                       hover:border-cockpit-amber/50 transition-all duration-150 min-w-[80px]"
          >
            <span className={`text-xs font-bold leading-tight ${CATEGORY_TEXT[aircraft.category]}`}>
              {aircraft.model}
            </span>
            <span className="text-xs text-cockpit-text-dim leading-tight">{aircraft.category}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
