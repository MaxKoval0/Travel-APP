import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Place } from '../lib/database.types'

const placesKey = ['places'] as const

export function usePlaces() {
  return useQuery({
    queryKey: placesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function usePlace(id: string | null | undefined) {
  return useQuery({
    queryKey: [...placesKey, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('places').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function usePlaceTrips(placeId: string | null | undefined) {
  return useQuery({
    queryKey: ['place-trips', placeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_items')
        .select('id, trip_id, trips(id, title, status)')
        .eq('place_id', placeId!)
      if (error) throw error
      return data
    },
    enabled: !!placeId,
  })
}

export function useCreatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (place: {
      name: string
      lat: number
      lng: number
      status: Place['status']
      description?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase.from('places').insert(place).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: placesKey }),
  })
}

export function useUpdatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<Place, 'id'>> & { id: string }) => {
      const { data, error } = await supabase.from('places').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: placesKey })
      qc.invalidateQueries({ queryKey: [...placesKey, data.id] })
    },
  })
}

export function useDeletePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('places').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: placesKey }),
  })
}
