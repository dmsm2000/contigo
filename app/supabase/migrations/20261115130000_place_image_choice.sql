-- Imagens dos sítios: quem as escolheu e de quem é a foto.
-- A imagem pode vir da pesquisa automática ("auto") ou ser escolhida/enviada por um de nós ("user"); a automática pode
-- refazer-se, a escolhida não. Cada troca usa um ficheiro novo ("<id do sítio>-<número>.jpg"), para o telemóvel não
-- mostrar a imagem antiga em cache.

alter table public.places
  add column image_source text not null default 'auto' check (image_source in ('auto', 'user')),
  add column image_credit text check (char_length(image_credit) <= 200);

drop policy "place-images: enviar" on storage.objects;
drop policy "place-images: trocar" on storage.objects;

create policy "place-images: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-images' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-[0-9]{1,13})?\.jpg$');
create policy "place-images: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'place-images')
  with check (bucket_id = 'place-images' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-[0-9]{1,13})?\.jpg$');
