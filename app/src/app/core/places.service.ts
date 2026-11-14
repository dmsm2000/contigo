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
 * Guarda a imagem do sítio, se o sítio ainda não tem uma e se a pesquisa encontrou uma. Nunca falha: o sítio já está
 * guardado, e uma imagem que não chega não deve estragar o registo (volta a tentar-se da próxima vez).
 */
export async function attachPlaceImage(supabase: SupabaseClient, images: PlaceImageService, placeId: string, imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl) return false;
  try {
    const { data } = await supabase.from('places').select('image_path').eq('id', placeId).single<{ image_path: string | null }>();
    if (!data || data.image_path) return false;
    const blob = await images.download(imageUrl);
    if (!blob) {
      console.warn('Imagem do sítio: não foi possível descarregar a imagem.');
      return false;
    }
    const path = `${placeId}.jpg`;
    const upload = await supabase.storage.from('place-images').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (upload.error) {
      console.warn('Imagem do sítio: não foi possível guardar o ficheiro.', upload.error.message);
      return false;
    }
    await supabase.from('places').update({ image_path: path }).eq('id', placeId);
    return true;
  } catch (error) {
    console.warn('Imagem do sítio: falhou.', error);
    // Sem imagem, o sítio continua a ter as suas cores.
    return false;
  }
}
