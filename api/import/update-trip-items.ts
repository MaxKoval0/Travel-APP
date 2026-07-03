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

  const systemPrompt = `You update existing trip items when the user provides new CONFIRMED information (bought tickets, hotel bookings, finalized plans).

CORE PRINCIPLE: The user's existing notes contain PRELIMINARY research — approximate prices, speculative routes, uncertain accommodation. When the user says they bought tickets or booked a hotel, that is CONFIRMED information that REPLACES the old speculation entirely. Do not blend old guesses with new facts.

Your task:
1. Match the new information to the correct EXISTING trip items by their content/title/context. Think broadly — a ticket "Valencia → Benidorm" affects ALL items near Benidorm (how to get there, where to base yourself, etc.), not just an item literally named "Benidorm".
2. For each matched item, return ONLY the fields that need to change. Set unchanged fields to null.
3. Only return items that actually need updates — do NOT include items where nothing changes.
4. If the new information doesn't match any existing item, ignore it (this endpoint only updates, never creates).

CRITICAL RULES FOR NOTES:
The existing notes typically contain speculative logistics like "Как добраться: поезд Валенсия → X ~Nч, ~N€". When the user provides confirmed ticket/booking info, you must:

1. DELETE all old speculative transport routes, prices, transfer points, and duration estimates that are now superseded.
   Example: old notes say "поезд Валенсия → Бенидорм ~2.5ч с пересадкой в Аликанте, ~3€" but user bought a direct bus ticket Valencia→Benidorm at 15:01 — DELETE the entire old transport paragraph and write the confirmed details.

2. DELETE old accommodation guesses when a hotel is booked.
   Example: old notes say "Ночёвка: база в Бенидорме или Аликанте" but user booked in Benidorm — write only the confirmed hotel, remove "или Аликанте".

3. DELETE old cost estimates when tickets are already purchased.
   If the user says "bought a ticket" without mentioning the price, that means the cost is settled and irrelevant — remove the old "~N€" estimate entirely. Only keep a price if the user explicitly states the new price.

4. APPLY LOGICAL IMPLICATIONS. Think through what the confirmed info means:
   - If tickets are to/from city X, the base is city X (not some other speculative city)
   - If a ticket departs at 10:47 on July 6, and another item is near the same area, the user has until July 6 morning for that item
   - If user says "I have 2 days for 3 locations near Benidorm", update the dates/duration for those items accordingly
   - If user books a hotel in town Y for dates A-B, items near town Y happen during those dates

5. KEEP only info that is NOT contradicted and still useful: trail names, distances, tips (like "arrive before 9am"), specific site details. Remove anything about "how to get there" or "where to stay" if it's been replaced by confirmed plans.

6. Write the resulting notes as clean, well-organized Russian text. The notes should read as a FINALIZED plan, not a mix of old research and new bookings.

OTHER FIELDS:
- confidence: set to "confirmed" when tickets/bookings are bought for this item or its transport. If an item was "possible" but the user's plan now clearly includes it (bought transport that only makes sense if visiting it), upgrade to "confirmed".
- date: update to YYYY-MM-DD based on the user's confirmed schedule. Apply logical deduction — if user arrives in area X on date A and leaves on date B, items in area X happen between A and B.
- cost_estimate: set to "" (empty string to clear it) when old estimates are superseded by purchased tickets with no price mentioned. Only set a new value if the user states an actual price.
- duration_estimate: update if the confirmed schedule implies a different duration. Null if no change.
- title: only change if genuinely needed. Null if no change.
- category, area: update only if new info provides better context. Null if no change.

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
