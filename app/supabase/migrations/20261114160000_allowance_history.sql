-- Histórico das dotações mensais: cada um muda a sua quando quiser, e os meses que já passaram mantêm o que valia na altura.
-- Uma linha por pessoa e por mês em que a dotação mudou; a dotação de um mês é a da linha mais recente até esse mês.
-- Quem escreve é só o gatilho: ninguém mexe no histórico à mão.

create table public.allowance_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- O mês a partir do qual vale ("2026-11"). "2000-01" quer dizer "desde sempre" (a dotação inicial).
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount numeric(8, 2) not null check (amount between 0 and 100000),
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.allowance_history enable row level security;

-- Os dois veem as dotações um do outro (já veem os perfis).
create policy "dotações: ler" on public.allowance_history for select to authenticated using (true);

-- A dotação que já existe passa a ser o ponto de partida: vale desde sempre, até à primeira mudança.
insert into public.allowance_history (user_id, month, amount)
select id, '2000-01', monthly_allowance from public.profiles;

create function public.record_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.allowance_history (user_id, month, amount)
    values (new.id, '2000-01', new.monthly_allowance)
    on conflict (user_id, month) do nothing;
  elsif new.monthly_allowance is distinct from old.monthly_allowance then
    -- Vale a partir do mês de hoje; mudar duas vezes no mesmo mês fica com o último valor.
    insert into public.allowance_history (user_id, month, amount)
    values (new.id, to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM'), new.monthly_allowance)
    on conflict (user_id, month) do update set amount = excluded.amount;
  end if;
  return new;
end;
$$;

create trigger profiles_record_allowance
  after insert or update of monthly_allowance on public.profiles
  for each row execute function public.record_allowance();
