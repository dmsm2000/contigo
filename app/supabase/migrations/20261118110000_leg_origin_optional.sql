-- A origem de uma deslocação passa a ser opcional: vazia quer dizer "para os dois".
alter table public.trip_legs drop constraint if exists trip_legs_origin_check;
alter table public.trip_legs add constraint trip_legs_origin_check check (char_length(btrim(origin)) <= 60);
