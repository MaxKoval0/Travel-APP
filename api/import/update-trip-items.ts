import type { VercelRequest, VercelResponse } from '@vercel/node'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o'

interface ExistingItem {
  id: string
  title: string
  notes: string | null
  date: string | null
  confidence: 'confirmed' | 'possible' | 'questionable' | null
  category: string | null
  area: string | null
  cost_estimate: string | null
  duration_estimate: string | null
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'ID of the existing trip item to update' },
          title: { type: ['string', 'null'], description: 'New title, or null if unchanged' },
          notes: { type: ['string', 'null'], description: 'Fully rewritten notes, or null if unchanged' },
          date: { type: ['string', 'null'], description: 'New YYYY-MM-DD date, or null if unchanged' },
          confidence: {
            type: ['string', 'null'],
            enum: ['confirmed', 'possible', 'questionable', null],
            description: 'New confidence level, or null if unchanged',
          },
          category: { type: ['string', 'null'], description: 'New category, or null if unchanged' },
          area: { type: ['string', 'null'], description: 'New area grouping, or null if unchanged' },
          cost_estimate: { type: ['string', 'null'], description: 'New cost estimate, or null if unchanged' },
          duration_estimate: { type: ['string', 'null'], description: 'New duration estimate, or null if unchanged' },
        },
        required: ['item_id', 'title', 'notes', 'date', 'confidence', 'category', 'area', 'cost_estimate', 'duration_estimate'],
        additionalProperties: false,
      },
    },
  },
  required: ['updates'],
  additionalProperties: false,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { text, images, existingItems } = (req.body ?? {}) as {
    text?: string
    images?: string[]
    existingItems?: ExistingItem[]
  }

  const hasText = text && typeof text === 'string' && text.trim()
  const hasImages = images && images.length > 0

  if (!hasText && !hasImages) {
    res.status(400).json({ error: 'text or images required' })
    return
  }

  if (!existingItems || existingItems.length === 0) {
    res.status(400).json({ error: 'existingItems is required' })
    return
  }

  const itemsList = existingItems
    .map(
      (item) =>
        `ID: ${item.id}\n  Название: ${item.title}\n  Дата: ${item.date ?? '—'}\n  Уверенность: ${item.confidence ?? '—'}\n  Категория: ${item.category ?? '—'}\n  Район: ${item.area ?? '—'}\n  Цена: ${item.cost_estimate ?? '—'}\n  Длительность: ${item.duration_estimate ?? '—'}\n  Заметки: ${item.notes ?? '—'}`,
    )
    .join('\n\n')

  const systemPrompt = `You update existing trip items when the user provides new CONFIRMED information (bought tickets, hotel bookings, finalized plans). The user may provide text, photos of tickets/bookings, or both. Extract all relevant details from images (dates, times, prices, routes, booking refs, hotel names).

CORE PRINCIPLE: The user's existing notes contain PRELIMINARY research — approximate prices, speculative routes, uncertain accommodation. When the user provides confirmed info (bought tickets, booked hotel), that REPLACES the old speculation. Do not blend old guesses with new facts.

THINK HOLISTICALLY: A single piece of confirmed info can affect MULTIPLE items. Example: user buys a bus ticket "Valencia → Benidorm" and says they'll be based in Benidorm for 2 days visiting 3 nearby locations. You MUST update ALL 3 location items:
- Replace "how to get there from Valencia/Alicante" with "how to get there from Benidorm"
- Replace "Ночёвка: в Аликанте или Бенидорме" with "Ночёвка: база в Бенидорме"
- Distribute dates across the items based on the confirmed schedule
- Remove old cost estimates for transport TO the base city (ticket is already bought)

For EACH existing item, ask: "Does the user's new info change how this item's logistics work?" If yes, update it.

RULES FOR NOTES — full rewrite, not merge:
When you update notes, write them FROM SCRATCH as a clean finalized plan:
1. REMOVE all old speculative transport routes, prices, and transfer points that are now known
2. REMOVE old accommodation guesses when confirmed (or when base city is now clear)
3. REMOVE old cost estimates for transport already purchased
4. KEEP useful site-specific info: trail names/distances, tips ("arrive before 9am"), opening hours, specific site descriptions
5. ADD confirmed details: exact departure times, booking refs, hotel names, confirmed prices
6. For items NEAR a confirmed base city, write local transport (base city → item location), not long-distance transport that's already handled
7. The notes should read as a FINALIZED plan, not a mix of old research and new bookings

OTHER FIELDS:
- confidence: set to "confirmed" when tickets/bookings make this item part of a definite plan
- date: YYYY-MM-DD based on confirmed schedule. Deduce from context: arrival/departure dates define the window, distribute items logically within it
- cost_estimate: set to "" (empty) when old estimates are superseded by purchased tickets without a stated price. Set new price only if user explicitly states it
- duration_estimate: update if the confirmed schedule implies a different duration
- area: set to the base city name if the item is near that base (helps group items)

IMPORTANT: only return items that ACTUALLY change. If a field's new value equals the old value, set it to null. Do not return no-op updates.

Write all text in Russian (except proper nouns).

EXISTING TRIP ITEMS:
${itemsList}`

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

  if (hasText) {
    userContent.push({ type: 'text', text: text!.trim() })
  }

  if (hasImages) {
    for (const img of images!) {
      userContent.push({
        type: 'image_url',
        image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` },
      })
    }
    if (!hasText) {
      userContent.push({ type: 'text', text: 'Проанализируй эти фото/скриншоты и обнови соответствующие пункты поездки.' })
    }
  }

  let openaiResponse: Response
  try {
    openaiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'trip_item_updates', strict: true, schema: RESPONSE_SCHEMA },
        },
      }),
    })
  } catch {
    res.status(502).json({ error: 'Could not reach OpenAI' })
    return
  }

  if (!openaiResponse.ok) {
    const body = await openaiResponse.text()
    res.status(502).json({ error: `OpenAI error (${openaiResponse.status}): ${body.slice(0, 300)}` })
    return
  }

  const data = await openaiResponse.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    res.status(502).json({ error: 'OpenAI returned no content' })
    return
  }

  let parsed: { updates: Record<string, unknown>[] }
  try {
    parsed = JSON.parse(content)
  } catch {
    res.status(502).json({ error: 'OpenAI returned invalid JSON' })
    return
  }

  const validIds = new Set(existingItems.map((i) => i.id))
  parsed.updates = parsed.updates.filter((u) => validIds.has(u.item_id as string))

  res.status(200).json(parsed)
}
