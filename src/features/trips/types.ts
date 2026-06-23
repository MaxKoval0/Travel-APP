import type { FpvStatus, TouristStatus, TripItem } from '../../lib/database.types'

export type TripItemWithPlace = TripItem & {
  places: {
    id: string
    name: string
    lat: number
    lng: number
    tourist_status: TouristStatus | null
    fpv_status: FpvStatus | null
    visited: boolean
  } | null
}
