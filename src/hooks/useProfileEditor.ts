import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ProfilePhase, ProfileItem, ItemSeverity, PhaseCategory } from '../types'

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function useProfileEditor() {
  const [phases, setPhases] = useState<ProfilePhase[]>([])
  const originalRef = useRef<ProfilePhase[]>([])

  const load = useCallback((incoming: ProfilePhase[]) => {
    const copy = deepCopy(incoming)
    setPhases(copy)
    originalRef.current = deepCopy(incoming)
  }, [])

  const isDirty = JSON.stringify(phases) !== JSON.stringify(originalRef.current)

  const addItem = useCallback((phaseId: string, item: Omit<ProfileItem, 'id' | 'position'>) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      const newItem: ProfileItem = { ...item, id: crypto.randomUUID(), position: ph.items.length }
      return { ...ph, items: [...ph.items, newItem] }
    }))
  }, [])

  const updateItem = useCallback((phaseId: string, itemId: string, patch: Partial<Pick<ProfileItem, 'action' | 'response' | 'note' | 'severity'>>) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      return { ...ph, items: ph.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
    }))
  }, [])

  const deleteItem = useCallback((phaseId: string, itemId: string) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      return { ...ph, items: ph.items.filter(i => i.id !== itemId).map((i, idx) => ({ ...i, position: idx })) }
    }))
  }, [])

  const reorderItems = useCallback((phaseId: string, newOrder: string[]) => {
    setPhases(prev => prev.map(ph => {
      if (ph.id !== phaseId) return ph
      const itemMap = new Map(ph.items.map(i => [i.id, i]))
      return { ...ph, items: newOrder.map((id, idx) => ({ ...itemMap.get(id)!, position: idx })) }
    }))
  }, [])

  const addPhase = useCallback((title: string, category: PhaseCategory) => {
    setPhases(prev => [...prev, {
      id: crypto.randomUUID(),
      title,
      category,
      position: prev.length,
      items: [],
    }])
  }, [])

  const updatePhase = useCallback((phaseId: string, patch: Partial<Pick<ProfilePhase, 'title' | 'category'>>) => {
    setPhases(prev => prev.map(ph => ph.id === phaseId ? { ...ph, ...patch } : ph))
  }, [])

  const deletePhase = useCallback((phaseId: string) => {
    setPhases(prev =>
      prev.filter(ph => ph.id !== phaseId).map((ph, idx) => ({ ...ph, position: idx }))
    )
  }, [])

  const reorderPhases = useCallback((newOrder: string[]) => {
    setPhases(prev => {
      const phaseMap = new Map(prev.map(ph => [ph.id, ph]))
      return newOrder.map((id, idx) => ({ ...phaseMap.get(id)!, position: idx }))
    })
  }, [])

  const save = useCallback(async (profileId: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('profile_phases')
      .delete()
      .eq('profile_id', profileId)
    if (deleteError) throw deleteError

    for (const phase of phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from('profile_phases')
        .insert({ profile_id: profileId, position: phase.position, title: phase.title, category: phase.category })
        .select('id')
        .single()
      if (phaseError) throw phaseError

      if (phase.items.length > 0) {
        const { error: itemError } = await supabase.from('profile_items').insert(
          phase.items.map((item, j) => ({
            phase_id: phaseData.id, position: j,
            action: item.action,
            response: item.response ?? null,
            note: item.note ?? null,
            severity: item.severity ?? null,
          }))
        )
        if (itemError) throw itemError
      }
    }

    const { error: updateError } = await supabase
      .from('checklist_profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profileId)
    if (updateError) throw updateError

    originalRef.current = deepCopy(phases)
  }, [phases])

  const reset = useCallback(() => {
    setPhases(deepCopy(originalRef.current))
  }, [])

  return { phases, isDirty, load, addItem, updateItem, deleteItem, reorderItems, addPhase, updatePhase, deletePhase, reorderPhases, save, reset }
}
