import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const PLACE_PHOTOS_BUCKET = 'place-photos'

export function placePhotoUrl(storagePath: string) {
  return supabase.storage.from(PLACE_PHOTOS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}
