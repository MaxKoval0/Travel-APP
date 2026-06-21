import { useCallback } from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import type { Place } from '../../lib/database.types'
import { STATUS_COLORS } from './statusStyles'

const DEFAULT_CENTER = { lat: 20, lng: 10 }
// Teardrop pin path, tip at (0,0), anchored at the tip.
const PIN_PATH = 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1 1 10,-30 C 10,-22 2,-20 0,0 z'
// Visited places go grey on the map regardless of status — mirrors the "done" treatment on the trip mini-map.
const VISITED_COLOR = '#94a3b8'

interface MapViewProps {
  places: Place[]
  selectedPlaceId: string | null
  onSelectPlace: (id: string) => void
  onMapClick: (lat: number, lng: number) => void
}

export default function MapView({ places, selectedPlaceId, onSelectPlace, onMapClick }: MapViewProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: 'travel-tracker-google-maps',
  })

  const handleClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng())
    },
    [onMapClick],
  )

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-500">
        Добавь VITE_GOOGLE_MAPS_API_KEY в .env.local, чтобы загрузить карту
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-400">
        Загрузка карты…
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerClassName="h-full w-full"
      center={DEFAULT_CENTER}
      zoom={2}
      onClick={handleClick}
      options={{ streetViewControl: false, mapTypeControl: false }}
    >
      {places.map((place) => (
        <MarkerF
          key={place.id}
          position={{ lat: place.lat, lng: place.lng }}
          onClick={() => onSelectPlace(place.id)}
          icon={{
            path: PIN_PATH,
            fillColor: place.visited ? VISITED_COLOR : STATUS_COLORS[place.status],
            fillOpacity: 1,
            strokeColor: '#1f2937',
            strokeWeight: 1,
            scale: selectedPlaceId === place.id ? 1.5 : 1.1,
            anchor: new google.maps.Point(0, 0),
          }}
        />
      ))}
    </GoogleMap>
  )
}
