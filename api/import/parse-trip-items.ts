import type { VercelRequest, VercelResponse } from '@vercel/node'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'

interface ExistingPlace {
  id: string
  name: string
}

interface ParsedItem {
  title: string
  notes: string | null
  date: string | null
  matched_place_id: string | null
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggested_trip_title: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          notes: { type: ['string', 'null'] },
          date: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null if no date was mentioned' },
          matched_place_id: {
            type: ['string', 'null'],
            description: 'One of the provided existing place ids, only if confidently the same place. Never invent an id.',
          },
        },
        required: ['title', 'notes', 'date', 'matched_place_id'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggested_trip_title', 'items'],
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

  const { text, existingPlaces, tripDateStart } = (req.body ?? {}) as {
    text?: string
    existingPlaces?: ExistingPlace[]
    tripDateStart?: string | null
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' })
    return
  }

  const placesList = (existingPlaces ?? []).map((p) => `${p.id}: ${p.name}`).join('\n') || '(none)'

  const systemPrompt = `You extract a list of trip items from free-form, possibly messy/conversational text (it may be a chat transcript or rough notes, not a clean list).

For each item, return:
- title: a short, clear name for the activity or place
- notes: any extra detail mentioned, or null
- date: MUST be either a valid YYYY-MM-DD string or null — nothing else is acceptable in this field.
  The trip starts on ${tripDateStart ?? 'an unknown date'}. Resolve relative dates ("second day", "on the way back") to YYYY-MM-DD ONLY if the start date is known and the resolution is unambiguous.
  If a date is mentioned but cannot be resolved to a valid YYYY-MM-DD (e.g. the start date is unknown), set date to null and put the original phrase ("second day", etc.) into notes instead — never put non-date text in the date field.
- matched_place_id: ONLY set this to one of the existing place ids below if the item clearly refers to that exact place. Never invent an id. Use null if unsure or not in the list.

Existing places (id: name):
${placesList}

Also suggest a short trip title (suggested_trip_title) if the text implies one (e.g. a destination), otherwise null.`

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
          json_schema: { name: 'trip_items', strict: true, schema: RESPONSE_SCHEMA },
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

  let parsed: { suggested_trip_title: string | null; items: ParsedItem[] }
  try {
    parsed = JSON.parse(content)
  } catch {
    res.status(502).json({ error: 'OpenAI returned invalid JSON' })
    return
  }

  res.status(200).json(parsed)
}
