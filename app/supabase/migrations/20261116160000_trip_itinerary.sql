-- Roteiro de uma viagem: dia a dia, com horas, sítios e custos estimados.
-- Nasce de um pedido que a app compõe, que se cola num chat; a resposta (JSON) cola-se de volta na app e entra como
-- rascunho. Aceitar o rascunho substitui o roteiro aceite. Cada viagem tem, no máximo, um rascunho e um roteiro aceite.

create table public.trip_itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'accepted')),
  summary text check (char_length(summary) <= 1000),
  -- Dicas gerais (reservas, transportes, o que levar…), uma por linha.
  tips text[] not null default '{}' check (cardinality(tips) <= 20),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create unique index trip_itineraries_one_per_status on public.trip_itineraries (trip_id, status);

create table public.trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.trip_itineraries (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- O dia da viagem (1 = o primeiro): serve mesmo quando as datas ainda não estão fechadas.
  day smallint not null check (day between 1 and 60),
  position smallint not null default 0,
  start_time time,
  end_time time,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null default 'other' check (category in ('see', 'eat', 'do', 'move', 'rest', 'other')),
  description text check (char_length(description) <= 600),
  place_name text check (char_length(place_name) <= 120),
  address text check (char_length(address) <= 200),
  -- Custo estimado por pessoa, em euros.
  cost_eur numeric(10, 2) check (cost_eur >= 0 and cost_eur <= 10000),
  -- Reservas ou bilhetes a tratar antes ("reservar com 2 semanas").
  booking text check (char_length(booking) <= 200),
  link text check (char_length(link) <= 500),
  tip text check (char_length(tip) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_itinerary_items_itinerary_idx on public.trip_itinerary_items (itinerary_id, day, position);
create index trip_itinerary_items_trip_idx on public.trip_itinerary_items (trip_id);

create trigger trip_itineraries_touch before update on public.trip_itineraries for each row execute function public.set_updated_at();
create trigger trip_itinerary_items_touch before update on public.trip_itinerary_items for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['trip_itineraries', 'trip_itinerary_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: ler" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s: criar" on public.%1$I for insert to authenticated with check (created_by = (select auth.uid()))', t);
    execute format('create policy "%1$s: editar" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "%1$s: apagar" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

alter publication supabase_realtime add table public.trip_itineraries, public.trip_itinerary_items;
