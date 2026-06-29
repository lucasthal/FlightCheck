import { useState, useRef, useEffect, memo, type ReactNode } from 'react'
import { allAircraft, aircraftByCategory } from '../data'
import type { Aircraft, AircraftCategory } from '../types'
import { Search, Zap, Users, Gauge, ArrowUp, Star, LogOut, ChevronDown, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getDisplayName } from '../lib/displayName'
import { useFavorites } from '../hooks/useFavorites'
import { FleetStrip } from './FleetStrip'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { OfflineBanner } from './OfflineBanner'

interface Props {
  onSelect: (aircraft: Aircraft) => void
  onOpenSettings: () => void
}

const CATEGORIES: { key: AircraftCategory | 'All'; label: string }[] = [
  { key: 'All',        label: 'All'       },
  { key: 'SEP',        label: 'Single'    },
  { key: 'MEP',        label: 'Multi'     },
  { key: 'Turboprop',  label: 'Turboprop' },
  { key: 'Jet',        label: 'Jet'       },
  { key: 'Helicopter', label: 'Helo'      },
]

const CATEGORY_COLORS: Record<AircraftCategory | 'All', string> = {
  All:        'from-slate-500 to-slate-600',
  SEP:        'from-sky-500 to-blue-600',
  MEP:        'from-violet-500 to-purple-600',
  Turboprop:  'from-amber-500 to-orange-500',
  Jet:        'from-rose-500 to-red-600',
  Helicopter: 'from-emerald-500 to-teal-600',
}

const CATEGORY_TEXT: Record<AircraftCategory | 'All', string> = {
  All:        'text-slate-400',
  SEP:        'text-sky-400',
  MEP:        'text-violet-400',
  Turboprop:  'text-amber-400',
  Jet:        'text-rose-400',
  Helicopter: 'text-emerald-400',
}

const CATEGORY_BG: Record<AircraftCategory | 'All', string> = {
  All:        'bg-slate-500/10 border-slate-500/20',
  SEP:        'bg-sky-500/10 border-sky-500/20',
  MEP:        'bg-violet-500/10 border-violet-500/20',
  Turboprop:  'bg-amber-500/10 border-amber-500/20',
  Jet:        'bg-rose-500/10 border-rose-500/20',
  Helicopter: 'bg-emerald-500/10 border-emerald-500/20',
}

const CATEGORY_SILHOUETTE: Record<AircraftCategory, ReactNode> = {
  SEP: (
    <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
      <path d="M40 8 L52 20 L70 20 L70 22 L52 22 L50 32 L46 32 L44 22 L16 22 L10 28 L8 28 L12 20 L8 12 L10 12 L16 18 L44 18 L46 8 Z"/>
    </svg>
  ),
  MEP: (
    <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
      <path d="M40 6 L54 18 L72 17 L72 20 L54 20 L52 32 L46 32 L44 20 L36 20 L34 32 L28 32 L26 20 L8 20 L8 17 L26 18 Z"/>
      <circle cx="22" cy="14" r="3"/>
      <circle cx="58" cy="14" r="3"/>
    </svg>
  ),
  Turboprop: (
    <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
      <path d="M38 5 L54 18 L74 17 L74 20 L54 21 L52 33 L46 33 L44 21 L36 21 L34 33 L28 33 L26 21 L6 21 L6 17 L26 18 Z"/>
      <ellipse cx="10" cy="14" rx="2" ry="8"/>
      <ellipse cx="70" cy="14" rx="2" ry="8"/>
    </svg>
  ),
  Jet: (
    <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
      <path d="M44 8 C50 8 58 14 66 20 L76 20 L76 22 L66 22 C58 26 50 28 44 28 L38 28 L36 22 L8 22 L8 19 L36 19 L38 8 Z"/>
      <path d="M50 28 L54 36 L56 36 L52 28 Z"/>
      <path d="M54 8 L56 4 L58 4 L56 8 Z"/>
    </svg>
  ),
  Helicopter: (
    <svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20">
      <ellipse cx="36" cy="20" rx="14" ry="8"/>
      <rect x="10" y="18" width="60" height="2" rx="1"/>
      <rect x="34" y="10" width="4" height="10"/>
      <path d="M34 28 L30 36 L32 36 L36 30 L40 36 L42 36 L38 28 Z"/>
      <rect x="60" y="17" width="14" height="2" rx="1"/>
    </svg>
  ),
}

