import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Aircraft, PhaseCategory, ItemSeverity, Profile, ProfilePhase, ProfileItem } from '../types'
import { PROFILE_QUESTIONS } from '../data/profileQuestions'

type RawItem = {
  id: string; action: string; response: string | null; note: string | null
  severity: string | null; position: number
}
type RawPhase = {
  id: string; title: string; category: string; position: number
  profile_items: RawItem[]
}
type RawProfile = {
  id: string; name: string; aircraft_id: string; is_active: boolean
  profile_phases: RawPhase[]
}

function mapProfile(raw: RawProfile): Profile {
  return {
    id: raw.id,
    name: raw.name,
    aircraft_id: raw.aircraft_id,
    is_active: raw.is_active,
    phases: (raw.profile_phases ?? [])
      .sort((a, b) => a.position - b.position)
      .map((ph): ProfilePhase => ({
        id: ph.id,
        title: ph.title,
        category: ph.category as PhaseCategory,
        position: ph.position,
        items: (ph.profile_items ?? [])
          .sort((a, b) => a.position - b.position)
          .map((i): ProfileItem => ({
            id: i.id,
            action: i.action,
            response: i.response ?? undefined,
            note: i.note ?? undefined,
            severity: (i.severity as ItemSeverity) ?? undefined,
            position: i.position,
          })),
      })),
  }
}

const PROFILE_SELECT = `
  id, name, aircraft_id, is_active,
  profile_phases (
    id, title, category, position,
    profile_items ( id, action, response, note, severity, position )
  )
`

