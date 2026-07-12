import { useState, useEffect, useContext, createContext, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import {
  type UserPreferences,
  type Theme,
  DEFAULT_PREFERENCES,
  COLOR_PALETTES,
} from '../types'

const LS_KEY = 'flightcheck-preferences'
const LEGACY_THEME_KEY = 'pilot-theme'

const TEXT_SCALE: Record<UserPreferences['text_size'], number> = {
  sm: 0.875,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
}

interface UsePreferencesResult {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  loading: boolean
}

function readLocalPreferences(): UserPreferences | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) }
    if (!COLOR_PALETTES.includes(parsed.color_palette)) parsed.color_palette = DEFAULT_PREFERENCES.color_palette
    return parsed
  } catch {
    return null
  }
}

function writeLocalPreferences(prefs: UserPreferences): void {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs))
}

// Internal hook that actually owns the preferences state and runs side effects.
// Only called once, from PreferencesProvider — every other call site reads via
// the context.
function useProvidePreferences(user: User | null): UsePreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences>(
    () => readLocalPreferences() ?? DEFAULT_PREFERENCES
  )
  const [loading, setLoading] = useState(true)

  // ── Load preferences ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    if (!user) {
      const local = readLocalPreferences()
      if (local) setPreferences(local)
      setLoading(false)
      return () => { cancelled = true }
    }

    setLoading(true)

    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return

        if (!error && data) {
          const loaded: UserPreferences = {
            theme:               data.theme               ?? DEFAULT_PREFERENCES.theme,
            text_size:           data.text_size           ?? DEFAULT_PREFERENCES.text_size,
            keep_screen_awake:   data.keep_screen_awake   ?? DEFAULT_PREFERENCES.keep_screen_awake,
            autoscroll:          data.autoscroll          ?? DEFAULT_PREFERENCES.autoscroll,
            haptic_feedback:     data.haptic_feedback     ?? DEFAULT_PREFERENCES.haptic_feedback,
            color_palette:       COLOR_PALETTES.includes(data.color_palette) ? data.color_palette : DEFAULT_PREFERENCES.color_palette,
          }
          setPreferences(loaded)
          writeLocalPreferences(loaded)
          setLoading(false)
        } else if (error?.code === 'PGRST116') {
          const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY) as Theme | null
          const defaults: UserPreferences = {
            ...DEFAULT_PREFERENCES,
            theme: legacyTheme ?? DEFAULT_PREFERENCES.theme,
          }

          supabase
            .from('user_preferences')
            .upsert({ user_id: user.id, ...defaults }, { onConflict: 'user_id' })
            .then(() => {
              if (cancelled) return
              localStorage.removeItem(LEGACY_THEME_KEY)
              setPreferences(defaults)
              writeLocalPreferences(defaults)
              setLoading(false)
            })
        } else {
          const local = readLocalPreferences()
          if (local) setPreferences(local)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Side effects: theme ─────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'theme-night', 'theme-day')
    COLOR_PALETTES.forEach(p => root.classList.remove(`palette-${p}`))
    if (preferences.theme === 'dark' || preferences.theme === 'night') {
      root.classList.add('dark')
    }
    if (preferences.theme === 'night') root.classList.add('theme-night')
    if (preferences.theme === 'day')   root.classList.add('theme-day')
    root.classList.add(`palette-${preferences.color_palette}`)
  }, [preferences.theme, preferences.color_palette])

  // ── Side effects: text size ─────────────────────────────────────
  useEffect(() => {
    document.body.style.setProperty('--text-scale', String(TEXT_SCALE[preferences.text_size]))
  }, [preferences.text_size])

  // ── updatePreference ────────────────────────────────────────────
  function updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPreferences(prev => {
      const next = { ...prev, [key]: value }
      writeLocalPreferences(next)
      return next
    })

    if (user) {
      supabase
        .from('user_preferences')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ [key]: value, updated_at: new Date().toISOString() } as any)
        .eq('user_id', user.id)
    }
  }

  return { preferences, updatePreference, loading }
}

// ── Context wiring ────────────────────────────────────────────────
const PreferencesContext = createContext<UsePreferencesResult | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const value = useProvidePreferences(user)
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// The exported hook every component uses. Reads from the single Provider above,
// so all consumers share the same state — no per-instance Supabase loads, no
// races between SettingsSheet updates and ChecklistView re-fetches.
export function usePreferences(): UsePreferencesResult {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
