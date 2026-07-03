import { useRef, useState } from 'react'
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

const CHANGED_FIELDS: FieldKey[] = ['title', 'date', 'confidence', 'category', 'area', 'cost_estimate', 'duration_estimate', 'notes']

interface ReviewUpdate {
  update: TripItemUpdate
  item: TripItemWithPlace
  include: boolean
}

export default function TextUpdateForm({ items, onClose }: TextUpdateFormProps) {
  const parseUpdate = useParseTripItemsUpdate()
  const updateItem = useUpdateTripItem()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [images, setImages] = useState<{ dataUrl: string; name: string }[]>([])
  const [result, setResult] = useState<ReviewUpdate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const handleAddImages = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [...prev, { dataUrl: reader.result as string, name: file.name }])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Голосовой ввод не поддерживается в этом браузере')
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ru-RU'
    recognition.interimResults = false
    recognition.continuous = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript
        }
      }
      if (transcript) {
        setText((prev) => (prev ? prev + ' ' + transcript : transcript))
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const handleParse = async () => {
    if (!text.trim() && images.length === 0) return
    setError(null)
    try {
      const res = await parseUpdate.mutateAsync({
        text: text.trim(),
        images: images.length > 0 ? images.map((img) => img.dataUrl) : undefined,
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
        const reallyChanged = CHANGED_FIELDS.some((f) => {
          if (update[f] === null) return false
          const oldVal = item[f] ?? ''
          const newVal = update[f] ?? ''
          return String(oldVal) !== String(newVal)
        })
        if (reallyChanged) reviews.push({ update, item, include: true })
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
          if (update[field] === null) continue
          const oldVal = String(items.find((i) => i.id === update.item_id)?.[field] ?? '')
          const newVal = String(update[field] ?? '')
          if (oldVal !== newVal) {
            patch[field] = update[field] || null
          }
        }
        if (Object.keys(patch).length > 1) {
          await updateItem.mutateAsync(patch as { id: string } & Record<string, unknown>)
        }
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
            Вставь текст или фото билетов/брони — AI обновит нужные пункты.
          </p>
          <div className="relative">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Купил билет на автобус Валенсия→Бенидорм на 4 число, 15:01, 21€..."
              rows={5}
              className="w-full rounded border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={toggleVoice}
              className={`absolute right-2 top-2 rounded-full p-1.5 ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
            >
              <MicIcon className="h-4 w-4" />
            </button>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded border border-slate-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleAddImages(e.target.files)}
            className="hidden"
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
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600"
              title="Добавить фото"
            >
              <CameraIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleParse}
              disabled={(!text.trim() && images.length === 0) || parseUpdate.isPending}
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
                      {CHANGED_FIELDS.filter((f) => {
                        if (review.update[f] === null) return false
                        const oldVal = review.item[f] ?? ''
                        const newVal = review.update[f] ?? ''
                        return String(oldVal) !== String(newVal)
                      }).map((field) => (
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

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
