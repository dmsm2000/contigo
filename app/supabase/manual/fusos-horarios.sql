-- Fusos horários da partida e da chegada. Seguro de correr mais de uma vez. Cola no Supabase > SQL Editor > Run.
alter table public.trip_legs add column if not exists from_tz text check (char_length(from_tz) <= 64);
alter table public.trip_legs add column if not exists to_tz text check (char_length(to_tz) <= 64);
insert into supabase_migrations.schema_migrations (version, name) values ('20261125100000', 'leg_timezones') on conflict (version) do nothing;
