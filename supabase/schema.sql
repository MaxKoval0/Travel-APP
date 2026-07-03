-- Travel Tracker — initial schema
-- Run once in Supabase Dashboard > SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS throughout.

create extension if not exists "pgcrypto";

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat float8 not null,
  lng float8 not null,
  tourist_status text check (tourist_status in ('top', 'normal')),
  fpv_status text check (fpv_status in ('allowed', 'unclear', 'banned')),
  visited bool not null default false,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-running this file against a database created before `visited` existed:
alter table places add column if not exists visited bool not null default false;

-- Migrate the old 3-value `status` (want/unsure/disliked) into the new, independent, optional
-- fields `tourist_status` (top/normal) and `fpv_status` (allowed/unclear/banned). Both are
-- nullable — null means "no opinion set", i.e. a plain pin on the map.
alter table places add column if not exists tourist_status text;
alter table places add column if not exists fpv_status text;
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'places' and column_name = 'status') then
    update places set tourist_status = case when status = 'want' then 'top' else 'normal' end
    where tourist_status is null;
    alter table places drop column status;
  end if;
end $$;
alter table places drop constraint if exists places_status_check;
alter table places drop constraint if exists places_tourist_status_check;
alter table places add constraint places_tourist_status_check check (tourist_status in ('top', 'normal'));
alter table places drop constraint if exists places_fpv_status_check;
alter table places add constraint places_fpv_status_check check (fpv_status in ('allowed', 'unclear', 'banned'));

create table if not exists place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  storage_path text not null,
  is_primary bool not null default false,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_start date,
  date_end date,
  status text not null default 'planned' check (status in ('planned', 'active', 'done')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trips add column if not exists notes text;

create table if not exists trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  title text not null,
  notes text,
  date date,
  lat float8,
  lng float8,
  sort_order int not null default 0,
  is_done bool not null default false,
  confidence text check (confidence in ('confirmed', 'possible', 'questionable')),
  category text,
  area text,
  cost_estimate text,
  duration_estimate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-running this file against a database created before these columns existed:
alter table trip_items add column if not exists confidence text;
alter table trip_items drop constraint if exists trip_items_confidence_check;
alter table trip_items add constraint trip_items_confidence_check check (confidence in ('confirmed', 'possible', 'questionable'));
alter table trip_items add column if not exists category text;
alter table trip_items add column if not exists area text;
alter table trip_items add column if not exists cost_estimate text;
alter table trip_items add column if not exists duration_estimate text;

create index if not exists trip_items_trip_sort_idx on trip_items (trip_id, sort_order);
create index if not exists trip_items_place_idx on trip_items (place_id);

-- ── updated_at triggers ─────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on places;
create trigger set_updated_at before update on places
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on trips;
create trigger set_updated_at before update on trips
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on trip_items;
create trigger set_updated_at before update on trip_items
  for each row execute function set_updated_at();

-- ── RLS: no-auth app, anon role gets full access ───────────────────────
-- App has no login — every visitor is the `anon` role. RLS is enabled (not skipped)
-- so the security model is explicit and easy to tighten later if auth is ever added.

alter table places enable row level security;
alter table place_photos enable row level security;
alter table trips enable row level security;
alter table trip_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on places, place_photos, trips, trip_items to anon, authenticated;

drop policy if exists "anon full access" on places;
create policy "anon full access" on places for all to anon using (true) with check (true);

drop policy if exists "anon full access" on place_photos;
create policy "anon full access" on place_photos for all to anon using (true) with check (true);

drop policy if exists "anon full access" on trips;
create policy "anon full access" on trips for all to anon using (true) with check (true);

drop policy if exists "anon full access" on trip_items;
create policy "anon full access" on trip_items for all to anon using (true) with check (true);

-- ── Storage: place-photos bucket, public read ──────────────────────────

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

drop policy if exists "place-photos anon select" on storage.objects;
create policy "place-photos anon select" on storage.objects for select to anon
  using (bucket_id = 'place-photos');

drop policy if exists "place-photos anon insert" on storage.objects;
create policy "place-photos anon insert" on storage.objects for insert to anon
  with check (bucket_id = 'place-photos');

drop policy if exists "place-photos anon update" on storage.objects;
create policy "place-photos anon update" on storage.objects for update to anon
  using (bucket_id = 'place-photos');

drop policy if exists "place-photos anon delete" on storage.objects;
create policy "place-photos anon delete" on storage.objects for delete to anon
  using (bucket_id = 'place-photos');
