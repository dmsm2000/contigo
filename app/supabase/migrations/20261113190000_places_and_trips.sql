-- Sítios e viagens.
-- Os dois utilizadores partilham tudo: quem tem conta (e só existem as duas) lê e escreve tudo.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Distrito, província ou região, para distinguir sítios com o mesmo nome.
  admin1 text check (char_length(admin1) <= 120),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  -- Identificador do OpenStreetMap (por exemplo, R4115866). Evita sítios repetidos.
  osm_ref text unique check (osm_ref ~ '^[NWR][0-9]+$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint places_coordinates_together check ((lat is null) = (lng is null))
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete restrict,
  -- past = viagem já feita (registada à mão). Os outros estados são do ciclo mensal.
  status text not null default 'past' check (status in ('past', 'drawn', 'prepared', 'ongoing', 'closed')),
  start_date date not null,
  end_date date,
  -- Em viagens antigas só se sabe o mês: start_date é o dia 1.
  date_precision text not null default 'month' check (date_precision in ('month', 'day')),
  with_partner boolean not null default true,
  would_return text check (would_return in ('yes', 'maybe', 'no')),
  cost_eur numeric(10, 2) check (cost_eur >= 0),
  note text check (char_length(note) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_ordered check (end_date is null or end_date >= start_date),
  constraint trips_month_starts_on_first check (date_precision <> 'month' or extract(day from start_date) = 1)
);

create index trips_start_date_idx on public.trips (start_date desc);
create index trips_place_id_idx on public.trips (place_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.places enable row level security;
alter table public.trips enable row level security;

create policy "places: ler" on public.places for select to authenticated using (true);
create policy "places: criar" on public.places for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "places: editar" on public.places for update to authenticated using (true) with check (true);
create policy "places: apagar" on public.places for delete to authenticated using (true);

create policy "trips: ler" on public.trips for select to authenticated using (true);
create policy "trips: criar" on public.trips for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "trips: editar" on public.trips for update to authenticated using (true) with check (true);
create policy "trips: apagar" on public.trips for delete to authenticated using (true);

-- Cada um vê no momento o que o outro regista.
alter publication supabase_realtime add table public.places, public.trips;
