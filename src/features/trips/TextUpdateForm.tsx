import { useState } from 'react'
import { useParseTripItemsUpdate, type TripItemUpdate } from '../../hooks/useImportTripItems'
import { useUpdateTripItem } from '../../hooks/useTripItems'
import type { TripItemWithPlace } from './types'

interface TextUpdateFormProps {
  items: TripItemWithPlace[]
  onClose: () => void
}

type FieldKey = 'title' | 'notes' | 'date' | 'confidence' | 'category' | 'area' | 'cost_estimate' | 'duration_estimate'

const FIELD_LABELS: Record<FieldKey, string> = {
  title: 'Название',
  date: 'Дата',
  notes: 'Заметки',
  confidence: 'Уверенность',
  category: 'Категория',
  area: 'Район',
  cost_estimate: 'Цена',
  duration_estimate: 'Длительность',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'Точно',
  possible: 'Возможно',
  questionable: 'Под вопросом',
}

interface ReviewUpdate {
  update: TripItemUpdate
  item: TripItemWithPlace
  include: boolean
}

export default function TextUpdateForm({ items, onClose }: TextUpdateFormProps) {
  const parseUpdate = useParseTripItemsUpdate()
  const updateItem = useUpdateTripItem()

  const [text, setText] = useState('')
  const [result, setResult] = useState<ReviewUpdate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleParse = async () => {
    if (!text.trim()) return
    setError(null)
    try {
      const res = await parseUpdate.mutateAsync({
        text: text.trim(),
        existingItems: items.map((i) => ({
          id: i.id,
          title: i.title,
          notes: i.notes,
          date: i.date,
          confidence: i.confidence,
          category: i.category,
          area: i.area,
          cost_estimate: i.cost_estimate,
          duration_estimate: i.duration_estimate,
        })),
      })

      const itemMap = new Map(items.map((i) => [i.id, i]))
      const reviews: ReviewUpdate[] = []
      for (const update of res.updates) {
        const item = itemMap.get(update.item_id)
        if (!item) continue
        const hasChanges = CHANGED_FIELDS.some((f) => update[f] !== null)
        if (hasChanges) reviews.push({ update, item, include: true })
      }

      if (reviews.length === 0) {
        setError('AI не нашёл пунктов, которые нужно обновить по этому тексту.')
        return
      }

      setResult(reviews)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось разобрать текст')
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    const toApply = result.filter((r) => r.include)
    if (toApply.length === 0) return

    setIsSaving(true)
    setError(null)
    try {
      for (const { update } of toApply) {
        const patch: Record<string, unknown> = { id: update.item_id }
        for (const field of CHANGED_FIELDS) {
          if (update[field] !== null) patch[field] = update[field] || null
        }
        await updateItem.mutateAsync(patch as { id: string } & Record<string, unknown>)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4">
      {!result ? (
        <>
          <h3 className="text-sm font-semibold text-slate-700">Обновить через AI</h3>
          <p className="text-xs text-slate-500">
            Вставь новую информацию — бронь, билеты, уточнённые даты, цены — и AI обновит нужные пункты.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Купил билет Валенсия→Агилас на 7 июля, 14:30, 23€. Бронь отеля в Агиласе на 7-8 июля..."
            rows={5}
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
              disabled={!text.trim() || parseUpdate.isPending}
              className="flex-1 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {parseUpdate.isPending ? 'Анализирую…' : 'Разобрать'}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-700">
            Изменения ({result.filter((r) => r.include).length})
          </h3>

          <ul className="flex flex-col gap-3">
            {result.map((review, index) => (
              <li
                key={review.update.item_id}
                className={`rounded border p-3 ${review.include ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 opacity-50'}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={review.include}
                    onChange={(e) => {
                      const next = [...result]
                      next[index] = { ...next[index], include: e.target.checked }
                      setResult(next)
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{review.item.title}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {CHANGED_FIELDS.filter((f) => review.update[f] !== null).map((field) => (
                        <FieldDiff
                          key={field}
                          field={field}
                          oldValue={review.item[field]}
                          newValue={review.update[field]}
                        />
                      ))}
                    </div>
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
              disabled={isSaving || result.every((r) => !r.include)}
              className="flex-1 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? 'Сохраняю…' : `Применить (${result.filter((r) => r.include).length})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const CHANGED_FIELDS: FieldKey[] = ['title', 'date', 'confidence', 'category', 'area', 'cost_estimate', 'duration_estimate', 'notes']

function FieldDiff({ field, oldValue, newValue }: { field: FieldKey; oldValue: unknown; newValue: unknown }) {
  const label = FIELD_LABELS[field]
  const formatValue = (v: unknown) => {
    if (v == null || v === '') return '—'
    if (field === 'confidence') return CONFIDENCE_LABELS[v as string] ?? v
    return String(v)
  }

  const oldStr = formatValue(oldValue)
  const newStr = formatValue(newValue)

  if (field === 'notes') {
    return (
      <div className="text-xs">
        <span className="font-medium text-slate-500">{label}:</span>
        <div className="mt-1 rounded bg-red-50 p-2 text-red-700 line-through">{oldStr}</div>
        <div className="mt-1 rounded bg-green-50 p-2 text-green-800">{newStr}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-baseline gap-1 text-xs">
      <span className="font-medium text-slate-500">{label}:</span>
      <span className="text-red-500 line-through">{oldStr}</span>
      <span className="text-slate-400">→</span>
      <span className="font-medium text-green-700">{newStr}</span>
    </div>
  )
}
