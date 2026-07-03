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

export interface TripItemUpdate {
  item_id: string
  title: string | null
  notes: string | null
  date: string | null
  confidence: TripItemConfidence | null
  category: string | null
  area: string | null
  cost_estimate: string | null
  duration_estimate: string | null
}

export interface UpdateTripItemsResult {
  updates: TripItemUpdate[]
}

export function useParseTripItemsUpdate() {
  return useMutation({
    mutationFn: async ({
      text,
      images,
      existingItems,
    }: {
      text: string
      images?: string[]
      existingItems: {
        id: string
        title: string
        notes: string | null
        date: string | null
        confidence: TripItemConfidence | null
        category: string | null
        area: string | null
        cost_estimate: string | null
        duration_estimate: string | null
      }[]
    }): Promise<UpdateTripItemsResult> => {
      const res = await fetch('/api/import/update-trip-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, images, existingItems }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Ошибка разбора (${res.status})`)
      }
      return res.json()
    },
  })
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
