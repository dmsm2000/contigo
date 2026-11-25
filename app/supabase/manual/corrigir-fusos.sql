-- Põe os fusos horários nas deslocações que já existem (só as que ainda não têm). Seguro de correr mais de uma vez.
-- Pressupõe o fusos-horarios.sql já corrido. Cola no Supabase > SQL Editor > Run.
-- A origem lê-se do texto ("Porto" → Lisboa, "Madrid" → Madrid) e o destino do sítio da viagem. Se tiveres outras
-- origens ou destinos, acrescenta uma linha às duas listas de baixo.

with origem(nome, tz) as (
  values ('porto', 'Europe/Lisbon'), ('lisboa', 'Europe/Lisbon'), ('madrid', 'Europe/Madrid')
), destino(nome, tz) as (
  values ('salamanca', 'Europe/Madrid'), ('madrid', 'Europe/Madrid'), ('porto', 'Europe/Lisbon')
), alvo as (
  select l.id, l.direction, o.tz as tz_origem, d.tz as tz_destino
  from public.trip_legs l
  join public.trips t on t.id = l.trip_id
  join public.places p on p.id = t.place_id
  join origem o on o.nome = lower(btrim(l.origin))
  join destino d on d.nome = lower(btrim(p.name))
  where l.from_tz is null and l.to_tz is null
)
update public.trip_legs l
set from_tz = case when a.direction = 'out' then a.tz_origem else a.tz_destino end,
    to_tz   = case when a.direction = 'out' then a.tz_destino else a.tz_origem end
from alvo a
where l.id = a.id;
