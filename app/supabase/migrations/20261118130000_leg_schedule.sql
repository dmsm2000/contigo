-- Dia e horas da deslocação (opcionais): saída e chegada.
alter table public.trip_legs add column if not exists departs_on date;
alter table public.trip_legs add column if not exists departs_time time;
alter table public.trip_legs add column if not exists arrives_time time;
