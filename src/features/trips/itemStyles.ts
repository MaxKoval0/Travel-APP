import type { ComponentType } from 'react'
import type { TripItemConfidence } from '../../lib/database.types'
import { CheckCircleIcon, DotCircleIcon, QuestionMarkCircleIcon } from '../../components/icons'

export const CONFIDENCE_LABELS: Record<TripItemConfidence, string> = {
  confirmed: 'Точно',
  possible: 'Возможно',
  questionable: 'Под вопросом',
}

export const CONFIDENCE_BADGE: Record<TripItemConfidence, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  possible: 'bg-violet-100 text-violet-700',
  questionable: 'bg-amber-100 text-amber-700',
}

export const CONFIDENCE_ICON: Record<TripItemConfidence, ComponentType<{ className?: string }>> = {
  confirmed: CheckCircleIcon,
  possible: DotCircleIcon,
  questionable: QuestionMarkCircleIcon,
}
