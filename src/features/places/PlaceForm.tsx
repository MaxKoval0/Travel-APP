import { useState, type FormEvent } from 'react'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import { useCreatePlace } from '../../hooks/usePlaces'
import { FPV_STATUS_LABELS, TOURIST_STATUS_LABELS } from './statusStyles'

interface PlaceFormProps {
  lat: number
  lng: number
  initialName?: string
  onSaved: (id: string) => void
  onCancel: () => void
}

const TOURIST_STATUSES: TouristStatus[] = ['top', 'normal']
const FPV_STATUSES: FpvStatus[] = ['allowed', 'unclear', 'banned']

export default function PlaceForm({ lat, lng, initialName, onSaved, onCancel }: PlaceFormProps) {
  const [name, setName] = useState(initialName ?? '')
  const [touristStatus, setTouristStatus] = useState<TouristStatus | null>(null)
  const [fpvStatus, setFpvStatus] = useState<FpvStatus | null>(null)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const createPlace = useCreatePlace()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const place = await createPlace.mutateAsync({
      name: name.trim(),
      lat,
      lng,
      tourist_status: touristStatus,
      fpv_status: fpvStatus,
      description: description.trim() || null,
      notes: notes.trim() || null,
    })
    onSaved(place.id)
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <h2 className="text-base font-semibold text-slate-800">Новое место</h2>
      <p className="text-xs text-slate-400">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Название
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Название места"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">Туристический статус (необязательно)</span>
        <div className="flex gap-2">
          {TOURIST_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTouristStatus(touristStatus === s ? null : s)}
              className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
                touristStatus === s ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {TOURIST_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">Статус для FPV-полёта (необязательно)</span>
        <div className="flex gap-2">
          {FPV_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFpvStatus(fpvStatus === s ? null : s)}
              className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
                fpvStatus === s ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {FPV_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Описание
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          rows={2}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        Заметки
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          rows={2}
        />
      </label>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={!name.trim() || createPlace.isPending}
          className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createPlace.isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
