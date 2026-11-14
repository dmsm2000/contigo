-- A pesquisa de sítios passou a usar também o GeoNames (via Open-Meteo): o identificador do sítio pode ser "G123",
-- além do do OpenStreetMap (N, W ou R + número). Os sítios que já existem não mudam.
alter table public.places drop constraint places_osm_ref_check;
alter table public.places add constraint places_osm_ref_check check (osm_ref ~ '^[NWRG][0-9]+$');
