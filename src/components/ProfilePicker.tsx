import { useRef, useEffect, useState } from 'react'
import { ChevronDown, Check, Plus, RotateCcw } from 'lucide-react'
import type { Profile } from '../types'

interface Props {
  profiles: Profile[]
  activeProfile: Profile | null
  onSelect: (profileId: string | null) => void   // null = select Original
  onSaveAs: () => void
  onResetToOriginal: () => void   // deletes active profile
  disabled?: boolean
}

export function ProfilePicker({ profiles, activeProfile, onSelect, onSaveAs, onResetToOriginal, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = activeProfile ? activeProfile.name : 'Original (POH)'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cockpit-border/50
                   bg-cockpit-card/50 text-xs text-cockpit-text-secondary
                   hover:border-cockpit-accent/30 hover:text-cockpit-text-primary
                   disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Checklist profiles"
          className="absolute left-0 top-full mt-1 w-56 bg-cockpit-panel border border-cockpit-border
                     rounded-xl shadow-cockpit z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-cockpit-border/50">
            <p className="text-xs font-semibold text-cockpit-text-dim uppercase tracking-wider">Profiles</p>
          </div>

          {/* Original */}
          <button
            role="option"
            aria-selected={!activeProfile}
            onClick={() => { onSelect(null); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left
                       hover:bg-cockpit-card transition-colors"
          >
            {!activeProfile
              ? <Check className="w-3.5 h-3.5 text-cockpit-accent flex-shrink-0" />
              : <span className="w-3.5 h-3.5 flex-shrink-0" />
            }
            <span className={!activeProfile ? 'text-cockpit-text-primary font-medium' : 'text-cockpit-text-secondary'}>
              Original (POH)
            </span>
          </button>

          {/* Custom profiles */}
          {profiles.map(p => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.is_active}
              onClick={() => { onSelect(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left
                         hover:bg-cockpit-card transition-colors"
            >
              {p.is_active
                ? <Check className="w-3.5 h-3.5 text-cockpit-accent flex-shrink-0" />
                : <span className="w-3.5 h-3.5 flex-shrink-0" />
              }
              <span className={p.is_active ? 'text-cockpit-text-primary font-medium' : 'text-cockpit-text-secondary'}>
                {p.name}
              </span>
            </button>
          ))}

          <div className="border-t border-cockpit-border/50 p-1">
            <button
              onClick={() => { onSaveAs(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cockpit-text-secondary
                         hover:bg-cockpit-card hover:text-cockpit-text-primary rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Save As new profile…
            </button>
            {activeProfile && (
              <button
                onClick={() => { onResetToOriginal(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cockpit-text-dim
                           hover:bg-cockpit-card hover:text-red-400 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to original…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
