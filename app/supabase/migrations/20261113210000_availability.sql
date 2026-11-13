-- Disponibilidade: os tipos de turno de cada pessoa e os dias que marcou.
-- Os dois veem tudo (é assim que a app encontra as janelas em comum), mas cada um só mexe no que é seu.

create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- 'busy': não dá para viajar (trabalho, compromisso); 'free': dia livre (folga, férias).
  kind text not null check (kind in ('busy', 'free')),
  -- Horas locais de quem as marca (sem fuso). Ou há as duas, ou nenhuma.
  starts_at time,
  ends_at time,
  -- Só dá cor aos tipos 'busy': manhã, tarde ou intermédio. Os 'free' são sempre verdes.
  tone text not null default 'middle' check (tone in ('morning', 'afternoon', 'middle')),
  created_at timestamptz not null default now(),
  constraint shift_types_times_together check ((starts_at is null) = (ends_at is null)),
  -- Permite à marcação de um dia confirmar que o tipo é da mesma pessoa.
  constraint shift_types_id_user unique (id, user_id)
);

create index shift_types_user_idx on public.shift_types (user_id);

create table public.availability_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Data local, sem fuso: as janelas em comum calculam-se por dia.
  day date not null,
  shift_type_id uuid not null,
  primary key (user_id, day),
  -- Apagar um tipo apaga as marcações que o usam; a app avisa antes.
  foreign key (shift_type_id, user_id) references public.shift_types (id, user_id) on delete cascade
);

create index availability_days_day_idx on public.availability_days (day);

alter table public.shift_types enable row level security;
alter table public.availability_days enable row level security;

create policy "turnos: ler" on public.shift_types for select to authenticated using (true);
create policy "turnos: criar" on public.shift_types for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "turnos: editar" on public.shift_types for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "turnos: apagar" on public.shift_types for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "dias: ler" on public.availability_days for select to authenticated using (true);
create policy "dias: criar" on public.availability_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "dias: editar" on public.availability_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dias: apagar" on public.availability_days for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.shift_types, public.availability_days;
