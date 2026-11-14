-- Onde mora cada um: o mapa põe a foto de perfil na casa certa (Porto ou Madrid).
alter table public.profiles
  add column home text check (home in ('porto', 'madrid'));
