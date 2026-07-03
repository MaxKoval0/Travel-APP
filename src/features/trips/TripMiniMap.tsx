import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { useCreateTripItem } from '../../hooks/useTripItems'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID, mapTypeControlOptions } from '../../lib/googleMaps'
import type { FpvStatus, TouristStatus } from '../../lib/database.types'
import MapPin from '../places/MapPin'
import type { TripItemWithPlace } from './types'

const DEFAULT_CENTER = { lat: 20, lng: 10 }

interface Point {
  id: string
  placeId: string | null
  lat: number
  lng: number
  title: string
  touristStatus: TouristStatus | null
  fpvStatus: FpvStatus | null
  muted: boolean
}

interface TripMiniMapProps {
  tripId: string
  items: TripItemWithPlace[]
  onOpenPlace: (placeId: string) => void
  focusPoint?: { lat: number; lng: number } | null
}

export default function TripMiniMap({ tripId, items, onOpenPlace, focusPoint }: TripMiniMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: GOOGLE_MAPS_LOADER_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const createItem = useCreateTripItem()
  const mapRef = useRef<google.maps.Map | null>(null)
  const initialFitDoneRef = useRef(false)
  const pinClickedRef = useRef(false)

  const [expanded, setExpanded] = useState(false)
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')

  const points = useMemo<Point[]>(() => {
    const result: Point[] = []
    for (const item of items) {
      const lat = item.places?.lat ?? item.lat
      const lng = item.places?.lng ?? item.lng
      if (lat == null || lng == null) continue
      result.push({
        id: item.id,
        placeId: item.places?.id ?? null,
        lat,
        lng,
        title: item.places?.name ?? item.title,
        touristStatus: item.places?.tourist_status ?? null,
        fpvStatus: item.places?.fpv_status ?? null,
        muted: item.is_done,
      })
    }
    return result
  }, [items])

  const fitBounds = useCallback(() => {
    const map = mapRef.current
    if (!map || initialFitDoneRef.current || points.length === 0) return
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng })
      map.setZoom(9)
    } else {
      const bounds = new google.maps.LatLngBounds()
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
      map.fitBounds(bounds, 40)
    }
    initialFitDoneRef.current = true
  }, [points])

  useEffect(() => {
    fitBounds()
  }, [fitBounds])

  useEffect(() => {
    if (!focusPoint) return
    setExpanded(true)
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.panTo(focusPoint)
        mapRef.current.setZoom(14)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [focusPoint])

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (pinClickedRef.current) {
      pinClickedRef.current = false
      return
    }
    if (!expanded || !e.latLng) return
    setPendingPoint({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    setPendingTitle('')
  }

  const handleSavePoint = async (e: FormEvent) => {
    e.preventDefault()
    if (!pendingPoint || !pendingTitle.trim()) return
    await createItem.mutateAsync({
      trip_id: tripId,
      title: pendingTitle.trim(),
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
    })
    setPendingPoint(null)
    setPendingTitle('')
  }

  if (!apiKey) {
    return (
      <div className="flex h-48 items-center justify-center bg-slate-100 text-xs text-slate-400">
        Нужен VITE_GOOGLE_MAPS_API_KEY
      </div>
    )
  }
  if (!isLoaded) {
    return (
      <div className="flex h-48 items-center justify-center bg-slate-100 text-xs text-slate-400">
        Загрузка карты…
      </div>
    )
  }

  return (
    <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-white' : 'relative'}>
      {expanded && (
        <div className="flex items-center justify-between border-b border-slate-200 p-3">
          <span className="text-sm font-semibold text-slate-700">Карта поездки</span>
          <button
            type="button"
            onClick={() => {
              setExpanded(false)
              setPendingPoint(null)
            }}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            Свернуть
          </button>
        </div>
      )}

      <div className={expanded ? 'relative flex-1' : 'relative h-48 w-full overflow-hidden rounded'}>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Развернуть карту"
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded bg-white/90 text-slate-600 shadow"
          >
            <ExpandIcon className="h-4 w-4" />
          </button>
        )}

        {points.length === 0 && !expanded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-slate-400">
            Нет точек с координатами
          </div>
        )}

        <GoogleMap
          mapContainerClassName="h-full w-full"
          center={DEFAULT_CENTER}
          zoom={2}
          onClick={handleMapClick}
          onLoad={(map) => {
            mapRef.current = map
            fitBounds()
          }}
          options={{
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: expanded ? 'greedy' : 'cooperative',
            mapTypeControl: expanded,
            mapTypeControlOptions: mapTypeControlOptions(),
          }}
        >
          {points.map((point) => (
            <MapPin
              key={point.id}
              lat={point.lat}
              lng={point.lng}
              label={point.title}
              touristStatus={point.touristStatus}
              fpvStatus={point.fpvStatus}
              visited={point.muted}
              onPointerDown={point.placeId ? () => {
                pinClickedRef.current = true
                setTimeout(() => { pinClickedRef.current = false }, 400)
              } : undefined}
              onClick={point.placeId ? () => {
                pinClickedRef.current = true
                onOpenPlace(point.placeId!)
              } : undefined}
            />
          ))}
          {pendingPoint && <MapPin lat={pendingPoint.lat} lng={pendingPoint.lng} pending selected />}
        </GoogleMap>

        {expanded && !pendingPoint && (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow">
            Клик по карте — добавить точку в эту поездку
          </div>
        )}

        {pendingPoint && (
          <form
            onSubmit={handleSavePoint}
            className="absolute bottom-3 left-1/2 z-10 flex w-72 -translate-x-1/2 gap-2 rounded border border-slate-200 bg-white p-2 shadow-lg"
          >
            <input
              autoFocus
              value={pendingTitle}
              onChange={(e) => setPendingTitle(e.target.value)}
              placeholder="Название точки"
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setPendingPoint(null)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-600"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!pendingTitle.trim() || createItem.isPending}
              className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Добавить
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9 3.75 3.75M9 9V4.5M9 9H4.5M15 9l5.25-5.25M15 9V4.5M15 9h4.5M9 15l-5.25 5.25M9 15v4.5M9 15H4.5M15 15l5.25 5.25M15 15v4.5M15 15h4.5" />
    </svg>
  )
}
