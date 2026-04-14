import { useState } from 'react'
import type { Aircraft } from './types'
import { AircraftSelector } from './components/AircraftSelector'
import { ChecklistView } from './components/ChecklistView'
import { Moon, Sun, Lightbulb } from 'lucide-react'
import { useTheme } from './hooks/useTheme'

type Theme = 'dark' | 'night' | 'day'

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  night: 'Night (amber)',
  day: 'Day',
}

export default function App() {
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null)
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const themes: Theme[] = ['dark', 'night', 'day']
    const idx = themes.indexOf(theme)
    setTheme(themes[(idx + 1) % themes.length])
  }

  return (
    <>
      {/* Floating theme toggle — only show on home screen, not in checklist */}
      {!selectedAircraft && (
        <button
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABELS[theme]}`}
          className="fixed bottom-6 right-5 z-40 flex items-center gap-2 px-3 py-2 rounded-full
                     bg-cockpit-panel border border-cockpit-border shadow-cockpit text-xs text-cockpit-text-secondary
                     hover:border-cockpit-amber/40 hover:text-cockpit-text-primary transition-all duration-200"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
        >
          {theme === 'dark' && <Moon className="w-3.5 h-3.5" />}
          {theme === 'night' && <Lightbulb className="w-3.5 h-3.5 text-amber-400" />}
          {theme === 'day' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
          <span>{THEME_LABELS[theme]}</span>
        </button>
      )}

      {selectedAircraft ? (
        <ChecklistView
          aircraft={selectedAircraft}
          onBack={() => setSelectedAircraft(null)}
          onCycleTheme={cycleTheme}
          theme={theme}
        />
      ) : (
        <AircraftSelector onSelect={setSelectedAircraft} />
      )}
    </>
  )
}
