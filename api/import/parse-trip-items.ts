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
  confidence: 'confirmed' | 'possible' | 'questionable' | null
  category: string | null
  area: string | null
  cost_estimate: string | null
  duration_estimate: string | null
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
          confidence: {
            type: ['string', 'null'],
            enum: ['confirmed', 'possible', 'questionable', null],
            description:
              'How settled this plan is, only if the text gives a real signal (e.g. "definitely", "maybe", "not sure yet"). Null if no such signal.',
          },
          category: {
            type: ['string', 'null'],
            description: 'Short theme tag describing what kind of activity this is, e.g. "История", "Природа", "Гастрономия". Null if unclear.',
          },
          area: {
            type: ['string', 'null'],
            description:
              'A broad grouping label shared by SEVERAL items in this same list, used to group items into sections. Set this ONLY when the text itself signals an intentional grouping — e.g. a heading, a prefix like "Пригород:" before several items, or items explicitly described as part of the same leg/day/region of the trip. Do NOT derive area from an incidental mention of a place or region inside a description (e.g. "the largest in Europe" does NOT mean area="Европа") — that is a hallucination, not a grouping. If in doubt, leave null. Null is the expected, normal value for most items; only a minority of trips will have explicit groupings at all.',
          },
          cost_estimate: {
            type: ['string', 'null'],
            description: 'Free-text price estimate as mentioned, e.g. "8-12€ лодка + ~20€ ужин". Null if not mentioned.',
          },
          duration_estimate: {
            type: ['string', 'null'],
            description: 'Free-text duration estimate as mentioned, e.g. "2-3 часа", "Полный день". Null if not mentioned.',
          },
        },
        required: [
          'title',
          'notes',
          'date',
          'matched_place_id',
          'confidence',
          'category',
          'area',
          'cost_estimate',
          'duration_estimate',
        ],
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
- category, cost_estimate, duration_estimate, confidence, area: extract these FIRST (see rules below), THEN
- notes: ONLY genuinely extra detail that is NOT already captured by category/cost_estimate/duration_estimate/confidence/area —
  e.g. why it's worth doing, a tip, a caveat. Do NOT restate the category, price, or duration as a sentence in notes —
  that information already has its own field and showing it twice is a bug, not a feature. If there is nothing left to
  say once category/price/duration/confidence are extracted, set notes to null — an empty notes field is the normal,
  expected result for most items, not something to avoid.
- date: MUST be either a valid YYYY-MM-DD string or null — nothing else is acceptable in this field.
  The trip starts on ${tripDateStart ?? 'an unknown date'}. Resolve relative dates ("second day", "on the way back") to YYYY-MM-DD ONLY if the start date is known and the resolution is unambiguous.
  If a date is mentioned but cannot be resolved to a valid YYYY-MM-DD (e.g. the start date is unknown), set date to null and put the original phrase ("second day", etc.) into notes instead — never put non-date text in the date field.
- matched_place_id: ONLY set this to one of the existing place ids below if the item clearly refers to that exact place. Never invent an id. Use null if unsure or not in the list.
- confidence: "confirmed" / "possible" / "questionable" — only if the text gives a real signal about how settled this is. Null otherwise, do not guess.
- category, cost_estimate, duration_estimate: short free text, only if mentioned or clearly implied. Null otherwise — do not invent prices or durations that aren't in the text.
- area: only when the text intentionally groups several items together (a heading, a "Пригород:"-style prefix, explicit "same day/region" framing). An incidental geographic word inside a description (e.g. "the largest in Europe") is NOT a grouping signal. Null is the normal, expected value for most items.

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
