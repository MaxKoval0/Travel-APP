import { useState, type FormEvent } from 'react'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import { useCreatePlace } from '../../hooks/usePlaces'
import { useAddPlacePhotoFromUrl } from '../../hooks/usePlacePhotos'
import { FPV_STATUS_LABELS, TOURIST_STATUS_LABELS } from './statusStyles'
import PhotoLightbox from '../../components/PhotoLightbox'

interface PlaceFormProps {
  lat: number
  lng: number
  initialName?: string
  googlePhotoUrls?: string[]
  onSaved: (id: string) => void
  onCancel: () => void
}

const TOURIST_STATUSES: TouristStatus[] = ['top', 'normal']
const FPV_STATUSES: FpvStatus[] = ['allowed', 'unclear', 'banned']

export default function PlaceForm({ lat, lng, initialName, googlePhotoUrls, onSaved, onCancel }: PlaceFormProps) {
  const [name, setName] = useState(initialName ?? '')
  const [nameEdited, setNameEdited] = useState(false)
  const [touristStatus, setTouristStatus] = useState<TouristStatus | null>(null)
  const [fpvStatus, setFpvStatus] = useState<FpvStatus | null>(null)
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(() => new Set(googlePhotoUrls))
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const createPlace = useCreatePlace()
  const addPhotoFromUrl = useAddPlacePhotoFromUrl()

  // The pin shows up instantly on click, but its name/photos resolve asynchronously
  // afterwards and arrive as prop updates to this already-mounted form. Adjust state
  // during render (React's recommended alternative to syncing props via an effect)
  // so they're picked up without clobbering anything the user already typed.
  const [prevInitialName, setPrevInitialName] = useState(initialName)
  if (initialName !== prevInitialName) {
    setPrevInitialName(initialName)
    if (!nameEdited && initialName) setName(initialName)
  }

  const [prevGooglePhotoUrls, setPrevGooglePhotoUrls] = useState(googlePhotoUrls)
  if (googlePhotoUrls !== prevGooglePhotoUrls) {
    setPrevGooglePhotoUrls(googlePhotoUrls)
    if (googlePhotoUrls) setSelectedPhotos(new Set(googlePhotoUrls))
  }

  const togglePhoto = (url: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

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
    if (selectedPhotos.size > 0) {
      await Promise.all(
        [...selectedPhotos].map((url) => addPhotoFromUrl.mutateAsync({ placeId: place.id, imageUrl: url })),
      )
    }
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
          onChange={(e) => {
            setName(e.target.value)
            setNameEdited(true)
          }}
          className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Название места"
        />
      </label>

      {googlePhotoUrls && googlePhotoUrls.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-400">Фото из Google — выбери, какие сохранить</span>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {googlePhotoUrls.map((url, i) => {
              const isSelected = selectedPhotos.has(url)
              return (
                <div
                  key={url}
                  className={`relative h-24 w-24 shrink-0 overflow-hidden rounded border-2 ${
                    isSelected ? 'border-emerald-500' : 'border-transparent'
                  }`}
                >
                  <button type="button" onClick={() => togglePhoto(url)} className="block h-full w-full">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-emerald-600/40 text-lg text-white">
                        ✓
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPreviewIndex(i)
                    }}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="Открыть фото"
                  >
                    ⤢
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {previewIndex !== null && googlePhotoUrls && (
        <PhotoLightbox
          photos={googlePhotoUrls}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
          renderActions={(i) => {
            const url = googlePhotoUrls[i]
            const isSelected = selectedPhotos.has(url)
            return (
              <button
                type="button"
                onClick={() => togglePhoto(url)}
                className={`rounded px-3 py-1.5 text-xs ${
                  isSelected ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isSelected ? '✓ Выбрано для сохранения' : 'Выбрать для сохранения'}
              </button>
            )
          }}
        />
      )}

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
          disabled={!name.trim() || createPlace.isPending || addPhotoFromUrl.isPending}
          className="flex-1 rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createPlace.isPending || addPhotoFromUrl.isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
