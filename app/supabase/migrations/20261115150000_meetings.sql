-- Encontros: os dias em que os dois estão juntos sem ser uma viagem (por exemplo, quando ela vem ao Porto).
-- O contador do Início conta para o próximo encontro, seja uma viagem ou uma destas visitas.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  -- Vazio = um só dia.
  end_date date,
  -- Onde é: em casa dele (Porto), em casa dela (Madrid) ou noutro sítio.
  at_place text not null default 'porto' check (at_place in ('porto', 'madrid', 'other')),
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_dates_ordered check (end_date is null or end_date >= start_date)
);

create index meetings_start_date_idx on public.meetings (start_date);

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

create policy "encontros: ler" on public.meetings for select to authenticated using (true);
create policy "encontros: criar" on public.meetings for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "encontros: editar" on public.meetings for update to authenticated using (true) with check (true);
create policy "encontros: apagar" on public.meetings for delete to authenticated using (true);

alter publication supabase_realtime add table public.meetings;
