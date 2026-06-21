import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TripStatus } from '../../lib/database.types'
import { useCreateTrip } from '../../hooks/useTrips'

const STATUSES: TripStatus[] = ['planned', 'active', 'done']
const STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Планируется',
  active: 'В процессе',
  done: 'Завершена',
}

export default function TripForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [status, setStatus] = useState<TripStatus>('planned')
  const createTrip = useCreateTrip()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const trip = await createTrip.mutateAsync({
      title: title.trim(),
      date_start: dateStart || null,
      date_end: dateEnd || null,
      status,
    })
    onClose()
    navigate(`/trips/${trip.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3 rounded border border-slate-200 bg-white p-4">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название поездки"
        className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={!title.trim() || createTrip.isPending}
          className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createTrip.isPending ? 'Сохранение…' : 'Создать'}
        </button>
      </div>
    </form>
  )
}
