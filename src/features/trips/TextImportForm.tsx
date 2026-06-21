import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaces } from '../../hooks/usePlaces'
import { useParseTripItemsImport, type ParsedTripItem } from '../../hooks/useImportTripItems'
import { useCreateTrip } from '../../hooks/useTrips'
import { useCreateTripItem } from '../../hooks/useTripItems'
import { CONFIDENCE_BADGE, CONFIDENCE_ICON, CONFIDENCE_LABELS } from './itemStyles'
import { ClockIcon, MapPinIcon } from '../../components/icons'

interface TextImportFormProps {
  tripId?: string
  tripDateStart?: string | null
  onClose: () => void
}

type EditableItem = ParsedTripItem & { include: boolean }

export default function TextImportForm({ tripId, tripDateStart, onClose }: TextImportFormProps) {
  const { data: places } = usePlaces()
  const parseImport = useParseTripItemsImport()
  const createTrip = useCreateTrip()
  const createTripItem = useCreateTripItem()
  const navigate = useNavigate()

  const [text, setText] = useState('')
  const [result, setResult] = useState<{ suggestedTripTitle: string | null; items: EditableItem[] } | null>(null)
  const [tripTitle, setTripTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleParse = async () => {
    if (!text.trim()) return
    setError(null)
    try {
      const res = await parseImport.mutateAsync({
        text: text.trim(),
        existingPlaces: (places ?? []).map((p) => ({ id: p.id, name: p.name })),
        tripDateStart,
      })
      setResult({
        suggestedTripTitle: res.suggested_trip_title,
        items: res.items.map((item) => ({ ...item, include: true })),
      })
      setTripTitle(res.suggested_trip_title ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разобрать текст')
    }
  }

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    if (!result) return
    setResult({ ...result, items: result.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) })
  }

  const handleConfirm = async () => {
    if (!result) return
    const itemsToCreate = result.items.filter((it) => it.include)
    if (itemsToCreate.length === 0) return

    setIsSaving(true)
    setError(null)
    try {
      let targetTripId = tripId
      if (!targetTripId) {
        const trip = await createTrip.mutateAsync({ title: tripTitle.trim() || 'Новая поездка' })
        targetTripId = trip.id
      }

      for (const item of itemsToCreate) {
        await createTripItem.mutateAsync({
          trip_id: targetTripId,
          title: item.title,
          notes: item.notes,
          date: item.date,
          place_id: item.matched_place_id,
          confidence: item.confidence,
          category: item.category,
          area: item.area,
          cost_estimate: item.cost_estimate,
          duration_estimate: item.duration_estimate,
        })
      }

      onClose()
      if (!tripId) navigate(`/trips/${targetTripId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setIsSaving(false)
    }
  }

  const placeName = (id: string | null) => (id ? places?.find((p) => p.id === id)?.name : null)

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4">
      {!result ? (
        <>
          <h3 className="text-sm font-semibold text-slate-700">Импорт из текста</h3>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставь текст про поездку — список пунктов, заметки, что угодно"
            rows={6}
            className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleParse}
              disabled={!text.trim() || parseImport.isPending}
              className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {parseImport.isPending ? 'Разбираю…' : 'Разобрать'}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-700">Проверь перед сохранением</h3>

          {!tripId && (
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Название поездки
              <input
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </label>
          )}

          <ul className="flex flex-col gap-2">
            {result.items.map((item, index) => (
              <li
                key={index}
                className={`rounded border p-2.5 ${item.include ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => updateItem(index, { include: e.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        value={item.title}
                        onChange={(e) => updateItem(index, { title: e.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"
                      />
                      {item.confidence &&
                        (() => {
                          const ConfidenceIcon = CONFIDENCE_ICON[item.confidence]
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_BADGE[item.confidence]}`}
                            >
                              <ConfidenceIcon className="h-3 w-3" />
                              {CONFIDENCE_LABELS[item.confidence]}
                            </span>
                          )
                        })()}
                      {item.category && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {item.category}
                        </span>
                      )}
                      {item.area && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                          {item.area}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={item.date ?? ''}
                        onChange={(e) => updateItem(index, { date: e.target.value || null })}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                      />
                      {item.matched_place_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <MapPinIcon className="h-3 w-3" />
                          {placeName(item.matched_place_id)}
                        </span>
                      )}
                      {item.cost_estimate && (
                        <span className="text-xs font-medium text-slate-600">€ {item.cost_estimate}</span>
                      )}
                      {item.duration_estimate && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                          <ClockIcon className="h-3.5 w-3.5" />
                          {item.duration_estimate}
                        </span>
                      )}
                    </div>
                    {item.notes && <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.notes}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving || result.items.every((it) => !it.include)}
              className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? 'Сохраняю…' : `Добавить (${result.items.filter((it) => it.include).length})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
