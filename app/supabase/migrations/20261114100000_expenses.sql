-- Despesas das viagens e a dotação mensal de cada um (a cebola calcula-se a partir destas duas coisas).
-- A cebola não se guarda: é só um registo (dotações acumuladas menos gastos), por isso nunca fica desalinhada.

-- A dotação mensal de cada um, em euros. Por defeito 200€; cada um muda a sua (a política de "profiles" já o permite).
alter table public.profiles
  add column monthly_allowance numeric(8, 2) not null default 200 check (monthly_allowance between 0 and 100000);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  -- Apagar a viagem apaga as despesas dela.
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  amount_eur numeric(10, 2) not null check (amount_eur > 0 and amount_eur <= 100000),
  category text not null default 'other' check (category in ('transport', 'stay', 'food', 'activities', 'other')),
  note text check (char_length(note) <= 200),
  -- O dia em que se gastou (por defeito, hoje).
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index expenses_trip_idx on public.expenses (trip_id, spent_on);

-- A viagem e o autor não mudam; o resto (valor, categoria, nota, dia) corrige-se.
create function public.expenses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id is distinct from old.trip_id or new.user_id is distinct from old.user_id then
    raise exception 'Uma despesa não muda de viagem nem de autor.';
  end if;
  return new;
end;
$$;

create trigger expenses_guard
  before update on public.expenses
  for each row execute function public.expenses_guard();

alter table public.expenses enable row level security;

create policy "despesas: ler" on public.expenses for select to authenticated using (true);
create policy "despesas: criar" on public.expenses for insert to authenticated
  with check (user_id = (select auth.uid()));
-- São contas dos dois: qualquer um corrige ou apaga uma despesa.
create policy "despesas: editar" on public.expenses for update to authenticated using (true) with check (true);
create policy "despesas: apagar" on public.expenses for delete to authenticated using (true);

alter publication supabase_realtime add table public.expenses;
