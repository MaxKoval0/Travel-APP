import { Link } from 'react-router-dom'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import { usePlace, usePlaceTrips, useUpdatePlace, useDeletePlace } from '../../hooks/usePlaces'
import { FPV_STATUS_COLORS, FPV_STATUS_LABELS, TOURIST_STATUS_COLORS, TOURIST_STATUS_LABELS } from './statusStyles'
import PhotoGallery from './PhotoGallery'

interface PlaceCardProps {
  placeId: string
  onClose: () => void
}

const TOURIST_STATUSES: TouristStatus[] = ['top', 'normal']
const FPV_STATUSES: FpvStatus[] = ['allowed', 'unclear', 'banned']

interface LinkedTripItem {
  trip_id: string
  trips: { id: string; title: string; status: string } | null
}

function dedupeTrips(items: LinkedTripItem[] | undefined) {
  if (!items) return []
  const seen = new Map<string, { id: string; title: string }>()
  for (const item of items) {
    if (item.trips && !seen.has(item.trip_id)) seen.set(item.trip_id, item.trips)
  }
  return Array.from(seen.values())
}

export default function PlaceCard({ placeId, onClose }: PlaceCardProps) {
  const { data: place } = usePlace(placeId)
  const { data: linkedItems } = usePlaceTrips(placeId)
  const updatePlace = useUpdatePlace()
  const deletePlace = useDeletePlace()

  if (!place) {
    return <div className="p-4 text-sm text-slate-400">Загрузка…</div>
  }

  const trips = dedupeTrips(linkedItems as LinkedTripItem[] | undefined)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <input
          key={place.id}
          defaultValue={place.name}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value && value !== place.name) updatePlace.mutate({ id: place.id, name: value })
          }}
          className="flex-1 bg-transparent text-base font-semibold text-slate-800 outline-none"
        />
        <button type="button" onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600" aria-label="Закрыть">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1 px-3 pb-2">
        <span className="text-xs font-medium text-slate-400">Туристический статус</span>
        <div className="flex gap-2">
          {TOURIST_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updatePlace.mutate({ id: place.id, tourist_status: place.tourist_status === s ? null : s })}
              className="flex-1 rounded border px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors"
              style={
                place.tourist_status === s
                  ? { backgroundColor: TOURIST_STATUS_COLORS[s], borderColor: TOURIST_STATUS_COLORS[s], color: '#fff' }
                  : { borderColor: '#cbd5e1' }
              }
            >
              {TOURIST_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 px-3 pb-3">
        <span className="text-xs font-medium text-slate-400">Статус для FPV-полёта</span>
        <div className="flex gap-2">
          {FPV_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updatePlace.mutate({ id: place.id, fpv_status: place.fpv_status === s ? null : s })}
              className="flex-1 rounded border px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors"
              style={
                place.fpv_status === s
                  ? { backgroundColor: FPV_STATUS_COLORS[s], borderColor: FPV_STATUS_COLORS[s], color: '#fff' }
                  : { borderColor: '#cbd5e1' }
              }
            >
              {FPV_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 px-3 pb-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={place.visited}
          onChange={(e) => updatePlace.mutate({ id: place.id, visited: e.target.checked })}
          className="h-4 w-4"
        />
        Посетил
      </label>

      <div className="flex flex-col gap-1 px-3 pb-3">
        <label className="text-xs font-medium text-slate-400">Описание</label>
        <textarea
          key={`${place.id}-description`}
          defaultValue={place.description ?? ''}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (place.description ?? '')) updatePlace.mutate({ id: place.id, description: value || null })
          }}
          rows={2}
          className="rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-col gap-1 px-3 pb-3">
        <label className="text-xs font-medium text-slate-400">Заметки</label>
        <textarea
          key={`${place.id}-notes`}
          defaultValue={place.notes ?? ''}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value !== (place.notes ?? '')) updatePlace.mutate({ id: place.id, notes: value || null })
          }}
          rows={2}
          className="rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex flex-col gap-1 px-3 pb-3">
        <label className="text-xs font-medium text-slate-400">Фото</label>
        <PhotoGallery placeId={place.id} />
      </div>

      {trips.length > 0 && (
        <div className="flex flex-col gap-1 px-3 pb-3">
          <label className="text-xs font-medium text-slate-400">Поездки</label>
          <ul className="flex flex-col gap-1">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link to={`/trips/${trip.id}`} className="text-sm text-emerald-700 hover:underline">
                  {trip.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Удалить место «${place.name}»?`)) {
              deletePlace.mutate(place.id)
              onClose()
            }
          }}
          className="text-xs text-red-500 hover:underline"
        >
          Удалить место
        </button>
      </div>
    </div>
  )
}
