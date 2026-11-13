-- Perfis das duas pessoas da Contigo.
-- O registo público está desligado (config.toml), por isso só existem as contas criadas por convite.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  language text not null default 'pt' check (language in ('pt', 'es', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Os dois veem os perfis um do outro.
create policy "profiles are visible to signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- Cada um só altera o seu.
create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Cria o perfil automaticamente quando uma conta é criada.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
