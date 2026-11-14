-- "Quem mexeu por último e quando": viagens, despesas e ideias passam a guardar o autor da última alteração.
-- Quem criou já está em created_by / user_id; aqui só se acrescenta o último a alterar, e o quando nas despesas.

alter table public.trips add column updated_by uuid references auth.users (id) on delete set null;
alter table public.ideas add column updated_by uuid references auth.users (id) on delete set null;
alter table public.expenses
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references auth.users (id) on delete set null;

-- Quem faz a alteração é sempre quem está autenticado: o cliente não consegue pôr o nome de outra pessoa.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.ideas_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Uma ideia não muda de autor.';
  end if;
  if new.body is distinct from old.body and old.user_id is distinct from auth.uid() then
    raise exception 'Só quem escreveu a ideia lhe pode mudar o texto.';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.expenses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id is distinct from old.trip_id or new.user_id is distinct from old.user_id then
    raise exception 'Uma despesa não muda de viagem nem de autor.';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;
