-- Depósitos na cebola: dinheiro que um dos dois mete de uma vez, além da dotação mensal. Soma-se ao mês em que foi feito.
create table if not exists public.onion_deposits (
  id uuid primary key default gen_random_uuid(),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  made_on date not null default current_date,
  note text check (char_length(note) <= 120),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index if not exists onion_deposits_made_on_idx on public.onion_deposits (made_on);

drop trigger if exists onion_deposits_touch on public.onion_deposits;
create trigger onion_deposits_touch before update on public.onion_deposits for each row execute function public.set_updated_at();

alter table public.onion_deposits enable row level security;
drop policy if exists "depósitos: ler" on public.onion_deposits;
drop policy if exists "depósitos: criar" on public.onion_deposits;
drop policy if exists "depósitos: editar" on public.onion_deposits;
drop policy if exists "depósitos: apagar" on public.onion_deposits;
create policy "depósitos: ler" on public.onion_deposits for select to authenticated using (true);
create policy "depósitos: criar" on public.onion_deposits for insert to authenticated with check (created_by = (select auth.uid()));
create policy "depósitos: editar" on public.onion_deposits for update to authenticated using (true) with check (true);
create policy "depósitos: apagar" on public.onion_deposits for delete to authenticated using (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'onion_deposits') then
    alter publication supabase_realtime add table public.onion_deposits;
  end if;
end $$;
