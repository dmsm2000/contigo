-- Imagem do sítio: quando se escolhe um sítio na pesquisa, a app vai buscar uma foto dele (Wikipédia/Wikimedia Commons),
-- reduz-a e guarda-a. É uma foto pública de um lugar, por isso o bucket é público (os links não precisam de assinatura
-- e a imagem guarda-se em cache). Quem escreve são os dois, e só ficheiros com o id do sítio no nome.

alter table public.places
  add column image_path text check (char_length(image_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "place-images: ler" on storage.objects for select to authenticated
  using (bucket_id = 'place-images');
create policy "place-images: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$');
create policy "place-images: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'place-images') with check (bucket_id = 'place-images' and name ~ '^[0-9a-f-]{36}\.jpg$');
create policy "place-images: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'place-images');
