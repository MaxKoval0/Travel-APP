import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TripItem, TripItemConfidence } from '../lib/database.types'

export function useTripItems(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-items', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_items')
        .select('*, places(id, name, lat, lng, tourist_status, fpv_status, visited)')
        .eq('trip_id', tripId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!tripId,
  })
}

export function useCreateTripItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: {
      trip_id: string
      title: string
      place_id?: string | null
      notes?: string | null
      date?: string | null
      lat?: number | null
      lng?: number | null
      sort_order?: number
      confidence?: TripItemConfidence | null
      category?: string | null
      area?: string | null
      cost_estimate?: string | null
      duration_estimate?: string | null
    }) => {
      const { data, error } = await supabase.from('trip_items').insert(item).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['trip-items', data.trip_id] }),
  })
}

export function useUpdateTripItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<TripItem, 'id'>> & { id: string }) => {
      const { data, error } = await supabase.from('trip_items').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['trip-items', data.trip_id] }),
  })
}

export function useDeleteTripItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: { id: string; trip_id: string }) => {
      const { error } = await supabase.from('trip_items').delete().eq('id', item.id)
      if (error) throw error
    },
    onSuccess: (_data, item) => qc.invalidateQueries({ queryKey: ['trip-items', item.trip_id] }),
  })
}

export function useReorderTripItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tripId, items }: { tripId: string; items: { id: string; sort_order: number }[] }) => {
      await Promise.all(
        items.map(({ id, sort_order }) => supabase.from('trip_items').update({ sort_order }).eq('id', id)),
      )
      return tripId
    },
    onSuccess: (tripId) => qc.invalidateQueries({ queryKey: ['trip-items', tripId] }),
  })
}
