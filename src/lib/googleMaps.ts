import type { Libraries } from '@react-google-maps/api'

// Shared across every useJsApiLoader call — the underlying loader is a singleton keyed by `id`
// and warns (and won't pick up new libraries) if different calls pass different `libraries` arrays.
export const GOOGLE_MAPS_LOADER_ID = 'travel-tracker-google-maps'
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places']
