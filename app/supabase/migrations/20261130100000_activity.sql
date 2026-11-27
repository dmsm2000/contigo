-- Novidades: o que cada um foi fazendo na app, para o outro ver quando volta. Quem escreve são os gatilhos (nunca a
-- app), por isso não há como registar uma coisa que não aconteceu. Cada um só vê o que o outro fez desde que leu.

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users (id) on delete set null,
  kind text not null check (char_length(kind) <= 40),
  trip_id uuid references public.trips (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on public.activity (created_at desc);
create index if not exists activity_trip_idx on public.activity (trip_id);

alter table public.activity enable row level security;
drop policy if exists "novidades: ler" on public.activity;
create policy "novidades: ler" on public.activity for select to authenticated using (true);
-- Sem políticas de escrita: só os gatilhos (security definer) escrevem.

-- A última vez que cada um abriu as novidades.
alter table public.profiles add column if not exists activity_read_at timestamptz not null default now();

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_kind text;
  v_trip uuid;
  v_data jsonb := '{}'::jsonb;
  v_actor uuid := coalesce(auth.uid(), (r->>'created_by')::uuid, (r->>'user_id')::uuid);
begin
  case tg_table_name
    when 'expenses' then
      if tg_op = 'INSERT' then
        v_kind := 'expense'; v_trip := (r->>'trip_id')::uuid;
        v_data := jsonb_build_object('amount', r->'amount_eur', 'category', r->>'category');
      end if;
    when 'onion_deposits' then
      if tg_op = 'INSERT' then
        v_kind := 'deposit'; v_data := jsonb_build_object('amount', r->'amount');
      end if;
    when 'meetings' then
      if tg_op = 'INSERT' then v_kind := 'meeting_added'; else v_kind := 'meeting_cancelled'; end if;
      if tg_op in ('INSERT', 'DELETE') then
        v_data := jsonb_build_object('start', r->>'start_date', 'end', r->>'end_date', 'place', r->>'at_place');
      else
        v_kind := null;
      end if;
    when 'trips' then
      if tg_op = 'INSERT' then
        v_trip := (r->>'id')::uuid;
        v_kind := case r->>'status' when 'planned' then 'trip_planned' when 'past' then 'trip_past' when 'drawn' then 'trip_drawn' else null end;
      elsif r->>'status' is distinct from o->>'status' then
        v_trip := (r->>'id')::uuid; v_kind := 'trip_status'; v_data := jsonb_build_object('status', r->>'status');
      elsif (r->>'dates_confirmed')::boolean and not coalesce((o->>'dates_confirmed')::boolean, false) then
        v_trip := (r->>'id')::uuid; v_kind := 'trip_dates';
        v_data := jsonb_build_object('start', r->>'start_date', 'end', r->>'end_date');
      end if;
    when 'trip_stays' then
      v_trip := (r->>'trip_id')::uuid; v_data := jsonb_build_object('name', r->>'name');
      if tg_op = 'INSERT' then v_kind := 'stay_added';
      elsif (r->>'chosen')::boolean and not coalesce((o->>'chosen')::boolean, false) then v_kind := 'stay_chosen'; end if;
    when 'trip_legs' then
      v_trip := (r->>'trip_id')::uuid;
      v_data := jsonb_build_object('mode', r->>'mode', 'direction', r->>'direction', 'origin', r->>'origin');
      if tg_op = 'INSERT' then v_kind := 'leg_added';
      elsif (r->>'chosen')::boolean and not coalesce((o->>'chosen')::boolean, false) then v_kind := 'leg_chosen'; end if;
    when 'trip_plan_approvals' then
      if tg_op = 'INSERT' then v_kind := 'plan_approved'; v_trip := (r->>'trip_id')::uuid; end if;
    when 'trip_itineraries' then
      v_trip := (r->>'trip_id')::uuid;
      if r->>'status' = 'accepted' and (tg_op = 'INSERT' or o->>'status' is distinct from 'accepted') then v_kind := 'itinerary_accepted';
      elsif tg_op = 'INSERT' and r->>'status' = 'draft' then v_kind := 'itinerary_draft'; end if;
    when 'trip_documents' then
      if tg_op = 'INSERT' then v_kind := 'doc_added'; v_trip := (r->>'trip_id')::uuid; v_data := jsonb_build_object('name', r->>'name'); end if;
    when 'trip_notes' then
      if tg_op = 'INSERT' then v_kind := 'note_added'; v_trip := (r->>'trip_id')::uuid; v_data := jsonb_build_object('body', left(r->>'body', 80)); end if;
    when 'trip_photos' then
      if tg_op = 'INSERT' then v_kind := 'photo_added'; v_trip := (r->>'trip_id')::uuid; end if;
    when 'place_wishes' then
      if tg_op = 'INSERT' then
        v_kind := 'wish_added';
        v_data := jsonb_build_object('name', (select name from public.places where id = (r->>'place_id')::uuid));
      end if;
    when 'ideas' then
      if tg_op = 'INSERT' then v_kind := 'idea_added'; v_data := jsonb_build_object('body', left(r->>'body', 80)); end if;
    else
      v_kind := null;
  end case;

  if v_kind is not null then
    insert into public.activity (actor, kind, trip_id, data) values (v_actor, v_kind, v_trip, v_data);
  end if;
  return null;
end;
$$;

drop trigger if exists activity_expenses on public.expenses;
create trigger activity_expenses after insert on public.expenses for each row execute function public.log_activity();
drop trigger if exists activity_deposits on public.onion_deposits;
create trigger activity_deposits after insert on public.onion_deposits for each row execute function public.log_activity();
drop trigger if exists activity_meetings on public.meetings;
create trigger activity_meetings after insert or delete on public.meetings for each row execute function public.log_activity();
drop trigger if exists activity_trips on public.trips;
create trigger activity_trips after insert or update on public.trips for each row execute function public.log_activity();
drop trigger if exists activity_stays on public.trip_stays;
create trigger activity_stays after insert or update on public.trip_stays for each row execute function public.log_activity();
drop trigger if exists activity_legs on public.trip_legs;
create trigger activity_legs after insert or update on public.trip_legs for each row execute function public.log_activity();
drop trigger if exists activity_approvals on public.trip_plan_approvals;
create trigger activity_approvals after insert on public.trip_plan_approvals for each row execute function public.log_activity();
drop trigger if exists activity_itineraries on public.trip_itineraries;
create trigger activity_itineraries after insert or update on public.trip_itineraries for each row execute function public.log_activity();
drop trigger if exists activity_documents on public.trip_documents;
create trigger activity_documents after insert on public.trip_documents for each row execute function public.log_activity();
drop trigger if exists activity_notes on public.trip_notes;
create trigger activity_notes after insert on public.trip_notes for each row execute function public.log_activity();
drop trigger if exists activity_photos on public.trip_photos;
create trigger activity_photos after insert on public.trip_photos for each row execute function public.log_activity();
drop trigger if exists activity_wishes on public.place_wishes;
create trigger activity_wishes after insert on public.place_wishes for each row execute function public.log_activity();
drop trigger if exists activity_ideas on public.ideas;
create trigger activity_ideas after insert on public.ideas for each row execute function public.log_activity();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity') then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
