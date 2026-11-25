-- Liga um documento a uma deslocação (o bilhete do comboio, por exemplo). Seguro de correr mais de uma vez.
-- Cola no Supabase > SQL Editor > Run.
alter table public.trip_documents add column if not exists leg_id uuid references public.trip_legs (id) on delete set null;
create index if not exists trip_documents_leg_idx on public.trip_documents (leg_id);
insert into supabase_migrations.schema_migrations (version, name) values ('20261126100000', 'doc_leg') on conflict (version) do nothing;
