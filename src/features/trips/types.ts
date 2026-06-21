import type { TripItem } from '../../lib/database.types'

export type TripItemWithPlace = TripItem & {
  places: { id: string; name: string; lat: number; lng: number; status: string } | null
}