export function useProfiles(aircraftId: string) {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<Error | null>(null)

  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    if (!user) { setProfiles([]); return [] }
    setLoading(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from('checklist_profiles')
        .select(PROFILE_SELECT)
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
        .order('created_at')
      if (error) throw error
      const mapped = ((data ?? []) as RawProfile[]).map(mapProfile)
      setProfiles(mapped)
      return mapped
    } catch (err) {
      setFetchError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setLoading(false)
    }
  }, [user, aircraftId])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const createFromAircraft = useCallback(async (
    aircraft: Aircraft,
    name: string,
    enabledQuestions: Record<string, boolean> = {},
  ): Promise<Profile[]> => {
    if (!user) throw new Error('Not authenticated')

    const { data: profileData, error: profileError } = await supabase
      .from('checklist_profiles')
      .insert({ user_id: user.id, aircraft_id: aircraftId, name, is_active: false })
      .select('id')
      .single()
    if (profileError) throw profileError

    const orderedPhases = [...aircraft.phases].sort((a, b) => {
      const aEmerg = a.category === 'emergency' ? 1 : 0
      const bEmerg = b.category === 'emergency' ? 1 : 0
      return aEmerg - bEmerg
    })

    const phaseRows = orderedPhases.map((phase, i) => ({
      id: crypto.randomUUID(),
      profile_id: profileData.id,
      position: i,
      title: phase.name,
      category: phase.category,
    }))
    const { error: phaseError } = await supabase.from('profile_phases').insert(phaseRows)
    if (phaseError) throw phaseError

    // Compute setup extras keyed by phase index
    const phaseExtras: Record<number, Array<{ action: string; response: string }>> = {}
    for (const question of PROFILE_QUESTIONS) {
      if (!enabledQuestions[question.id]) continue
      for (const inj of question.injections) {
        let idx = orderedPhases.findIndex(p => p.category === inj.targetCategory)
        if (idx === -1 && inj.fallbackCategory) idx = orderedPhases.findIndex(p => p.category === inj.fallbackCategory)
        if (idx === -1) continue
        if (!phaseExtras[idx]) phaseExtras[idx] = []
        phaseExtras[idx].push({ action: inj.action, response: inj.response })
      }
    }

    // Build per-phase item arrays with setup extras appended at end
    const phaseItemArrays = orderedPhases.map((phase, i) => {
      const base = phase.items.map((item, j) => ({
        id: crypto.randomUUID(),
        phase_id: phaseRows[i].id,
        position: j,
        action: item.action,
        response: item.response ?? null,
        note: item.note ?? null,
        severity: item.severity ?? null,
      }))
      const extras = (phaseExtras[i] ?? []).map((extra, k) => ({
        id: crypto.randomUUID(),
        phase_id: phaseRows[i].id,
        position: base.length + k,
        action: extra.action,
        response: extra.response,
        note: null,
        severity: 'setup' as const,
      }))
      return [...base, ...extras]
    })

    const itemRows = phaseItemArrays.flat()
    if (itemRows.length > 0) {
      const { error: itemError } = await supabase.from('profile_items').insert(itemRows)
      if (itemError) throw itemError
    }

    const { error: rpcError } = await supabase.rpc('activate_profile', { p_profile_id: profileData.id })
    if (rpcError) throw rpcError

    // Build Profile from local data — no extra fetch round trip needed
    const newProfile: Profile = {
      id: profileData.id, name, aircraft_id: aircraftId, is_active: true,
      phases: phaseRows.map((phaseRow, i) => ({
        id: phaseRow.id,
        title: phaseRow.title,
        category: phaseRow.category as PhaseCategory,
        position: phaseRow.position,
        items: phaseItemArrays[i].map((row, j) => ({
          id: row.id,
          action: row.action,
          response: row.response ?? undefined,
          note: row.note ?? undefined,
          severity: (row.severity as ItemSeverity) ?? undefined,
          position: j,
        })),
      })),
    }
    const updated = [...profiles.map(p => ({ ...p, is_active: false })), newProfile]
    setProfiles(updated)
    return updated
  }, [user, aircraftId, profiles])

  const createFromProfile = useCallback(async (source: Profile, name: string): Promise<Profile[]> => {
    if (!user) throw new Error('Not authenticated')

    const { data: profileData, error: profileError } = await supabase
      .from('checklist_profiles')
      .insert({ user_id: user.id, aircraft_id: aircraftId, name, is_active: false })
      .select('id')
      .single()
    if (profileError) throw profileError

    const phaseRows = source.phases.map(phase => ({
      id: crypto.randomUUID(),
      profile_id: profileData.id,
      position: phase.position,
      title: phase.title,
      category: phase.category,
    }))
    const { error: phaseError } = await supabase.from('profile_phases').insert(phaseRows)
    if (phaseError) throw phaseError

    const itemRows = source.phases.flatMap((phase, i) =>
      phase.items.map(item => ({
        id: crypto.randomUUID(),
        phase_id: phaseRows[i].id,
        position: item.position,
        action: item.action,
        response: item.response ?? null,
        note: item.note ?? null,
        severity: item.severity ?? null,
      }))
    )
    if (itemRows.length > 0) {
      const { error: itemError } = await supabase.from('profile_items').insert(itemRows)
      if (itemError) throw itemError
    }

    const { error: rpcError } = await supabase.rpc('activate_profile', { p_profile_id: profileData.id })
    if (rpcError) throw rpcError

    let itemOffset = 0
    const newProfile: Profile = {
      id: profileData.id, name, aircraft_id: aircraftId, is_active: true,
      phases: phaseRows.map((phaseRow, i) => {
        const phaseItems = source.phases[i].items.map((item, j) => ({
          id: itemRows[itemOffset + j].id,
          action: item.action,
          response: item.response,
          note: item.note,
          severity: item.severity,
          position: item.position,
        }))
        itemOffset += source.phases[i].items.length
        return { id: phaseRow.id, title: phaseRow.title, category: phaseRow.category as PhaseCategory, position: phaseRow.position, items: phaseItems }
      }),
    }
    const updated = [...profiles.map(p => ({ ...p, is_active: false })), newProfile]
    setProfiles(updated)
    return updated
  }, [user, aircraftId, profiles])

  const deleteProfile = useCallback(async (profileId: string): Promise<void> => {
    const { error } = await supabase.from('checklist_profiles').delete().eq('id', profileId)
    if (error) throw error
    await fetchProfiles()
  }, [fetchProfiles])

  const renameProfile = useCallback(async (profileId: string, name: string): Promise<void> => {
    const { error } = await supabase.from('checklist_profiles').update({ name }).eq('id', profileId)
    if (error) throw error
    await fetchProfiles()
  }, [fetchProfiles])

  const setActive = useCallback(async (profileId: string | null): Promise<void> => {
    if (!user) return
    if (profileId === null) {
      await supabase
        .from('checklist_profiles')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
    } else {
      const { error: rpcError } = await supabase.rpc('activate_profile', { p_profile_id: profileId })
      if (rpcError) throw rpcError
    }
    await fetchProfiles()
  }, [user, aircraftId, fetchProfiles])

  const activeProfile = profiles.find(p => p.is_active) ?? null

  return { profiles, activeProfile, loading, fetchError, fetchProfiles, createFromAircraft, createFromProfile, deleteProfile, renameProfile, setActive }
}
