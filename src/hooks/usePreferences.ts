import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  type UserPreferences,
  type Theme,
  DEFAULT_PREFERENCES,
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
    return JSON.parse(raw) as UserPreferences
  } catch {
    return null
  }
}

function writeLocalPreferences(prefs: UserPreferences): void {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs))
}

export function usePreferences(user: User | null): UsePreferencesResult {
  // Initialize synchronously from localStorage so every instance of this hook
  // (App, SettingsSheet, ChecklistView) starts at the user's saved theme
  // rather than DEFAULT_PREFERENCES. Without this, mounting a new instance
  // briefly applies the default theme via its useEffect, overriding the saved
  // theme — symptom: navigating from home → checklist reverted to dark.
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
            default_aircraft_id: data.default_aircraft_id ?? DEFAULT_PREFERENCES.default_aircraft_id,
            autoscroll:          data.autoscroll          ?? DEFAULT_PREFERENCES.autoscroll,
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
    if (preferences.theme === 'dark' || preferences.theme === 'night') {
      root.classList.add('dark')
    }
    if (preferences.theme === 'night') root.classList.add('theme-night')
    if (preferences.theme === 'day')   root.classList.add('theme-day')
  }, [preferences.theme])

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
