import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { Autocomplete, GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import type { Place } from '../../lib/database.types'
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID } from '../../lib/googleMaps'
import MapPin from './MapPin'

const DEFAULT_CENTER = { lat: 20, lng: 10 }
const COORD_PATTERN = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

interface MapViewProps {
  places: Place[]
  selectedPlaceId: string | null
  pendingLocation: { lat: number; lng: number } | null
  onSelectPlace: (id: string) => void
  onMapClick: (lat: number, lng: number, name?: string, photoUrls?: string[]) => void
}

export default function MapView({ places, selectedPlaceId, pendingLocation, onSelectPlace, onMapClick }: MapViewProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    id: GOOGLE_MAPS_LOADER_ID,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const mapRef = useRef<google.maps.Map | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const [searchValue, setSearchValue] = useState('')

  const lookupPlaceDetails = useCallback(
    (placeId: string, fallbackLat: number, fallbackLng: number) => {
      if (!mapRef.current) return
      if (!placesServiceRef.current) {
        placesServiceRef.current = new google.maps.places.PlacesService(mapRef.current)
      }
      placesServiceRef.current.getDetails({ placeId, fields: ['name', 'geometry', 'photos'] }, (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          onMapClick(fallbackLat, fallbackLng)
          return
        }
        const loc = place.geometry?.location
        const photoUrls = (place.photos ?? []).slice(0, 6).map((p) => p.getUrl({ maxWidth: 800 }))
        onMapClick(loc ? loc.lat() : fallbackLat, loc ? loc.lng() : fallbackLng, place.name, photoUrls)
      })
    },
    [onMapClick],
  )

  // Locality/city labels on the base map don't carry a placeId like POI icons do —
  // reverse-geocode as a fallback so clicking a city still suggests its name. Each
  // geocode result carries its own place_id, so once we find the locality-level
  // result we can feed its place_id back through the same Places lookup used for
  // POI clicks — that's what gets the city its name *and* photos, not just a name.
  const reverseGeocodeName = useCallback(
    (lat: number, lng: number) => {
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder()
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
          onMapClick(lat, lng)
          return
        }
        const localityResult =
          results.find((r) => r.types.includes('locality')) ??
          results.find((r) => r.types.includes('postal_town')) ??
          results.find((r) => r.types.includes('administrative_area_level_2')) ??
          results.find((r) => r.types.includes('administrative_area_level_1'))

        if (localityResult?.place_id) {
          lookupPlaceDetails(localityResult.place_id, lat, lng)
          return
        }

        const name = results[0].address_components.find((c) => c.types.includes('locality'))?.long_name
        onMapClick(lat, lng, name)
      })
    },
    [onMapClick, lookupPlaceDetails],
  )

  const handleClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      const placeId = (e as google.maps.IconMouseEvent).placeId
      if (placeId) {
        ;(e as google.maps.IconMouseEvent).stop()
        lookupPlaceDetails(placeId, e.latLng.lat(), e.latLng.lng())
        return
      }
      reverseGeocodeName(e.latLng.lat(), e.latLng.lng())
    },
    [reverseGeocodeName, lookupPlaceDetails],
  )

  const goToLocation = (lat: number, lng: number, name?: string, photoUrls?: string[]) => {
    mapRef.current?.panTo({ lat, lng })
    mapRef.current?.setZoom(14)
    onMapClick(lat, lng, name, photoUrls)
    setSearchValue('')
  }

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace()
    const loc = place?.geometry?.location
    if (!loc) return
    const photoUrls = (place?.photos ?? []).slice(0, 6).map((p) => p.getUrl({ maxWidth: 800 }))
    goToLocation(loc.lat(), loc.lng(), place?.name, photoUrls)
  }

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const match = searchValue.match(COORD_PATTERN)
    if (!match) return
    e.preventDefault()
    const lat = Number(match[1])
    const lng = Number(match[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) goToLocation(lat, lng)
  }

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
    <div className="relative h-full w-full">
      <div className="absolute left-3 right-3 top-3 z-10 sm:right-auto sm:w-80">
        <Autocomplete
          onLoad={(a) => {
            a.setFields(['name', 'geometry', 'photos'])
            autocompleteRef.current = a
          }}
          onPlaceChanged={handlePlaceChanged}
        >
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Поиск места или координаты «41.40, 2.17»"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow outline-none focus:border-emerald-500"
          />
        </Autocomplete>
      </div>

      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={DEFAULT_CENTER}
        zoom={2}
        onClick={handleClick}
        onLoad={(map) => {
          mapRef.current = map
        }}
        options={{ streetViewControl: false, mapTypeControl: false }}
      >
        {places.map((place) => (
          <MapPin
            key={place.id}
            lat={place.lat}
            lng={place.lng}
            touristStatus={place.tourist_status}
            fpvStatus={place.fpv_status}
            visited={place.visited}
            selected={selectedPlaceId === place.id}
            onClick={() => onSelectPlace(place.id)}
          />
        ))}
        {pendingLocation && <MapPin lat={pendingLocation.lat} lng={pendingLocation.lng} pending selected />}
      </GoogleMap>
    </div>
  )
}
