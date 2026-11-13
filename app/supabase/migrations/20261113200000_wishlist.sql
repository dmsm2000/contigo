-- Lista de sítios por ir (wishlist).
-- Um sítio está na wishlist quando alguém lhe deu estrelas. Cada pessoa dá as suas (1 a 3).

alter table public.places
  add column note text check (char_length(note) <= 500),
  add column link text check (link ~ '^https?://' and char_length(link) <= 500),
  -- Quanto tempo vale a pena: um dia, um fim-de-semana ou mais.
  add column min_stay text check (min_stay in ('day', 'weekend', 'long'));

create table public.place_wishes (
  -- restrict: um sítio com desejos não se apaga (nem quando se apaga a última viagem).
  place_id uuid not null references public.places (id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create index place_wishes_user_idx on public.place_wishes (user_id);

alter table public.place_wishes enable row level security;

-- Os dois veem as estrelas um do outro, mas cada um só mexe nas suas.
create policy "wishes: ler" on public.place_wishes for select to authenticated using (true);
create policy "wishes: criar" on public.place_wishes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "wishes: editar" on public.place_wishes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "wishes: apagar" on public.place_wishes for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.place_wishes;
