-- A última vez que cada um abriu a app, para o outro ver em "Nós".
-- É a base de dados que escreve a hora (não o telemóvel), e cada um só regista a sua.

alter table public.profiles add column last_seen_at timestamptz;

create function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
