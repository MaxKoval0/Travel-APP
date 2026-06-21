import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const MAX_BYTES = 15 * 1024 * 1024
const BUCKET = 'place-photos'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permissive CORS: this app has no auth, and callers include browser-based
  // tools (e.g. a Claude artifact) running on origins we don't control.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { place_id, image_url, is_primary } = req.body ?? {}

  if (!place_id || typeof place_id !== 'string') {
    res.status(400).json({ error: 'place_id is required' })
    return
  }
  if (!image_url || typeof image_url !== 'string') {
    res.status(400).json({ error: 'image_url is required' })
    return
  }

  let imageResponse: Response
  try {
    imageResponse = await fetch(image_url)
  } catch {
    res.status(400).json({ error: 'Could not fetch image_url' })
    return
  }

  if (!imageResponse.ok) {
    res.status(400).json({ error: `image_url returned ${imageResponse.status}` })
    return
  }

  const contentType = imageResponse.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    res.status(400).json({ error: `image_url did not return an image (content-type: ${contentType})` })
    return
  }

  const contentLength = Number(imageResponse.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BYTES) {
    res.status(400).json({ error: 'Image is too large (max 15MB)' })
    return
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) {
    res.status(400).json({ error: 'Image is too large (max 15MB)' })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg'
  const storagePath = `${place_id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType })

  if (uploadError) {
    res.status(500).json({ error: `Storage upload failed: ${uploadError.message}` })
    return
  }

  const { data, error: insertError } = await supabase
    .from('place_photos')
    .insert({ place_id, storage_path: storagePath, is_primary: Boolean(is_primary) })
    .select()
    .single()

  if (insertError) {
    res.status(500).json({ error: `DB insert failed: ${insertError.message}` })
    return
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  res.status(200).json({ ...data, public_url: publicUrlData.publicUrl })
}
