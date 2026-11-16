-- Encontros (visitas sem ser viagem) + hora opcional. Seguro de correr mais de uma vez:
-- cria o que falta e deixa em paz o que já existe. Cola no Supabase > SQL Editor > Run.

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  at_place text not null default 'porto' check (at_place in ('porto', 'madrid', 'other')),
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint meetings_dates_ordered check (end_date is null or end_date >= start_date)
);

-- Se a tabela já existia sem estas colunas:
alter table public.meetings add column if not exists updated_by uuid references auth.users (id) on delete set null;
alter table public.meetings add column if not exists start_time time;

create index if not exists meetings_start_date_idx on public.meetings (start_date);

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

drop policy if exists "encontros: ler" on public.meetings;
drop policy if exists "encontros: criar" on public.meetings;
drop policy if exists "encontros: editar" on public.meetings;
drop policy if exists "encontros: apagar" on public.meetings;
create policy "encontros: ler" on public.meetings for select to authenticated using (true);
create policy "encontros: criar" on public.meetings for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "encontros: editar" on public.meetings for update to authenticated using (true) with check (true);
create policy "encontros: apagar" on public.meetings for delete to authenticated using (true);

-- Atualização em direto (só se ainda não estiver).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetings'
  ) then
    alter publication supabase_realtime add table public.meetings;
  end if;
end $$;

-- Regista as duas migrações como aplicadas, para um futuro `supabase db push` não tentar repeti-las.
insert into supabase_migrations.schema_migrations (version, name)
values ('20261115150000', 'meetings'), ('20261116150000', 'meeting_time')
on conflict (version) do nothing;
