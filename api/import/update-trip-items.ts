import type { VercelRequest, VercelResponse } from '@vercel/node'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

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
          notes: { type: ['string', 'null'], description: 'Updated notes merging old and new info, or null if unchanged' },
          date: { type: ['string', 'null'], description: 'New YYYY-MM-DD date, or null if unchanged' },
          confidence: {
            type: ['string', 'null'],
            enum: ['confirmed', 'possible', 'questionable', null],
            description: 'New confidence level, or null if unchanged',
          },
          category: { type: ['string', 'null'], description: 'New category, or null if unchanged' },
          area: { type: ['string', 'null'], description: 'New area, or null if unchanged' },
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

  const { text, existingItems } = (req.body ?? {}) as {
    text?: string
    existingItems?: ExistingItem[]
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' })
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

  const systemPrompt = `You are an assistant that updates existing trip items based on new information from the user.

The user will provide new information — it could be booking confirmations, updated plans, schedule changes, price corrections, new notes, etc.

Your task:
1. Match the new information to the correct EXISTING trip items by their content/title/context.
2. For each matched item, return ONLY the fields that need to change. Set unchanged fields to null.
3. Only return items that actually need updates — do NOT include items where nothing changes.
4. If the new information doesn't match any existing item, ignore it (this endpoint only updates, never creates).

Rules for updating:
- title: only change if the new info gives a meaningfully better/corrected name. Null if no change.
- date: update to YYYY-MM-DD if a more precise or corrected date is provided. Null if no change.
- confidence: upgrade to "confirmed" when tickets/bookings are bought, or adjust based on context. Null if no change.
- notes: when updating notes, MERGE the new information with the existing notes intelligently:
  * Keep existing useful info (logistics, transport details, accommodation) that is still valid
  * ADD new info (booking refs, exact times, confirmed details)
  * REMOVE outdated or contradicted info (old price estimates replaced by actual prices, wrong schedules)
  * Result should be clean, well-organized Russian text
  * If notes don't change, set to null
- cost_estimate: update with actual/corrected price. Null if no change.
- duration_estimate: update if new info gives better estimate. Null if no change.
- category, area: update if new info provides better context. Null if no change.

Write all text fields in Russian (except proper nouns which keep original form).

EXISTING TRIP ITEMS:
${itemsList}`

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
          { role: 'user', content: text },
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
