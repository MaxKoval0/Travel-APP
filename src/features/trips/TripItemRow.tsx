import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUpdateTripItem, useDeleteTripItem } from '../../hooks/useTripItems'
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

  return (
    <li
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      className={`rounded border border-slate-200 bg-white p-2.5 ${item.is_done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="mt-0.5 cursor-grab px-1 text-slate-300 hover:text-slate-500"
            aria-label="Перетащить"
          >
            ⠿
          </button>
        )}
        <input
          type="checkbox"
          checked={item.is_done}
          onChange={(e) => updateItem.mutate({ id: item.id, is_done: e.target.checked })}
          className="mt-1 h-4 w-4 shrink-0"
        />

        <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className={`text-sm font-medium ${item.is_done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {item.title}
            </p>
            {item.confidence && (
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_BADGE[item.confidence]}`}>
                {CONFIDENCE_ICON[item.confidence]} {CONFIDENCE_LABELS[item.confidence]}
              </span>
            )}
            {item.category && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{item.category}</span>
            )}
          </div>

          {item.notes && <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>}

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {item.date && (
              <span>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
            )}
            {item.cost_estimate && <span>€ {item.cost_estimate}</span>}
            {item.duration_estimate && <span>🕐 {item.duration_estimate}</span>}
          </div>
        </button>

        {item.places && (
          <button
            type="button"
            onClick={() => onOpenPlace(item.places!.id)}
            className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
          >
            Место
          </button>
        )}
        <button
          type="button"
          onClick={() => deleteItem.mutate({ id: item.id, trip_id: item.trip_id })}
          className="shrink-0 text-slate-300 hover:text-red-500"
          aria-label="Удалить пункт"
        >
          ✕
        </button>
      </div>
    </li>
  )
}
