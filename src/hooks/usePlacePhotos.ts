import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, PLACE_PHOTOS_BUCKET } from '../lib/supabase'
import type { PlacePhoto } from '../lib/database.types'

export function usePlacePhotos(placeId: string | null | undefined) {
  return useQuery({
    queryKey: ['place-photos', placeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('place_photos')
        .select('*')
        .eq('place_id', placeId!)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!placeId,
  })
}

export function useUploadPlacePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placeId, file }: { placeId: string; file: File }) => {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${placeId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(PLACE_PHOTOS_BUCKET).upload(path, file)
      if (uploadError) throw uploadError
      const { data, error } = await supabase
        .from('place_photos')
        .insert({ place_id: placeId, storage_path: path })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['place-photos', data.place_id] }),
  })
}

export function useAddPlacePhotoFromUrl() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placeId, imageUrl }: { placeId: string; imageUrl: string }) => {
      const res = await fetch('/api/photos/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: placeId, image_url: imageUrl }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Загрузка не удалась (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['place-photos', variables.placeId] }),
  })
}

export function useDeletePlacePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photo: PlacePhoto) => {
      await supabase.storage.from(PLACE_PHOTOS_BUCKET).remove([photo.storage_path])
      const { error } = await supabase.from('place_photos').delete().eq('id', photo.id)
      if (error) throw error
    },
    onSuccess: (_data, photo) => qc.invalidateQueries({ queryKey: ['place-photos', photo.place_id] }),
  })
}

export function useSetPrimaryPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placeId, photoId }: { placeId: string; photoId: string }) => {
      await supabase.from('place_photos').update({ is_primary: false }).eq('place_id', placeId)
      const { error } = await supabase.from('place_photos').update({ is_primary: true }).eq('id', photoId)
      if (error) throw error
    },
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['place-photos', variables.placeId] }),
  })
}
