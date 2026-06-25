import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MapView from './MapView'
import PlaceCard from './PlaceCard'
import PlaceForm from './PlaceForm'
import { usePlaces } from '../../hooks/usePlaces'

export default function PlacesPage() {
  const { data: places } = usePlaces()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedPlaceId = searchParams.get('place')
  const [pendingNewPlace, setPendingNewPlace] = useState<{
    lat: number
    lng: number
    name?: string
    photoUrls?: string[]
  } | null>(null)

  const selectPlace = (id: string | null) => {
    setPendingNewPlace(null)
    const next = new URLSearchParams(searchParams)
    if (id) next.set('place', id)
    else next.delete('place')
    setSearchParams(next, { replace: true })
  }

  const showPanel = Boolean(selectedPlaceId || pendingNewPlace)

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="relative flex-1">
        <MapView
          places={places ?? []}
          selectedPlaceId={selectedPlaceId}
          pendingLocation={pendingNewPlace}
          onSelectPlace={(id) => selectPlace(id)}
          onMapClick={(lat, lng, name, photoUrls) => {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('place')
                return next
              },
              { replace: true },
            )
            setPendingNewPlace((prev) => {
              // Same pin, lookup just resolved — enrich the already-open form in place.
              if (prev && prev.lat === lat && prev.lng === lng) {
                return { lat, lng, name: name ?? prev.name, photoUrls: photoUrls ?? prev.photoUrls }
              }
              return { lat, lng, name, photoUrls }
            })
          }}
        />
      </div>

      {showPanel && (
        <div className="z-10 h-[45%] w-full border-t border-slate-200 bg-white shadow-lg md:h-full md:w-96 md:border-l md:border-t-0">
          {pendingNewPlace ? (
            <PlaceForm
              key={`${pendingNewPlace.lat}-${pendingNewPlace.lng}`}
              lat={pendingNewPlace.lat}
              lng={pendingNewPlace.lng}
              initialName={pendingNewPlace.name}
              googlePhotoUrls={pendingNewPlace.photoUrls}
              onCancel={() => setPendingNewPlace(null)}
              onSaved={(id) => {
                setPendingNewPlace(null)
                selectPlace(id)
              }}
            />
          ) : (
            selectedPlaceId && <PlaceCard key={selectedPlaceId} placeId={selectedPlaceId} onClose={() => selectPlace(null)} />
          )}
        </div>
      )}
    </div>
  )
}
