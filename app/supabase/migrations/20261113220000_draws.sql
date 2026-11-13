-- Sorteio do mês: de onde saiu a viagem sorteada e os vetos.

-- "wish:<id do sítio>" ou "suggestion:<id da sugestão>": é com isto que o veto exclui a opção do resto do mês.
alter table public.trips
  add column draw_entry text check (char_length(draw_entry) between 1 and 80);

-- Cada pessoa tem um veto por mês: a chave (pessoa, mês) garante-o na própria base de dados.
-- Não há "editar" nem "apagar": um veto usado não se desfaz.
create table public.draw_vetoes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- O primeiro dia do mês em que se usou o veto.
  month date not null check (extract(day from month) = 1),
  entry_id text not null check (char_length(entry_id) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.draw_vetoes enable row level security;

create policy "vetos: ler" on public.draw_vetoes for select to authenticated using (true);
create policy "vetos: criar" on public.draw_vetoes for insert to authenticated
  with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.draw_vetoes;
