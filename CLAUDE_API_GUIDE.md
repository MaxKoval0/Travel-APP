# Travel Tracker — API guide for Claude

Paste this whole file into a Claude chat when you want Claude to read or write data
in this app directly (e.g. "add this place", "create a trip", "add this photo").
This app has no login — every request below uses the public `anon` key, which is
designed to be shared (access is controlled by Row Level Security on the Supabase side).

## Connection

```
SUPABASE_URL=https://fkhxnwhqgchxnqecholg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHhud2hxZ2NoeG5xZWNob2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzgyODAsImV4cCI6MjA5NzU1NDI4MH0.xNrTPW6Ao3ThfVBxzvHwvhEymX19TFX5kUIhRwRcRE8
APP_URL=<домен после деплоя на Vercel, см. "Фото по ссылке" ниже>
```

All table requests go through PostgREST:

```
{METHOD} {SUPABASE_URL}/rest/v1/{table}
headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {SUPABASE_ANON_KEY}
  Content-Type: application/json
  Prefer: return=representation   # (on POST/PATCH, to get the row back in the response)
```

## Schema

### `places`
| column | type | notes |
|---|---|---|
| id | uuid | auto-generated, omit on insert |
| name | text | required |
| lat, lng | float8 | required |
| status | text | `want` \| `unsure` \| `disliked`, defaults to `want` |
| visited | bool | defaults to `false` — whether you've actually been there (independent of `status`) |
| description | text | nullable |
| notes | text | nullable |
| created_at, updated_at | timestamptz | auto |

### `place_photos` (read-only here — see "Adding a photo" below for writes)
| column | type | notes |
|---|---|---|
| id | uuid | |
| place_id | uuid | references `places.id` |
| storage_path | text | path inside the `place-photos` bucket |
| is_primary | bool | |

### `trips`
| column | type | notes |
|---|---|---|
| id | uuid | auto-generated, omit on insert |
| title | text | required |
| date_start, date_end | date | nullable, format `YYYY-MM-DD` |
| status | text | `planned` \| `active` \| `done`, defaults to `planned` |
| description | text | nullable |

### `trip_items`
| column | type | notes |
|---|---|---|
| id | uuid | auto-generated, omit on insert |
| trip_id | uuid | required, references `trips.id` |
| place_id | uuid | optional — link to an existing `places` row |
| title | text | required |
| notes | text | nullable |
| date | date | nullable — omit/null for "не распределено" (unscheduled) items |
| lat, lng | float8 | nullable — only for one-off logistics points not worth saving as a `place` |
| sort_order | int | defaults to 0; for manual ordering among undated items |
| is_done | bool | defaults to false |

## Examples

### Add a place
```bash
curl -X POST "$SUPABASE_URL/rest/v1/places" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"name":"Eiffel Tower","lat":48.8584,"lng":2.2945,"status":"want","notes":"book tickets ahead"}'
```

### Find a place by name
```bash
curl "$SUPABASE_URL/rest/v1/places?name=ilike.*eiffel*" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

### Update a place's status
```bash
curl -X PATCH "$SUPABASE_URL/rest/v1/places?id=eq.<PLACE_ID>" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"status":"disliked"}'
```

### Create a trip
```bash
curl -X POST "$SUPABASE_URL/rest/v1/trips" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"title":"Paris, June","date_start":"2026-06-10","date_end":"2026-06-15","status":"planned"}'
```

### Add an item to a trip, linked to an existing place
```bash
curl -X POST "$SUPABASE_URL/rest/v1/trip_items" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"trip_id":"<TRIP_ID>","place_id":"<PLACE_ID>","title":"Eiffel Tower"}'
```

### Add an unscheduled item (no date — goes into "Не распределено")
Omit `date` entirely (or send `null`).

### Add a one-off logistics point (not worth saving as a permanent place)
```bash
curl -X POST "$SUPABASE_URL/rest/v1/trip_items" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"trip_id":"<TRIP_ID>","title":"Lunch spot near the hotel","lat":48.86,"lng":2.35}'
```

### Read a place together with the trips it's linked to
```bash
curl "$SUPABASE_URL/rest/v1/trip_items?place_id=eq.<PLACE_ID>&select=id,trips(id,title,status)" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

## Adding a photo (by URL)

Photos are real files in Supabase Storage, not links — so adding one needs a tiny
server-side step (fetching the image and uploading the bytes), which the app exposes
as its own endpoint. This call needs **no Supabase key at all**:

```bash
curl -X POST "$APP_URL/api/photos/from-url" \
  -H "Content-Type: application/json" \
  -d '{"place_id":"<PLACE_ID>","image_url":"https://example.com/photo.jpg"}'
```

Notes:
- `image_url` must point directly at an image (the server checks the `Content-Type` header).
- Max size: 15MB.
- This only works once the app is deployed to Vercel (or running locally via `vercel dev`) —
  a plain `vite dev` server does not serve the `/api` folder.
- Never call the photo endpoint with the Supabase service role key — it doesn't need one,
  and that key must never leave the Vercel environment variables.

## Things to keep in mind

- Always send UUIDs you already have (from a previous GET) — don't invent IDs.
- `status` and other enum-like fields only accept the exact values listed in the schema
  section above; anything else is rejected by a database constraint.
- This app has no auth and the anon key is intentionally public — that's expected, not a bug.
