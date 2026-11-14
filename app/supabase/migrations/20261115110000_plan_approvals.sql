-- Uma viagem só passa a "preparada" quando as 3 decisões estão tomadas (datas, alojamento e deslocação) e os dois as
-- aprovaram. Tudo o resto do plano pode ficar por preencher. A regra vive na base de dados para não haver forma de a
-- contornar; se alguém mexe numa das 3 decisões, as aprovações voltam a zero.

-- Deslocação escolhida: uma por origem (as outras da mesma origem são alternativas).
alter table public.trip_legs add column chosen boolean not null default false;
create unique index trip_legs_one_chosen_per_origin on public.trip_legs (trip_id, lower(btrim(origin))) where chosen;

-- A aprovação de cada pessoa ao conjunto das 3 decisões.
create table public.trip_plan_approvals (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trip_plan_approvals enable row level security;
create policy "aprovações: ler" on public.trip_plan_approvals for select to authenticated using (true);
-- Cada um só aprova (e retira a aprovação) por si.
create policy "aprovações: aprovar" on public.trip_plan_approvals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "aprovações: retirar" on public.trip_plan_approvals for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.trip_plan_approvals;

-- Mudar uma das 3 decisões apaga as aprovações (security definer: apaga também as do outro).
create function public.reset_plan_approvals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_table_name = 'trips' then
    target := new.id;
  else
    target := coalesce(new.trip_id, old.trip_id);
  end if;
  delete from public.trip_plan_approvals where trip_id = target;
  return coalesce(new, old);
end;
$$;

create trigger trips_reset_approvals after update of start_date, end_date, dates_confirmed on public.trips
  for each row
  when (old.start_date is distinct from new.start_date or old.end_date is distinct from new.end_date or old.dates_confirmed is distinct from new.dates_confirmed)
  execute function public.reset_plan_approvals();

create trigger trip_stays_reset_ins after insert on public.trip_stays for each row when (new.chosen) execute function public.reset_plan_approvals();
create trigger trip_stays_reset_upd after update on public.trip_stays for each row when (old.chosen or new.chosen) execute function public.reset_plan_approvals();
create trigger trip_stays_reset_del after delete on public.trip_stays for each row when (old.chosen) execute function public.reset_plan_approvals();

create trigger trip_legs_reset_ins after insert on public.trip_legs for each row when (new.chosen) execute function public.reset_plan_approvals();
create trigger trip_legs_reset_upd after update on public.trip_legs for each row when (old.chosen or new.chosen) execute function public.reset_plan_approvals();
create trigger trip_legs_reset_del after delete on public.trip_legs for each row when (old.chosen) execute function public.reset_plan_approvals();

-- A regra: de "a planear" para "preparada" (ou mais além) só com as 3 decisões tomadas e aprovadas pelos dois.
create function public.trips_guard_prepared()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  missing text[] := '{}';
begin
  if new.status in ('prepared', 'ongoing') and old.status in ('drawn', 'planned') then
    if not new.dates_confirmed then
      missing := array_append(missing, 'dates');
    end if;
    if not exists (select 1 from public.trip_stays where trip_id = new.id and chosen) then
      missing := array_append(missing, 'stay');
    end if;
    -- Pelo menos uma deslocação escolhida e, em cada origem que tem deslocações, uma escolhida.
    if not exists (select 1 from public.trip_legs where trip_id = new.id and chosen)
       or exists (
         select 1 from public.trip_legs l where l.trip_id = new.id
         group by lower(btrim(l.origin)) having not bool_or(l.chosen)
       ) then
      missing := array_append(missing, 'transport');
    end if;
    -- Os dois aprovam (se vai só um, aprova esse).
    if new.with_partner then
      if exists (
        select 1 from public.profiles p
        where not exists (select 1 from public.trip_plan_approvals a where a.trip_id = new.id and a.user_id = p.id)
      ) then
        missing := array_append(missing, 'approval');
      end if;
    elsif not exists (select 1 from public.trip_plan_approvals a where a.trip_id = new.id) then
      missing := array_append(missing, 'approval');
    end if;
    if array_length(missing, 1) > 0 then
      raise exception 'plan_not_ready: %', array_to_string(missing, ',');
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_guard_prepared before update of status on public.trips
  for each row execute function public.trips_guard_prepared();