const AIRCRAFT_SILHOUETTE: Record<string, ReactNode> = {
  'cessna-152': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L26,6 L42,6 L42,20 L42,34 L26,34 Z"/><path d="M8,19.5 C12,17.5 22,16.5 50,17 C60,17 67,18.5 71,20 C67,21.5 60,23 50,23 C22,23.5 12,22.5 8,20.5 Z"/><path d="M66,20 L64,16 L72,16 L72,24 L64,24 Z"/><circle cx="8" cy="20" r="1.8"/></svg>),
  'cessna-172': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L25,5 L43,5 L43,20 L43,35 L25,35 Z"/><path d="M8,19 C12,17 22,16 50,17 C60,17 67,18 72,20 C67,22 60,23 50,23 C22,24 12,23 8,21 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="8" cy="20" r="2"/></svg>),
  'cessna-172m': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L25,5 L43,5 L43,20 L43,35 L25,35 Z"/><path d="M8,19 C12,17 22,16 50,17 C60,17 67,18 72,20 C67,22 60,23 50,23 C22,24 12,23 8,21 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="8" cy="20" r="2"/></svg>),
  'cessna-172n': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L25,5 L43,5 L43,20 L43,35 L25,35 Z"/><path d="M8,19 C12,17 22,16 50,17 C60,17 67,18 72,20 C67,22 60,23 50,23 C22,24 12,23 8,21 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="8" cy="20" r="2"/></svg>),
  'cessna-172p': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L25,5 L43,5 L43,20 L43,35 L25,35 Z"/><path d="M8,19 C12,17 22,16 50,17 C60,17 67,18 72,20 C67,22 60,23 50,23 C22,24 12,23 8,21 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="8" cy="20" r="2"/></svg>),
  'cessna-182t': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M26,20 L23,5 L44,5 L44,20 L44,35 L23,35 Z"/><path d="M8,19 C12,17 22,15.5 50,16.5 C60,16.5 67,18 72,20 C67,22 60,23.5 50,23.5 C22,24.5 12,23 8,21 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><circle cx="8" cy="20" r="2"/></svg>),
  'piper-warrior-iii': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L28,7 L44,7 L44,20 L44,33 L28,33 Z"/><path d="M10,18.5 C15,17 24,16 52,17 C62,17 68,18.5 72,20 C68,21.5 62,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M67,20 L65,15 L73,15 L73,25 L65,25 Z"/><circle cx="10" cy="20" r="2"/></svg>),
  'piper-pa28-archer': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M29,20 L27,6 L45,6 L45,20 L45,34 L27,34 Z"/><path d="M10,18.5 C15,17 24,16 52,17 C62,17 68,18.5 72,20 C68,21.5 62,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><circle cx="10" cy="20" r="2"/></svg>),
  'cirrus-sr22': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M46,20 L30,8 L52,11 L50,20 L52,29 L30,32 Z"/><path d="M10,19 C16,17 28,16 56,17 C64,17 70,18 73,20 C70,22 64,23 56,23 C28,24 16,23 10,21 Z"/><path d="M68,20 L66,15 L74,15 L74,25 L66,25 Z"/><ellipse cx="38" cy="20" rx="5" ry="2.5"/></svg>),
  'diamond-da40': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M36,20 L30,8 L48,10 L46,20 L48,30 L30,32 Z"/><path d="M8,19.5 C12,18 22,17 52,17.5 C62,17.5 68,18.5 72,20 C68,21.5 62,22.5 52,22.5 C22,23 12,22 8,20.5 Z"/><path d="M68,20 L65,13 L75,13 L75,27 L65,27 Z"/></svg>),
  'beech-bonanza-g36': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M34,20 L30,8 L48,10 L46,20 L48,30 L30,32 Z"/><path d="M10,19 C14,17 24,16 54,17 C63,17 69,18.5 72,20 C69,21.5 63,23 54,23 C24,24 14,23 10,21 Z"/><path d="M68,20 L64,14 L73,18 Z"/><path d="M68,20 L64,26 L73,22 Z"/></svg>),
  'mooney-m20v': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M36,20 L32,9 L46,10 L44,20 L46,30 L32,31 Z"/><path d="M8,19.5 C12,18.5 24,17.5 54,18 C63,18 69,19 72,20 C69,21 63,22 54,22 C24,22.5 12,21.5 8,20.5 Z"/><path d="M67,20 L65,16 L73,16 L73,24 L65,24 Z"/></svg>),
  'piper-seminole': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M32,20 L28,7 L46,9 L44,20 L46,31 L28,33 Z"/><ellipse cx="30" cy="12" rx="5" ry="2"/><ellipse cx="30" cy="28" rx="5" ry="2"/><path d="M10,18.5 C15,17 24,16 52,17 C61,17 67,18.5 71,20 C67,21.5 61,23 52,23 C24,24 15,23 10,21.5 Z"/><path d="M66,20 L64,13 L73,13 L73,27 L64,27 Z"/></svg>),
  'beech-baron-g58': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L26,6 L48,8 L46,20 L48,32 L26,34 Z"/><ellipse cx="27" cy="11" rx="6" ry="2.5"/><ellipse cx="27" cy="29" rx="6" ry="2.5"/><path d="M10,18 C15,16 25,15 52,16 C62,16 68,18 72,20 C68,22 62,24 52,24 C25,25 15,24 10,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/></svg>),
  'cessna-208b-caravan': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M26,20 L22,5 L46,5 L46,20 L46,35 L22,35 Z"/><path d="M8,18 C12,15.5 22,14.5 50,15.5 C60,15.5 67,17.5 72,20 C67,22.5 60,24.5 50,24.5 C22,25.5 12,24.5 8,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/><path d="M4,19 L8,17 L8,23 L4,21 Z"/></svg>),
  'daher-tbm-960': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M40,20 L26,8 L50,11 L48,20 L50,29 L26,32 Z"/><path d="M8,19 C12,17 24,16 58,17 C65,17 70,18 74,20 C70,22 65,23 58,23 C24,24 12,23 8,21 Z"/><path d="M69,20 L67,13 L76,13 L76,27 L67,27 Z"/><path d="M4,19.5 L8,18 L8,22 L4,20.5 Z"/></svg>),
  'pilatus-pc12-ngx': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M34,20 L28,7 L50,9 L48,20 L50,31 L28,33 Z"/><path d="M8,18 C12,15.5 22,14.5 54,15.5 C63,15.5 69,17.5 73,20 C69,22.5 63,24.5 54,24.5 C22,25.5 12,24.5 8,22 Z"/><path d="M68,20 L66,13 L75,13 L75,27 L66,27 Z"/><path d="M4,19.5 L8,17.5 L8,22.5 L4,20.5 Z"/></svg>),
  'king-air-c90': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M30,20 L25,6 L47,8 L45,20 L47,32 L25,34 Z"/><path d="M17,9 L30,10.5 L30,13.5 L17,13 Z"/><path d="M17,27 L30,26.5 L30,29.5 L17,31 Z"/><circle cx="16" cy="11" r="2.5"/><circle cx="16" cy="29" r="2.5"/><path d="M10,18 C15,16 26,15 54,16 C63,16 69,18 72,20 C69,22 63,24 54,24 C26,25 15,24 10,22 Z"/><path d="M67,20 L65,14 L74,14 L74,26 L65,26 Z"/></svg>),
  'king-air-b200gt': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M28,20 L23,6 L49,8 L47,20 L49,32 L23,34 Z"/><path d="M23,10 L21,8 L23,6 Z"/><path d="M23,30 L21,32 L23,34 Z"/><path d="M15,9 L28,10.5 L28,13.5 L15,13 Z"/><path d="M15,27 L28,26.5 L28,29.5 L15,31 Z"/><circle cx="14" cy="11" r="2.5"/><circle cx="14" cy="29" r="2.5"/><path d="M10,18 C15,16 26,15 54,16 C64,16 70,18 73,20 C70,22 64,24 54,24 C26,25 15,24 10,22 Z"/><path d="M68,20 L66,12 L75,12 L75,28 L66,28 Z"/></svg>),
  'cessna-citation-cj4': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M44,20 L32,7 L50,10 L48,20 L50,30 L32,33 Z"/><ellipse cx="60" cy="14" rx="8" ry="2.5" transform="rotate(-8,60,14)"/><ellipse cx="60" cy="26" rx="8" ry="2.5" transform="rotate(8,60,26)"/><path d="M8,19 C14,17 30,16 62,17 C67,17 71,18 74,20 C71,22 67,23 62,23 C30,24 14,23 8,21 Z"/><path d="M70,20 L68,13 L76,13 L76,27 L68,27 Z"/></svg>),
  'embraer-phenom-300e': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><path d="M42,20 L28,6 L52,10 L49,20 L52,30 L28,34 Z"/><ellipse cx="58" cy="13" rx="9" ry="3"/><ellipse cx="58" cy="27" rx="9" ry="3"/><path d="M8,18 C14,16 30,15 60,16 C67,16 71,18 74,20 C71,22 67,24 60,24 C30,25 14,24 8,22 Z"/><path d="M70,20 L67,12 L76,12 L76,28 L67,28 Z"/></svg>),
  'robinson-r44-raven-ii': (<svg viewBox="0 0 80 40" fill="currentColor" className="w-full h-full opacity-20"><rect x="18" y="18.5" width="36" height="3" rx="1.5"/><rect x="33.5" y="2" width="3" height="36" rx="1.5"/><ellipse cx="35" cy="20" rx="10" ry="7"/><rect x="44" y="18.5" width="28" height="3" rx="1"/><ellipse cx="72" cy="20" rx="2" ry="7"/></svg>),
}

