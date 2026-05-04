import { useState, useCallback, useEffect } from 'react'
import type { Aircraft, ChecklistState } from '../types'

function storageKey(profileId: string | null, aircraftId: string): string {
  if (profileId) return `flightcheck-checklist-state-${profileId}`
  return `flightcheck-checklist-state-original-${aircraftId}`
}

function loadState(key: string): Record<string, ChecklistState> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, ChecklistState>) : {}
  } catch {
    return {}
  }
}

function saveState(key: string, state: Record<string, ChecklistState>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

/**
 * Migrate a single entry from the legacy flat 'pilot-checklist-state' key
 * into the new per-profile key format. Runs once per mount when the new key
 * is absent. Does NOT remove the old key (kept as dead data for safety).
 */
function migrateIfNeeded(newKey: string, aircraftId: string, profileId: string | null): void {
  const OLD_KEY = 'pilot-checklist-state'
  const oldRaw = localStorage.getItem(OLD_KEY)
  if (!oldRaw) return
  if (localStorage.getItem(newKey)) return
  try {
    const old = JSON.parse(oldRaw) as Record<string, ChecklistState>
    const match = old[aircraftId]
    if (match) {
      const stateKey = profileId ?? aircraftId
      localStorage.setItem(newKey, JSON.stringify({ [stateKey]: match }))
    }
  } catch {
    // ignore — migration is best-effort
  }
}

export function useChecklist(aircraft: Aircraft | null, profileId: string | null) {
  const key = aircraft ? storageKey(profileId, aircraft.id) : ''
  const stateKey = profileId ?? aircraft?.id ?? ''

  const [allStates, setAllStates] = useState<Record<string, ChecklistState>>(() => {
    if (!aircraft) return {}
    const newKey = storageKey(profileId, aircraft.id)
    migrateIfNeeded(newKey, aircraft.id, profileId)
    return loadState(newKey)
  })
  const [activePhaseId, setActivePhaseId] = useState<string>('')

  const state: ChecklistState | null = aircraft
    ? allStates[stateKey] ?? null
    : null

  // Initialize or reset a flight session
  const initFlight = useCallback((aircraftId: string, firstPhaseId: string) => {
    const newState: ChecklistState = {
      aircraftId,
      phaseId: firstPhaseId,
      checkedItems: {},
      startedAt: new Date().toISOString(),
      completedPhases: [],
    }
    setAllStates(prev => {
      const next = { ...prev, [stateKey]: newState }
      saveState(key, next)
      return next
    })
    setActivePhaseId(firstPhaseId)
  }, [key, stateKey])

  const resetFlight = useCallback((aircraftId: string, firstPhaseId: string) => {
    initFlight(aircraftId, firstPhaseId)
  }, [initFlight])

  // Set active phase
  const selectPhase = useCallback((phaseId: string) => {
    setActivePhaseId(phaseId)
    if (aircraft) {
      setAllStates(prev => {
        const cur = prev[stateKey]
        if (!cur) return prev
        const next = { ...prev, [stateKey]: { ...cur, phaseId } }
        saveState(key, next)
        return next
      })
    }
  }, [aircraft, key, stateKey])

  // Toggle a single checklist item
  const toggleItem = useCallback((itemId: string) => {
    if (!aircraft) return
    setAllStates(prev => {
      const cur = prev[stateKey]
      if (!cur) return prev
      const checked = !cur.checkedItems[itemId]
      const newChecked = { ...cur.checkedItems, [itemId]: checked }
      const next = { ...prev, [stateKey]: { ...cur, checkedItems: newChecked } }
      saveState(key, next)
      return next
    })
  }, [aircraft, key, stateKey])

  // Mark a phase complete
  const completePhase = useCallback((phaseId: string) => {
    if (!aircraft) return
    setAllStates(prev => {
      const cur = prev[stateKey]
      if (!cur) return prev
      const completedPhases = cur.completedPhases.includes(phaseId)
        ? cur.completedPhases
        : [...cur.completedPhases, phaseId]
      const next = { ...prev, [stateKey]: { ...cur, completedPhases } }
      saveState(key, next)
      return next
    })
  }, [aircraft, key, stateKey])

  // Compute per-phase item counts
  const getPhaseProgress = useCallback((phaseId: string): { checked: number; total: number } => {
    if (!aircraft || !state) return { checked: 0, total: 0 }
    const phase = aircraft.phases.find(p => p.id === phaseId)
    if (!phase) return { checked: 0, total: 0 }
    const total = phase.items.length
    const checked = phase.items.filter(i => state.checkedItems[i.id]).length
    return { checked, total }
  }, [aircraft, state])

  const isItemChecked = useCallback((itemId: string): boolean => {
    return state?.checkedItems[itemId] ?? false
  }, [state])

  const isPhaseComplete = useCallback((phaseId: string): boolean => {
    return state?.completedPhases.includes(phaseId) ?? false
  }, [state])

  // Re-initialise state when aircraft or profileId changes (different key)
  useEffect(() => {
    if (!aircraft) return
    const newKey = storageKey(profileId, aircraft.id)
    migrateIfNeeded(newKey, aircraft.id, profileId)
    const loaded = loadState(newKey)
    setAllStates(loaded)
    const existing = loaded[stateKey]
    if (existing) {
      setActivePhaseId(existing.phaseId)
    } else {
      const firstPhase = aircraft.phases.find(p => p.category !== 'emergency')
      if (firstPhase) initFlight(aircraft.id, firstPhase.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraft?.id, profileId])

  return {
    state,
    activePhaseId,
    selectPhase,
    toggleItem,
    completePhase,
    resetFlight,
    initFlight,
    getPhaseProgress,
    isItemChecked,
    isPhaseComplete,
  }
}
