-- Lista de ideias: coisas que um dos dois quer deixar escrita (para a app ou para as viagens).
-- Os dois leem tudo e qualquer um muda o estado; o texto só o muda quem o escreveu.

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  -- open: por ver; planned: vamos fazer; done: feita.
  status text not null default 'open' check (status in ('open', 'planned', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_created_idx on public.ideas (created_at desc);

-- Quem não escreveu a ideia só lhe pode mudar o estado.
create function public.ideas_guard()
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
  return new;
end;
$$;

create trigger ideas_guard
  before update on public.ideas
  for each row execute function public.ideas_guard();

alter table public.ideas enable row level security;

create policy "ideias: ler" on public.ideas for select to authenticated using (true);
create policy "ideias: criar" on public.ideas for insert to authenticated
  with check (user_id = (select auth.uid()));
-- O estado muda-o qualquer um; o texto é protegido pelo gatilho acima.
create policy "ideias: editar" on public.ideas for update to authenticated using (true) with check (true);
create policy "ideias: apagar" on public.ideas for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.ideas;
