-- Documentos da viagem: post-its com informação importante e ficheiros (bilhetes, reservas, seguros…).
-- Os ficheiros ficam num bucket privado; só quem tem conta os vê, com links temporários.

create table public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 600),
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'green', 'blue', 'orange')),
  pinned boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_notes_trip_idx on public.trip_notes (trip_id, created_at);

create table public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  -- Apagar a viagem apaga estas linhas; os ficheiros apaga-os a app antes (a base de dados não chega ao storage).
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Onde está no bucket: "<viagem>/<documento>.<extensão>".
  path text not null unique check (char_length(path) between 1 and 200),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  mime text not null check (char_length(mime) <= 100),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index trip_documents_trip_idx on public.trip_documents (trip_id, created_at);

create trigger trip_notes_touch before update on public.trip_notes for each row execute function public.set_updated_at();
create trigger trip_documents_touch before update on public.trip_documents for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['trip_notes', 'trip_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: ler" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s: criar" on public.%1$I for insert to authenticated with check (created_by = (select auth.uid()))', t);
    execute format('create policy "%1$s: editar" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "%1$s: apagar" on public.%1$I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- O bucket dos ficheiros: privado, até 10 MB cada, só PDF e imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-documents', 'trip-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "documentos: ler" on storage.objects for select to authenticated
  using (bucket_id = 'trip-documents');
create policy "documentos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-documents');
create policy "documentos: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'trip-documents') with check (bucket_id = 'trip-documents');
create policy "documentos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-documents');

alter publication supabase_realtime add table public.trip_notes, public.trip_documents;
