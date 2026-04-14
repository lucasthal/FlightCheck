import { useState, useCallback, useEffect } from 'react'
import type { Aircraft, ChecklistState } from '../types'

const STORAGE_KEY = 'pilot-checklist-state'

function loadState(): Record<string, ChecklistState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveState(state: Record<string, ChecklistState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage errors
  }
}

export function useChecklist(aircraft: Aircraft | null) {
  const [allStates, setAllStates] = useState<Record<string, ChecklistState>>(loadState)
  const [activePhaseId, setActivePhaseId] = useState<string>('')

  const state: ChecklistState | null = aircraft
    ? allStates[aircraft.id] ?? null
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
      const next = { ...prev, [aircraftId]: newState }
      saveState(next)
      return next
    })
    setActivePhaseId(firstPhaseId)
  }, [])

  const resetFlight = useCallback((aircraftId: string, firstPhaseId: string) => {
    initFlight(aircraftId, firstPhaseId)
  }, [initFlight])

  // Set active phase
  const selectPhase = useCallback((phaseId: string) => {
    setActivePhaseId(phaseId)
    if (aircraft) {
      setAllStates(prev => {
        const cur = prev[aircraft.id]
        if (!cur) return prev
        const next = { ...prev, [aircraft.id]: { ...cur, phaseId } }
        saveState(next)
        return next
      })
    }
  }, [aircraft])

  // Toggle a single checklist item
  const toggleItem = useCallback((itemId: string) => {
    if (!aircraft) return
    setAllStates(prev => {
      const cur = prev[aircraft.id]
      if (!cur) return prev
      const checked = !cur.checkedItems[itemId]
      const newChecked = { ...cur.checkedItems, [itemId]: checked }
      const next = { ...prev, [aircraft.id]: { ...cur, checkedItems: newChecked } }
      saveState(next)
      return next
    })
  }, [aircraft])

  // Mark a phase complete
  const completePhase = useCallback((phaseId: string) => {
    if (!aircraft) return
    setAllStates(prev => {
      const cur = prev[aircraft.id]
      if (!cur) return prev
      const completedPhases = cur.completedPhases.includes(phaseId)
        ? cur.completedPhases
        : [...cur.completedPhases, phaseId]
      const next = { ...prev, [aircraft.id]: { ...cur, completedPhases } }
      saveState(next)
      return next
    })
  }, [aircraft])

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

  // Auto-initialize if we have an aircraft but no state yet
  useEffect(() => {
    if (aircraft && !allStates[aircraft.id]) {
      const firstPhase = aircraft.phases.find(p => p.category !== 'emergency')
      if (firstPhase) {
        initFlight(aircraft.id, firstPhase.id)
      }
    } else if (aircraft && allStates[aircraft.id]) {
      setActivePhaseId(allStates[aircraft.id].phaseId)
    }
  }, [aircraft, allStates, initFlight])

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
