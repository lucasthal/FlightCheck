import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useFavorites() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setFavorites([])
      return
    }
    setLoading(true)
    Promise.resolve(
      supabase
        .from('favorites')
        .select('aircraft_id')
        .eq('user_id', user.id)
    )
      .then(({ data }) => {
        setFavorites(data?.map((r: { aircraft_id: string }) => r.aircraft_id) ?? [])
      })
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false))
  }, [user])

  const toggle = useCallback(async (aircraftId: string) => {
    if (!user) return
    const wasFav = favorites.includes(aircraftId)

    // Optimistic update
    setFavorites(prev =>
      wasFav ? prev.filter(id => id !== aircraftId) : [...prev, aircraftId]
    )

    if (wasFav) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('aircraft_id', aircraftId)
      if (error) setFavorites(prev => [...prev, aircraftId]) // revert
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, aircraft_id: aircraftId })
      if (error) setFavorites(prev => prev.filter(id => id !== aircraftId)) // revert
    }
  }, [user, favorites])

  const isFavorite = useCallback(
    (aircraftId: string) => favorites.includes(aircraftId),
    [favorites]
  )

  return { favorites, loading, toggle, isFavorite }
}
