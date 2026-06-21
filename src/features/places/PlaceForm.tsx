import { useState, type FormEvent } from 'react'
import type { PlaceStatus } from '../../lib/database.types'
import { useCreatePlace } from '../../hooks/usePlaces'
import { STATUS_LABELS } from './statusStyles'

interface PlaceFormProps {
  lat: number
  lng: number
  onSaved: (id: string) => void
  onCancel: () => void
}

const STATUSES: PlaceStatus[] = ['want', 'unsure', 'disliked']

export default function PlaceForm({ lat, lng, onSaved, onCancel }: PlaceFormProps) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<PlaceStatus>('want')
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
      status,
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

      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`flex-1 rounded border px-2 py-1.5 text-xs font-medium ${
              status === s ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
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
