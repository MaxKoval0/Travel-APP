import type { Libraries } from '@react-google-maps/api'

// Shared across every useJsApiLoader call — the underlying loader is a singleton keyed by `id`
// and warns (and won't pick up new libraries) if different calls pass different `libraries` arrays.
export const GOOGLE_MAPS_LOADER_ID = 'travel-tracker-google-maps'
export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places']

// References google.maps.* enums, so only call this once the script has actually loaded
// (i.e. from inside a component, after useJsApiLoader's isLoaded is true).
export function mapTypeControlOptions(): google.maps.MapTypeControlOptions {
  return {
    mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
    position: google.maps.ControlPosition.TOP_RIGHT,
  }
}
