import { useRef, useState, type FormEvent } from 'react'
import {
  usePlacePhotos,
  useUploadPlacePhoto,
  useAddPlacePhotoFromUrl,
  useDeletePlacePhoto,
  useSetPrimaryPhoto,
} from '../../hooks/usePlacePhotos'
import { placePhotoUrl } from '../../lib/supabase'
import PhotoLightbox from '../../components/PhotoLightbox'

export default function PhotoGallery({ placeId }: { placeId: string }) {
  const { data: photos } = usePlacePhotos(placeId)
  const uploadFile = useUploadPlacePhoto()
  const addFromUrl = useAddPlacePhotoFromUrl()
  const deletePhoto = useDeletePlacePhoto()
  const setPrimary = useSetPrimaryPhoto()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlValue, setUrlValue] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile.mutate({ placeId, file })
    e.target.value = ''
  }

  const handleUrlSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!urlValue.trim()) return
    setUrlError(null)
    try {
      await addFromUrl.mutateAsync({ placeId, imageUrl: urlValue.trim() })
      setUrlValue('')
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Не удалось загрузить')
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-2">
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded border border-slate-200"
            >
              <img
                src={placePhotoUrl(photo.storage_path)}
                alt=""
                className="h-full w-full cursor-pointer object-cover"
                onClick={() => setLightboxIndex(i)}
              />
              {photo.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1 text-[10px] text-white">
                  главное
                </span>
              )}
              <button
                type="button"
                onClick={() => deletePhoto.mutate(photo)}
                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                aria-label="Удалить фото"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadFile.isPending}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600 disabled:opacity-50"
        >
          {uploadFile.isPending ? 'Загрузка…' : '+ Загрузить файл'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <form onSubmit={handleUrlSubmit} className="flex gap-1.5">
        <input
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="Ссылка на фото"
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={addFromUrl.isPending || !urlValue.trim()}
          className="rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600 disabled:opacity-50"
        >
          {addFromUrl.isPending ? '…' : 'Добавить'}
        </button>
      </form>
      {urlError && <p className="text-xs text-red-500">{urlError}</p>}

      {lightboxIndex !== null && photos && photos.length > 0 && (
        <PhotoLightbox
          photos={photos.map((p) => placePhotoUrl(p.storage_path))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          renderActions={(i) => {
            const photo = photos[i]
            return (
              <>
                {!photo.is_primary && (
                  <button
                    type="button"
                    onClick={() => setPrimary.mutate({ placeId, photoId: photo.id })}
                    className="rounded bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
                  >
                    Сделать главным
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    deletePhoto.mutate(photo)
                    setLightboxIndex(null)
                  }}
                  className="rounded bg-white/10 px-3 py-1.5 text-xs text-red-300 hover:bg-white/20"
                >
                  Удалить
                </button>
              </>
            )
          }}
        />
      )}
    </div>
  )
}
