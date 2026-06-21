import { useMutation } from '@tanstack/react-query'
import type { TripItemConfidence } from '../lib/database.types'

export interface ParsedTripItem {
  title: string
  notes: string | null
  date: string | null
  matched_place_id: string | null
  confidence: TripItemConfidence | null
  category: string | null
  area: string | null
  cost_estimate: string | null
  duration_estimate: string | null
}

export interface ParseTripItemsResult {
  suggested_trip_title: string | null
  items: ParsedTripItem[]
}

export function useParseTripItemsImport() {
  return useMutation({
    mutationFn: async ({
      text,
      existingPlaces,
      tripDateStart,
    }: {
      text: string
      existingPlaces: { id: string; name: string }[]
      tripDateStart?: string | null
    }): Promise<ParseTripItemsResult> => {
      const res = await fetch('/api/import/parse-trip-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, existingPlaces, tripDateStart }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Ошибка разбора (${res.status})`)
      }
      return res.json()
    },
  })
}
