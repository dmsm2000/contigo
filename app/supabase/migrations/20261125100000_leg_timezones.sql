-- Fuso horário (IANA, por exemplo 'Europe/Madrid') da partida e da chegada de uma deslocação (opcional).
alter table public.trip_legs add column if not exists from_tz text check (char_length(from_tz) <= 64);
alter table public.trip_legs add column if not exists to_tz text check (char_length(to_tz) <= 64);
