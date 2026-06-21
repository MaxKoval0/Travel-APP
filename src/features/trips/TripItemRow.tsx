import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUpdateTripItem, useDeleteTripItem } from '../../hooks/useTripItems'
import { ClockIcon, MapPinIcon } from '../../components/icons'
import { CONFIDENCE_BADGE, CONFIDENCE_ICON, CONFIDENCE_LABELS } from './itemStyles'
import type { TripItemWithPlace } from './types'

interface TripItemRowProps {
  item: TripItemWithPlace
  draggable?: boolean
  onOpenPlace: (placeId: string) => void
  onEdit: (item: TripItemWithPlace) => void
}

export default function TripItemRow({ item, draggable, onOpenPlace, onEdit }: TripItemRowProps) {
  const updateItem = useUpdateTripItem()
  const deleteItem = useDeleteTripItem()
  const sortable = useSortable({ id: item.id, disabled: !draggable })

  const style = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined

  const ConfidenceIcon = item.confidence ? CONFIDENCE_ICON[item.confidence] : null

  return (
    <li
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-opacity ${
        item.is_done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        {draggable && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="cursor-grab self-stretch px-1.5 py-1 text-slate-300 hover:text-slate-500"
            aria-label="Перетащить"
          >
            ⠿
          </button>
        )}
        <label className="flex shrink-0 cursor-pointer items-center p-2">
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={(e) => updateItem.mutate({ id: item.id, is_done: e.target.checked })}
            className="h-4 w-4 cursor-pointer"
          />
        </label>

        <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 cursor-pointer text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`text-sm font-semibold ${item.is_done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
              {item.title}
            </p>
            {ConfidenceIcon && item.confidence && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_BADGE[item.confidence]}`}
              >
                <ConfidenceIcon className="h-3 w-3" />
                {CONFIDENCE_LABELS[item.confidence]}
              </span>
            )}
            {item.category && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {item.category}
              </span>
            )}
          </div>

          {item.notes && <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.notes}</p>}

          {(item.date || item.cost_estimate || item.duration_estimate) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
              {item.date && (
                <span>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
              )}
              {item.cost_estimate && <span>€ {item.cost_estimate}</span>}
              {item.duration_estimate && (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {item.duration_estimate}
                </span>
              )}
            </div>
          )}
        </button>

        {item.places && (
          <button
            type="button"
            onClick={() => onOpenPlace(item.places!.id)}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <MapPinIcon className="h-3.5 w-3.5" />
            Место
          </button>
        )}
        <button
          type="button"
          onClick={() => deleteItem.mutate({ id: item.id, trip_id: item.trip_id })}
          className="shrink-0 cursor-pointer p-2 text-slate-400 hover:text-red-500"
          aria-label="Удалить пункт"
        >
          ✕
        </button>
      </div>
    </li>
  )
}
