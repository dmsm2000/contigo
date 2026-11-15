import { SupabaseClient } from '@supabase/supabase-js';
import { PlaceCandidate } from './geocoder';
import { PlaceImageService } from './place-image.service';
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

/**
 * Guarda a imagem (já pronta) de um sítio: envia o ficheiro, regista o caminho, o crédito e quem a escolheu, e apaga a
 * anterior. Cada imagem tem um nome novo, para o telemóvel não mostrar a antiga em cache. Devolve se ficou guardada.
 */
export async function storePlaceImage(
  supabase: SupabaseClient,
  placeId: string,
  blob: Blob,
  credit: string | null,
  source: 'auto' | 'user',
): Promise<boolean> {
  try {
    const { data } = await supabase.from('places').select('image_path').eq('id', placeId).single<{ image_path: string | null }>();
    const path = `${placeId}-${Date.now()}.jpg`;
    const upload = await supabase.storage.from('place-images').upload(path, blob, { contentType: 'image/jpeg' });
    if (upload.error) {
      console.warn('Imagem do sítio: não foi possível guardar o ficheiro.', upload.error.message);
      return false;
    }
    const update = await supabase.from('places').update({ image_path: path, image_credit: credit, image_source: source }).eq('id', placeId);
    if (update.error) {
      await supabase.storage.from('place-images').remove([path]);
      return false;
    }
    if (data?.image_path && data.image_path !== path) await supabase.storage.from('place-images').remove([data.image_path]);
    return true;
  } catch (error) {
    console.warn('Imagem do sítio: falhou.', error);
    return false;
  }
}

/**
 * Guarda a imagem encontrada para o sítio, se o sítio ainda não tem uma (com `replace`, troca a automática; nunca troca
 * uma que alguém escolheu). Nunca falha: o sítio já está guardado, e uma imagem que não chega não deve estragar o registo.
 */
export async function attachPlaceImage(
  supabase: SupabaseClient,
  images: PlaceImageService,
  placeId: string,
  found: { url: string; credit: string | null } | null | undefined,
  options: { replace?: boolean } = {},
): Promise<boolean> {
  if (!found) return false;
  try {
    const { data } = await supabase.from('places').select('image_path, image_source').eq('id', placeId).single<{ image_path: string | null; image_source: string }>();
    if (!data) return false;
    if (data.image_path && (!options.replace || data.image_source === 'user')) return false;
    const blob = await images.download(found.url);
    if (!blob) {
      console.warn('Imagem do sítio: não foi possível descarregar a imagem.');
      return false;
    }
    return await storePlaceImage(supabase, placeId, blob, found.credit, 'auto');
  } catch (error) {
    console.warn('Imagem do sítio: falhou.', error);
    return false;
  }
}