export function AircraftSelector({ onSelect, onOpenSettings }: Props) {
  const { user, signOut } = useAuth()
  const { favorites, toggle, isFavorite } = useFavorites()
  const { isOnline } = useNetworkStatus()
  const [filter, setFilter] = useState<AircraftCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = allAircraft.filter(a => {
    const matchesCategory = filter === 'All' || a.category === filter
    const q = search.toLowerCase()
    const matchesSearch = !q || [a.name, a.manufacturer, a.model, a.description]
      .some(s => s.toLowerCase().includes(q))
    return matchesCategory && matchesSearch
  })

  const categoryCount = (cat: AircraftCategory | 'All') =>
    cat === 'All' ? allAircraft.length : (aircraftByCategory[cat as AircraftCategory]?.length ?? 0)

  const displayName = getDisplayName(user) ?? 'Pilot'

  const initials = displayName.slice(0, 2).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div className="min-h-screen flex flex-col bg-cockpit-bg">
      <OfflineBanner visible={!isOnline} />
      <header className="relative overflow-hidden border-b border-cockpit-border/40">
        <div className="absolute inset-0 bg-gradient-to-b from-cockpit-amber/5 via-cockpit-panel to-cockpit-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_70%)]" />

        <div className="relative max-w-5xl mx-auto px-4 pt-8 pb-6 safe-top">
          {/* Logo row + profile */}
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center shadow-amber-glow">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                  <path d="M 3.5 13 Q 5.5 15 8.5 18 Q 9.5 18 14.5 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path transform="translate(17.5 8) rotate(-50)" d="M2.5 0 L1.2 -0.45 L1.2 -2.2 L-0.2 -2.2 L-0.2 -0.45 L-2 -0.45 L-2.5 0 L-2 0.45 L-0.2 0.45 L-0.2 2.2 L1.2 2.2 L1.2 0.45 Z" fill="white"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-cockpit-text-primary tracking-tight">
                  Flight<span className="text-cockpit-amber">Check</span>
                </h1>
                <p className="text-xs text-cockpit-text-dim">Best in class Pilot's checklist</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-cockpit-border/50
                           bg-cockpit-card/50 hover:border-cockpit-amber/30 transition-all duration-150"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cockpit-amber to-orange-500 flex items-center justify-center text-black text-xs font-bold">
                    {initials}
                  </div>
                )}
                <span className="text-xs text-cockpit-text-secondary hidden sm:block max-w-[100px] truncate">
                  {displayName}
                </span>
                <ChevronDown className="w-3 h-3 text-cockpit-text-dim" />
              </button>

              {profileOpen && (
                <div role="menu" aria-label="Profile menu" className="absolute right-0 top-full mt-1 w-48 bg-cockpit-panel border border-cockpit-border rounded-xl shadow-cockpit z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-cockpit-border/50">
                    <p className="text-xs font-semibold text-cockpit-text-primary truncate">{displayName}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => { setProfileOpen(false); onOpenSettings() }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cockpit-text-secondary
                               hover:bg-cockpit-card hover:text-cockpit-text-primary transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setProfileOpen(false); signOut() }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-cockpit-text-secondary
                               hover:bg-cockpit-card hover:text-cockpit-text-primary transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="p-2 rounded-xl text-cockpit-text-primary bg-cockpit-card/60 hover:bg-cockpit-card border border-cockpit-border/50 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-4 mb-5 overflow-x-auto scrollbar-none">
            {CATEGORIES.filter(c => c.key !== 'All').map(cat => {
              const count = categoryCount(cat.key)
              if (count === 0) return null
              return (
                <div key={cat.key} className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-cockpit-text-primary">{count}</span>
                  <span className="text-cockpit-text-dim">{cat.label}</span>
                </div>
              )
            })}
          </div>

          {/* My Fleet strip */}
          <FleetStrip favorites={favorites} onSelect={onSelect} />

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-dim" />
            <input
              type="search"
              placeholder="Search by aircraft, manufacturer, or type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-cockpit-card border border-cockpit-border
                         text-cockpit-text-primary placeholder-cockpit-text-dim text-sm
                         focus:outline-none focus:border-cockpit-amber/50 focus:ring-2 focus:ring-cockpit-amber/10
                         transition-all duration-150"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
              const isActive = filter === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setFilter(cat.key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150
                    ${isActive
                      ? `bg-gradient-to-r ${CATEGORY_COLORS[cat.key]} text-white border-transparent shadow-lg`
                      : 'bg-cockpit-card border-cockpit-border text-cockpit-text-secondary hover:border-cockpit-border hover:text-cockpit-text-primary'
                    }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-xs ${isActive ? 'text-white/70' : 'text-cockpit-text-dim'}`}>
                    {categoryCount(cat.key)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-cockpit-text-dim">
            <p className="font-semibold text-cockpit-text-secondary">No aircraft found</p>
            <p className="text-sm mt-1">Try a different search or category filter</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-cockpit-text-dim mb-3 font-medium">
              {filtered.length} aircraft · tap to open checklist
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(aircraft => (
                <AircraftCard
                  key={aircraft.id}
                  aircraft={aircraft}
                  onSelect={onSelect}
                  isFavorite={isFavorite(aircraft.id)}
                  onToggleFavorite={() => toggle(aircraft.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="safe-bottom py-4 text-center text-cockpit-text-dim text-xs border-t border-cockpit-border/20 pb-20 lg:pb-4">
        For reference only — always verify against current POH/AFM
      </footer>
    </div>
  )
}

interface CardProps {
  aircraft: Aircraft
  onSelect: (a: Aircraft) => void
  isFavorite: boolean
  onToggleFavorite: () => void
}

const AircraftCard = memo(function AircraftCard({ aircraft, onSelect, isFavorite, onToggleFavorite }: CardProps) {
  const normalPhases = aircraft.phases.filter(p => p.category !== 'emergency')
  const emergencyPhases = aircraft.phases.filter(p => p.category === 'emergency')
  const cat = aircraft.category

  return (
    <div className="aircraft-card group relative overflow-hidden">
      {/* Background silhouette */}
      <div className={`absolute right-2 top-2 w-32 h-16 ${CATEGORY_TEXT[cat]}`}>
        {AIRCRAFT_SILHOUETTE[aircraft.id] ?? CATEGORY_SILHOUETTE[cat]}
      </div>

      {/* Star toggle */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite() }}
        aria-label={isFavorite ? `Remove ${aircraft.name} from fleet` : `Add ${aircraft.name} to fleet`}
        aria-pressed={isFavorite}
        title={isFavorite ? 'Remove from fleet' : 'Add to fleet'}
        className="absolute top-2.5 right-2.5 z-10 p-1 rounded-lg transition-colors hover:bg-cockpit-bg/80"
      >
        <Star
          className={`w-4 h-4 transition-colors ${
            isFavorite ? 'text-cockpit-amber fill-cockpit-amber' : 'text-cockpit-text-dim'
          }`}
        />
      </button>

      {/* Card content */}
      <button onClick={() => onSelect(aircraft)} className="w-full text-left block">
        <div className="mb-2 relative">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${CATEGORY_BG[cat]} ${CATEGORY_TEXT[cat]}`}>
            {cat}
          </span>
        </div>
        <h2 className={`font-bold text-base leading-tight text-cockpit-text-primary group-hover:${CATEGORY_TEXT[cat]} transition-colors mb-0.5`} style={{ fontSize: 'calc(1rem * var(--text-scale))' }}>
          {aircraft.name}
        </h2>
        <p className="text-xs text-cockpit-text-dim font-mono mb-2" style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}>{aircraft.manufacturer} · {aircraft.model}</p>
        <p className="text-xs text-cockpit-text-secondary leading-relaxed mb-3 line-clamp-2 relative" style={{ fontSize: 'calc(0.75rem * var(--text-scale))' }}>
          {aircraft.description}
        </p>
        <div className="flex flex-wrap gap-2 mb-3 relative">
          <MiniSpec icon={<Zap className="w-3 h-3" />} value={aircraft.specs.engineType.split('(')[0].trim()} />
          <MiniSpec icon={<Users className="w-3 h-3" />} value={`${aircraft.specs.seats} seats`} />
          {aircraft.specs.maxSpeed && (
            <MiniSpec icon={<Gauge className="w-3 h-3" />} value={aircraft.specs.maxSpeed} />
          )}
          {aircraft.specs.ceiling && (
            <MiniSpec icon={<ArrowUp className="w-3 h-3" />} value={aircraft.specs.ceiling} />
          )}
        </div>
        <div className="flex items-center gap-3 pt-2.5 border-t border-cockpit-border/40 text-xs text-cockpit-text-dim relative">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_TEXT[cat].replace('text-', 'bg-')}`} />
            {normalPhases.length} checklists
          </span>
          {emergencyPhases.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {emergencyPhases.length} emergency
            </span>
          )}
          <span className="ml-auto text-cockpit-text-dim">
            {aircraft.phases.reduce((s, p) => s + p.items.length, 0)} items
          </span>
        </div>
      </button>
    </div>
  )
})

function MiniSpec({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-cockpit-text-dim bg-cockpit-bg/80 px-2 py-1 rounded-lg border border-cockpit-border/30">
      {icon}
      <span className="text-cockpit-text-secondary">{value}</span>
    </span>
  )
}
