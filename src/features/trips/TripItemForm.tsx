import { useMemo, useState, type FormEvent } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { usePlaces } from '../../hooks/usePlaces'
import { useCreateTripItem, useUpdateTripItem } from '../../hooks/useTripItems'
import type { TripItemWithPlace } from './types'

type LocationMode = 'place' | 'pin' | 'none'

interface TripItemFormProps {
  tripId: string
  editing?: TripItemWithPlace | null
  onClose: () => void
}

const MODE_LABELS: Record<LocationMode, string> = {
  place: 'Место из базы',
  pin: 'Точка на карте',
  none: 'Без локации',
}

export default function TripItemForm({ tripId, editing, onClose }: TripItemFormProps) {
  const { data: places } = usePlaces()
  const createItem = useCreateTripItem()
  const updateItem = useUpdateTripItem()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [date, setDate] = useState(editing?.date ?? '')
  const [mode, setMode] = useState<LocationMode>(
    editing?.place_id ? 'place' : editing?.lat != null ? 'pin' : 'none',
  )
  const [placeId, setPlaceId] = useState(editing?.place_id ?? '')
  const [placeQuery, setPlaceQuery] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    editing?.lat != null && editing?.lng != null ? { lat: editing.lat, lng: editing.lng } : null,
  )

  const filteredPlaces = useMemo(() => {
    if (!places || !placeQuery.trim()) return []
    const q = placeQuery.trim().toLowerCase()
    return places.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [places, placeQuery])

  const selectedPlace = places?.find((p) => p.id === placeId)
  const isPending = createItem.isPending || updateItem.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      date: date || null,
      place_id: mode === 'place' ? placeId || null : null,
      lat: mode === 'pin' ? pin?.lat ?? null : null,
      lng: mode === 'pin' ? pin?.lng ?? null : null,
    }

    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createItem.mutateAsync({ trip_id: tripId, ...payload })
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название пункта"
        className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      />

      <textarea
        value={notes ?? ''}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Заметки"
        rows={2}
        className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />

      <div className="flex gap-2">
        {(['place', 'pin', 'none'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
              mode === m ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === 'place' &&
        (selectedPlace ? (
          <div className="flex items-center justify-between rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
            {selectedPlace.name}
            <button type="button" onClick={() => setPlaceId('')} className="text-slate-400">
              ✕
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <input
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              placeholder="Поиск места по названию"
              className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            {filteredPlaces.length > 0 && (
              <ul className="flex flex-col gap-1 rounded border border-slate-200">
                {filteredPlaces.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaceId(p.id)
                        setPlaceQuery('')
                        if (!title.trim()) setTitle(p.name)
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

      {mode === 'pin' && <PinPicker pin={pin} onChange={setPin} />}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}

function PinPicker({
  pin,
  onChange,
}: {
  pin: { lat: number; lng: number } | null
  onChange: (p: { lat: number; lng: number }) => void
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey || '', id: 'travel-tracker-google-maps' })

  if (!apiKey || !isLoaded) {
    return (
      <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-400">
        Карта недоступна
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerClassName="h-40 w-full"
      center={pin ?? { lat: 20, lng: 10 }}
      zoom={pin ? 10 : 2}
      onClick={(e) => {
        if (e.latLng) onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      }}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {pin && <MarkerF position={pin} />}
    </GoogleMap>
  )
}
