import type { FpvStatus, TouristStatus } from '../../lib/database.types'

export const DEFAULT_PIN_COLOR = '#64748b'

export const TOURIST_STATUS_COLORS: Record<TouristStatus, string> = {
  top: '#16a34a',
  normal: DEFAULT_PIN_COLOR,
}

export const TOURIST_STATUS_LABELS: Record<TouristStatus, string> = {
  top: 'Топ',
  normal: 'Обычное',
}

export const FPV_STATUS_COLORS: Record<FpvStatus, string> = {
  allowed: '#16a34a',
  unclear: '#eab308',
  banned: '#dc2626',
}

export const FPV_STATUS_LABELS: Record<FpvStatus, string> = {
  allowed: 'Разрешено',
  unclear: 'Не ясно',
  banned: 'Запрещено',
}
