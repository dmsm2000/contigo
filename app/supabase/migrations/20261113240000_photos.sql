-- Fotos das viagens: um bucket privado (as imagens) e uma tabela (de que viagem são, a legenda, o tamanho).
-- Guardam-se só versões otimizadas (cerca de 1600 px) e uma miniatura; os originais ficam no telemóvel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Os dois partilham tudo: quem tem conta lê, envia, troca e apaga as fotos das viagens. Quem não entrou não vê nada.
create policy "fotos: ler" on storage.objects for select to authenticated
  using (bucket_id = 'trip-photos');
create policy "fotos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-photos');
create policy "fotos: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'trip-photos') with check (bucket_id = 'trip-photos');
create policy "fotos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-photos');

create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  -- Apagar a viagem apaga estas linhas; os ficheiros apaga-os a app antes (a base de dados não chega ao storage).
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  -- Onde estão no bucket: "<viagem>/<foto>.jpg" e a miniatura "<viagem>/<foto>_t.jpg".
  path text not null unique check (char_length(path) between 1 and 200),
  thumb_path text not null unique check (char_length(thumb_path) between 1 and 200),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now()
);

create index trip_photos_trip_idx on public.trip_photos (trip_id, created_at);

alter table public.trip_photos enable row level security;

create policy "fotos da viagem: ler" on public.trip_photos for select to authenticated using (true);
create policy "fotos da viagem: criar" on public.trip_photos for insert to authenticated
  with check (user_id = (select auth.uid()));
-- A legenda muda-a qualquer um; o resto não se muda (ver o gatilho).
create policy "fotos da viagem: editar" on public.trip_photos for update to authenticated using (true) with check (true);
create policy "fotos da viagem: apagar" on public.trip_photos for delete to authenticated using (true);

-- Só a legenda se pode mudar: a viagem, o autor e os ficheiros ficam como foram enviados.
create function public.trip_photos_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id is distinct from old.trip_id
    or new.user_id is distinct from old.user_id
    or new.path is distinct from old.path
    or new.thumb_path is distinct from old.thumb_path
    or new.width is distinct from old.width
    or new.height is distinct from old.height then
    raise exception 'Numa foto só se pode mudar a legenda.';
  end if;
  return new;
end;
$$;

create trigger trip_photos_guard
  before update on public.trip_photos
  for each row execute function public.trip_photos_guard();

alter publication supabase_realtime add table public.trip_photos;
