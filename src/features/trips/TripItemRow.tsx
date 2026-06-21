import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUpdateTripItem, useDeleteTripItem } from '../../hooks/useTripItems'
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
      className={`flex items-center gap-2 rounded border border-slate-200 bg-white p-2.5 ${item.is_done ? 'opacity-60' : ''}`}
    >
      {draggable && (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          className="cursor-grab px-1 text-slate-300 hover:text-slate-500"
          aria-label="Перетащить"
        >
          ⠿
        </button>
      )}
      <input
        type="checkbox"
        checked={item.is_done}
        onChange={(e) => updateItem.mutate({ id: item.id, is_done: e.target.checked })}
        className="h-4 w-4 shrink-0"
      />
      <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm ${item.is_done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {item.title}
        </p>
        {item.date && (
          <p className="text-xs text-slate-400">
            {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </p>
        )}
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
    </li>
  )
}
