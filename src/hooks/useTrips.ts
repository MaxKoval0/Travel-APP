import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Trip } from '../lib/database.types'

const tripsKey = ['trips'] as const

export function useTrips() {
  return useQuery({
    queryKey: tripsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('date_start', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data
    },
  })
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: [...tripsKey, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (trip: {
      title: string
      date_start?: string | null
      date_end?: string | null
      status?: Trip['status']
      description?: string | null
    }) => {
      const { data, error } = await supabase.from('trips').insert(trip).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripsKey }),
  })
}

export function useUpdateTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<Trip, 'id'>> & { id: string }) => {
      const { data, error } = await supabase.from('trips').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: tripsKey })
      qc.invalidateQueries({ queryKey: [...tripsKey, data.id] })
    },
  })
}

export function useDeleteTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripsKey }),
  })
}
