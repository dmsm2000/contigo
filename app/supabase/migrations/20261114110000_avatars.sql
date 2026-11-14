-- Foto de perfil: um bucket privado (um ficheiro por pessoa, numa pasta com o id dela) e o caminho no perfil.

alter table public.profiles
  add column avatar_path text check (char_length(avatar_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Os dois veem as fotos um do outro; cada um só mexe na sua pasta ("<id da pessoa>/...").
create policy "avatars: ler" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
