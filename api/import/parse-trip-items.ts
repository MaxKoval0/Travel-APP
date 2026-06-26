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

Write every text field (title, category, notes, cost_estimate, duration_estimate, suggested_trip_title) in Russian,
regardless of what language the input text is in. The only exception is proper nouns — place names, brand names,
people's names — which should stay as given in the source text (or in their conventional Russian transliteration if
the source already used one) rather than being translated.

For each item, return:
- title: a short, clear name for the activity or place
- category, cost_estimate, duration_estimate, confidence, area: extract these FIRST (see rules below), THEN
- notes: capture EVERYTHING from the source that isn't already captured by category/cost_estimate/duration_estimate/confidence/area.
  This explicitly includes transportation/logistics (how to get there — trains, buses, line numbers, transfer points, taxi legs,
  walking distances, schedule caveats like "no Sunday service"), accommodation/overnight specifics (where to base yourself,
  price ranges), and named routes or trails with their distances — preserve these IN FULL, in detail, exactly as given. Do not
  summarize, shorten, or drop concrete details (numbers, place names, line numbers, distances) just because the source paragraph
  was long — a long, detailed source item should produce a long, detailed notes field, not a trimmed-down one.
  A transportation/logistics passage that happens to mention a price or duration (e.g. "поезд ~1ч50м, от 11€") belongs in notes
  IN FULL even though that same number is also separately pulled into cost_estimate/duration_estimate below — that's two fields
  each doing their job, not duplication. What must NOT appear in notes is a separate, redundant summary sentence that adds no
  new information beyond restating category/price/duration (e.g. a standalone "Стоимость 11€, длительность полдня" with nothing
  else) — that bare restatement is the bug to avoid, not every number that happens to also appear elsewhere. Set notes to null
  only if there is genuinely nothing left to say once the other fields are extracted — for most real items with any logistics
  detail in the source, a substantial notes field is the normal, expected outcome, not something to avoid.
- date: MUST be either a valid YYYY-MM-DD string or null — nothing else is acceptable in this field.
  The trip starts on ${tripDateStart ?? 'an unknown date'}. Resolve relative dates ("second day", "on the way back") to YYYY-MM-DD ONLY if the start date is known and the resolution is unambiguous.
  If a date is mentioned but cannot be resolved to a valid YYYY-MM-DD (e.g. the start date is unknown), set date to null and put the original phrase ("second day", etc.) into notes instead — never put non-date text in the date field.
- matched_place_id: ONLY set this to one of the existing place ids below if the item refers to that exact same real-world place —
  not merely a similar category or theme (e.g. "desert hike" and "coastal cove" are never the same place no matter how outdoorsy
  both are). Matching by name is the strong signal; matching by vague similarity is a hallucination, not a match. A wrong match is
  worse than no match, since it would silently treat the imported item as if it were a place it isn't. Never invent an id — use
  null whenever you're not confident it's the same place, which is the normal, expected value for anything not already in the list.
- confidence: "confirmed" / "possible" / "questionable" — only if the text gives a real signal about how settled this is. Null otherwise, do not guess.
- category, cost_estimate, duration_estimate: short free text, only if mentioned or clearly implied anywhere in the source —
  including inside a transportation/logistics passage you're also keeping in notes (e.g. "поезд ~1ч50м, от 11€" gives both
  cost_estimate="от 11€" and duration_estimate hints). Null otherwise — do not invent prices or durations that aren't in the text.
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
