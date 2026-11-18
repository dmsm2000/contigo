-- A origem de "Como chegar" passa a ser opcional. Seguro de correr mais de uma vez. Cola no Supabase > SQL Editor > Run.
alter table public.trip_legs drop constraint if exists trip_legs_origin_check;
alter table public.trip_legs add constraint trip_legs_origin_check check (char_length(btrim(origin)) <= 60);
insert into supabase_migrations.schema_migrations (version, name) values ('20261118110000', 'leg_origin_optional') on conflict (version) do nothing;
