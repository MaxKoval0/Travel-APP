export type PlaceStatus = 'want' | 'unsure' | 'disliked'
export type TripStatus = 'planned' | 'active' | 'done'
export type TripItemConfidence = 'confirmed' | 'possible' | 'questionable'

// NOTE: these must be `type` aliases, not `interface` declarations.
// TypeScript 6 no longer treats `interface` as satisfying `extends Record<string, unknown>`,
// which is what postgrest-js uses internally to validate the Database generic — an `interface`
// Row type here silently breaks all query typing (everything resolves to `never`).
export type Place = {
  id: string
  name: string
  lat: number
  lng: number
  status: PlaceStatus
  visited: boolean
  description: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PlacePhoto = {
  id: string
  place_id: string
  storage_path: string
  is_primary: boolean
  created_at: string
}

export type Trip = {
  id: string
  title: string
  date_start: string | null
  date_end: string | null
  status: TripStatus
  description: string | null
  created_at: string
  updated_at: string
}

export type TripItem = {
  id: string
  trip_id: string
  place_id: string | null
  title: string
  notes: string | null
  date: string | null
  lat: number | null
  lng: number | null
  sort_order: number
  is_done: boolean
  confidence: TripItemConfidence | null
  category: string | null
  area: string | null
  cost_estimate: string | null
  duration_estimate: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      places: {
        Row: Place
        Insert: {
          id?: string
          name: string
          lat: number
          lng: number
          status?: PlaceStatus
          visited?: boolean
          description?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Place, 'id'>>
        Relationships: []
      }
      place_photos: {
        Row: PlacePhoto
        Insert: {
          id?: string
          place_id: string
          storage_path: string
          is_primary?: boolean
          created_at?: string
        }
        Update: Partial<Omit<PlacePhoto, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'place_photos_place_id_fkey'
            columns: ['place_id']
            isOneToOne: false
            referencedRelation: 'places'
            referencedColumns: ['id']
          },
        ]
      }
      trips: {
        Row: Trip
        Insert: {
          id?: string
          title: string
          date_start?: string | null
          date_end?: string | null
          status?: TripStatus
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Trip, 'id'>>
        Relationships: []
      }
      trip_items: {
        Row: TripItem
        Insert: {
          id?: string
          trip_id: string
          place_id?: string | null
          title: string
          notes?: string | null
          date?: string | null
          lat?: number | null
          lng?: number | null
          sort_order?: number
          is_done?: boolean
          confidence?: TripItemConfidence | null
          category?: string | null
          area?: string | null
          cost_estimate?: string | null
          duration_estimate?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<TripItem, 'id'>>
        Relationships: [
          {
            foreignKeyName: 'trip_items_trip_id_fkey'
            columns: ['trip_id']
            isOneToOne: false
            referencedRelation: 'trips'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trip_items_place_id_fkey'
            columns: ['place_id']
            isOneToOne: false
            referencedRelation: 'places'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
