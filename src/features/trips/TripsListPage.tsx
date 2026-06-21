import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips'
import TripForm from './TripForm'
import TextImportForm from './TextImportForm'
import type { TripStatus } from '../../lib/database.types'

const STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Планируется',
  active: 'В процессе',
  done: 'Завершена',
}

const STATUS_BADGE: Record<TripStatus, string> = {
  planned: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  done: 'bg-slate-200 text-slate-400',
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return fmt(start ?? end!)
}

export default function TripsListPage() {
  const { data: trips } = useTrips()
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-slate-800">Поездки</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600"
            >
              Импорт из текста
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              + Новая поездка
            </button>
          </div>
        </div>

        {showImport && <div className="mb-4"><TextImportForm onClose={() => setShowImport(false)} /></div>}
        {showForm && <TripForm onClose={() => setShowForm(false)} />}

        <ul className="flex flex-col gap-2">
          {trips?.map((trip) => (
            <li key={trip.id}>
              <Link
                to={`/trips/${trip.id}`}
                className="flex items-center justify-between rounded border border-slate-200 bg-white p-3 hover:border-emerald-300"
              >
                <div>
                  <p className="font-medium text-slate-800">{trip.title}</p>
                  {formatDateRange(trip.date_start, trip.date_end) && (
                    <p className="text-xs text-slate-400">{formatDateRange(trip.date_start, trip.date_end)}</p>
                  )}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[trip.status]}`}>
                  {STATUS_LABELS[trip.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {trips?.length === 0 && <p className="text-sm text-slate-400">Пока нет поездок</p>}
      </div>
    </div>
  )
}
