import { SupabaseClient } from '@supabase/supabase-js';
import { PlaceCandidate } from './geocoder';
import { findSamePlace, KnownPlace } from './places.logic';

/** Se o sítio já existe (de outra fonte de pesquisa), usa o que já temos, para não haver Braga duas vezes. */
export async function reuseKnownPlace(supabase: SupabaseClient, place: PlaceCandidate): Promise<PlaceCandidate> {
  if (!place.countryCode || place.lat === null) return place;
  const { data } = await supabase
    .from('places')
    .select('name, osm_ref, lat, lng')
    .eq('country_code', place.countryCode)
    .returns<KnownPlace[]>();
  const same = findSamePlace(place, data ?? []);
  return same?.osm_ref ? { ...place, osmRef: same.osm_ref } : place;
}
