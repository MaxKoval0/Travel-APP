import { useEffect, useRef, type ReactNode } from 'react'

interface PhotoLightboxProps {
  photos: string[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
  renderActions?: (index: number) => ReactNode
}

const SWIPE_THRESHOLD = 50

export default function PhotoLightbox({ photos, index, onClose, onIndexChange, renderActions }: PhotoLightboxProps) {
  const touchStartX = useRef<number | null>(null)

  const goPrev = () => onIndexChange((index - 1 + photos.length) % photos.length)
  const goNext = () => onIndexChange((index + 1) % photos.length)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > SWIPE_THRESHOLD) goPrev()
    else if (dx < -SWIPE_THRESHOLD) goNext()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between p-3">
        <span className="text-sm text-white/70">
          {photos.length > 1 ? `${index + 1} / ${photos.length}` : ''}
        </span>
        <button type="button" onClick={onClose} className="text-2xl text-white/80 hover:text-white" aria-label="Закрыть">
          ✕
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {photos.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60"
            aria-label="Предыдущее фото"
          >
            ‹
          </button>
        )}
        <img src={photos[index]} alt="" className="max-h-full max-w-full object-contain" />
        {photos.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60"
            aria-label="Следующее фото"
          >
            ›
          </button>
        )}
      </div>

      {renderActions && (
        <div className="flex justify-center gap-2 p-3" onClick={(e) => e.stopPropagation()}>
          {renderActions(index)}
        </div>
      )}
    </div>
  )
}
