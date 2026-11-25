-- Um documento (um bilhete, por exemplo) pode ficar ligado a uma deslocação. Se a deslocação sair, o documento fica, solto.
alter table public.trip_documents add column if not exists leg_id uuid references public.trip_legs (id) on delete set null;
create index if not exists trip_documents_leg_idx on public.trip_documents (leg_id);
