import { useMemo } from 'react'
import { GoogleMap, OverlayView, useJsApiLoader } from '@react-google-maps/api'
import type { TripItemWithPlace } from './types'

interface Point {
  id: string
  lat: number
  lng: number
  title: string
  isDone: boolean
}

export default function TripMiniMap({ items }: { items: TripItemWithPlace[] }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: 'travel-tracker-google-maps',
  })

  const points = useMemo<Point[]>(() => {
    const result: Point[] = []
    for (const item of items) {
      const lat = item.places?.lat ?? item.lat
      const lng = item.places?.lng ?? item.lng
      if (lat == null || lng == null) continue
      result.push({ id: item.id, lat, lng, title: item.places?.name ?? item.title, isDone: item.is_done })
    }
    return result
  }, [items])

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
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center bg-slate-100 text-xs text-slate-400">
        Нет точек с координатами
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerClassName="h-48 w-full"
      center={{ lat: points[0].lat, lng: points[0].lng }}
      zoom={points.length > 1 ? 5 : 9}
      options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      {points.map((point) => (
        <OverlayView
          key={point.id}
          position={{ lat: point.lat, lng: point.lng }}
          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        >
          <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
            <span
              className={`mb-0.5 max-w-[120px] truncate rounded px-1 text-[10px] font-medium shadow ${
                point.isDone ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-700'
              }`}
            >
              {point.title}
            </span>
            <span
              className={`h-3 w-3 rounded-full border-2 border-white shadow ${
                point.isDone ? 'bg-slate-300' : 'bg-emerald-600'
              }`}
            />
          </div>
        </OverlayView>
      ))}
    </GoogleMap>
  )
}
