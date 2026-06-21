import type { PlaceStatus } from '../../lib/database.types'

export const STATUS_COLORS: Record<PlaceStatus, string> = {
  want: '#16a34a',
  unsure: '#eab308',
  disliked: '#dc2626',
}

export const STATUS_LABELS: Record<PlaceStatus, string> = {
  want: 'Хочу',
  unsure: 'Не уверен',
  disliked: 'Не понравилось',
}
