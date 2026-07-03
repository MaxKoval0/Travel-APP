import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useUpdateTripItem, useDeleteTripItem } from '../../hooks/useTripItems'
import { usePlacePhotos } from '../../hooks/usePlacePhotos'
import { placePhotoUrl } from '../../lib/supabase'
import { ClockIcon, MapPinIcon } from '../../components/icons'
import PhotoLightbox from '../../components/PhotoLightbox'
import { CONFIDENCE_BADGE, CONFIDENCE_ICON, CONFIDENCE_LABELS } from './itemStyles'
import type { TripItemWithPlace } from './types'

interface TripItemRowProps {
  item: TripItemWithPlace
  expanded: boolean
  draggable?: boolean
  onToggle: () => void
  onShowOnMap?: (lat: number, lng: number) => void
  onEdit: (item: TripItemWithPlace) => void
}

export default function TripItemRow({ item, expanded, draggable, onToggle, onShowOnMap, onEdit }: TripItemRowProps) {
  const updateItem = useUpdateTripItem()
  const deleteItem = useDeleteTripItem()
  const sortable = useSortable({ id: item.id, disabled: !draggable })
  const { data: photos } = usePlacePhotos(expanded ? item.places?.id : null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const style = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined

  const ConfidenceIcon = item.confidence ? CONFIDENCE_ICON[item.confidence] : null
  const itemLat = item.places?.lat ?? item.lat
  const itemLng = item.places?.lng ?? item.lng
  const hasLocation = itemLat != null && itemLng != null

  return (
    <li
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      className={`rounded-lg border bg-white shadow-sm transition-all ${
        expanded ? 'border-emerald-300' : 'border-slate-200'
      } ${item.is_done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-1 p-3">
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
        <label className="flex shrink-0 cursor-pointer items-center p-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={(e) => updateItem.mutate({ id: item.id, is_done: e.target.checked })}
            className="h-4 w-4 cursor-pointer"
          />
        </label>

        <button type="button" onClick={onToggle} className="min-w-0 flex-1 cursor-pointer text-left">
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

          {!expanded && item.notes && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.notes}</p>
          )}

          {!expanded && (item.date || item.cost_estimate || item.duration_estimate) && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {item.date && (
                <span>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
              )}
              {item.cost_estimate && <span>{item.cost_estimate}</span>}
              {item.duration_estimate && (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />
                  {item.duration_estimate}
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-3 pt-2">
          {item.notes && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.notes}</p>
          )}

          {photos && photos.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {photos.map((photo, i) => (
                <img
                  key={photo.id}
                  src={placePhotoUrl(photo.storage_path)}
                  alt=""
                  className="h-20 w-20 shrink-0 cursor-pointer rounded border border-slate-200 object-cover"
                  onClick={() => setLightboxIndex(i)}
                />
              ))}
            </div>
          )}

          {(item.date || item.cost_estimate || item.duration_estimate) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
              {item.date && (
                <span>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
              )}
              {item.cost_estimate && <span>{item.cost_estimate}</span>}
              {item.duration_estimate && (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {item.duration_estimate}
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {hasLocation && onShowOnMap && (
              <button
                type="button"
                onClick={() => onShowOnMap(itemLat!, itemLng!)}
                className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <MapPinIcon className="h-3.5 w-3.5" />
                На карте
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Редактировать
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Удалить пункт «${item.title}»?`)) {
                  deleteItem.mutate({ id: item.id, trip_id: item.trip_id })
                }
              }}
              className="ml-auto rounded px-3 py-1.5 text-xs text-red-400 hover:text-red-600"
            >
              Удалить
            </button>
          </div>
        </div>
      )}

      {lightboxIndex !== null && photos && photos.length > 0 && (
        <PhotoLightbox
          photos={photos.map((p) => placePhotoUrl(p.storage_path))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </li>
  )
}
