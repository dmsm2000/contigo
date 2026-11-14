-- O plano de uma viagem: do "vamos a Salamanca" até ao fim da viagem.
-- Uma viagem pode nascer de um sorteio ou ser criada à mão ("planned"); a partir daí segue o mesmo ciclo:
-- sorteada ou a planear → preparada → em curso → fechada. Os dois leem e escrevem tudo.

alter table public.trips drop constraint trips_status_check;
alter table public.trips
  add constraint trips_status_check check (status in ('past', 'drawn', 'planned', 'prepared', 'ongoing', 'closed'));

alter table public.trips
  -- O teto da viagem, em euros (para as duas pessoas).
  add column budget_cap_eur numeric(10, 2) check (budget_cap_eur >= 0),
  -- Falso enquanto as datas ainda estão em avaliação (a viagem tem então só uma data provisória).
  add column dates_confirmed boolean not null default true,
  -- Notas gerais do plano (programa, dicas, o que falta decidir).
  add column plan_note text check (char_length(plan_note) <= 4000);

-- Datas em avaliação: várias opções, uma preferida.
create table public.trip_date_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text check (char_length(note) <= 200),
  preferred boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint trip_date_options_ordered check (end_date >= start_date)
);
create index trip_date_options_trip_idx on public.trip_date_options (trip_id, start_date);
create unique index trip_date_options_one_preferred on public.trip_date_options (trip_id) where preferred;

-- Alojamento: opções com preço total, e uma escolhida.
create table public.trip_stays (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price_eur numeric(10, 2) check (price_eur >= 0),
  rating numeric(3, 1) check (rating between 0 and 10),
  note text check (char_length(note) <= 500),
  link text check (char_length(link) <= 500),
  chosen boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_stays_trip_idx on public.trip_stays (trip_id, created_at);
create unique index trip_stays_one_chosen on public.trip_stays (trip_id) where chosen;

-- Como chegar: uma linha por origem (Porto, Madrid…).
create table public.trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  origin text not null check (char_length(btrim(origin)) between 1 and 60),
  mode text not null default 'car' check (mode in ('car', 'train', 'bus', 'flight', 'other')),
  minutes integer check (minutes between 0 and 6000),
  price_eur numeric(10, 2) check (price_eur >= 0),
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_legs_trip_idx on public.trip_legs (trip_id, created_at);

-- Orçamento estimado por pessoa, por categoria (as mesmas das despesas).
create table public.trip_budget_lines (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  category text not null check (category in ('transport', 'stay', 'food', 'activities', 'other')),
  amount_eur numeric(10, 2) not null check (amount_eur >= 0 and amount_eur <= 100000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (trip_id, category)
);

-- Lista leve do que queremos ver, fazer e comer (e o que falta tratar).
create table public.trip_checklist (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'todo' check (kind in ('see', 'do', 'eat', 'todo')),
  text text not null check (char_length(btrim(text)) between 1 and 200),
  done boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_checklist_trip_idx on public.trip_checklist (trip_id, created_at);

-- A hora e o autor da última alteração (a função já existe desde as viagens).
create trigger trip_date_options_touch before update on public.trip_date_options for each row execute function public.set_updated_at();
create trigger trip_stays_touch before update on public.trip_stays for each row execute function public.set_updated_at();
create trigger trip_legs_touch before update on public.trip_legs for each row execute function public.set_updated_at();
create trigger trip_budget_lines_touch before update on public.trip_budget_lines for each row execute function public.set_updated_at();
create trigger trip_checklist_touch before update on public.trip_checklist for each row execute function public.set_updated_at();

-- Acesso: quem tem conta (só existem as duas) lê e escreve tudo; o autor fica sempre registado.
do $$
declare
  t text;
begin
  foreach t in array array['trip_date_options', 'trip_stays', 'trip_legs', 'trip_budget_lines', 'trip_checklist'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: ler" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s: criar" on public.%1$I for insert to authenticated with check (created_by = (select auth.uid()))', t);
    execute format('create policy "%1$s: editar" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "%1$s: apagar" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

alter publication supabase_realtime add table
  public.trip_date_options, public.trip_stays, public.trip_legs, public.trip_budget_lines, public.trip_checklist;
