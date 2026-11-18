-- Ida e volta no "Como chegar". Seguro de correr mais de uma vez. Cola no Supabase > SQL Editor > Run.
alter table public.trip_legs add column if not exists direction text not null default 'out' check (direction in ('out', 'back'));
drop index if exists public.trip_legs_one_chosen_per_origin;
create unique index if not exists trip_legs_one_chosen_per_origin_direction on public.trip_legs (trip_id, lower(btrim(origin)), direction) where chosen;

create or replace function public.trips_guard_prepared()
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
    -- Pelo menos uma deslocação escolhida e, em cada origem e sentido que têm deslocações, uma escolhida.
    if not exists (select 1 from public.trip_legs where trip_id = new.id and chosen)
       or exists (
         select 1 from public.trip_legs l where l.trip_id = new.id
         group by lower(btrim(l.origin)), l.direction having not bool_or(l.chosen)
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

insert into supabase_migrations.schema_migrations (version, name) values ('20261118120000', 'leg_direction') on conflict (version) do nothing;
