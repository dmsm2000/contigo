// Evitar o mesmo sítio duas vezes: lógica pura, sem Angular nem rede, para se testar facilmente.
import { normalize } from './country.logic';

export interface KnownPlace {
  name: string;
  osm_ref: string | null;
  lat: number | null;
  lng: number | null;
}

/** Mais ou menos 30 km: o mesmo sítio vem de fontes diferentes com coordenadas ligeiramente diferentes. */
const SAME_PLACE_DEGREES = 0.3;

/**
 * Dos sítios que já temos (do mesmo país), o que é o mesmo que o candidato: mesmo nome (sem acentos nem maiúsculas)
 * e perto. Serve para Braga do GeoNames e Braga do OpenStreetMap serem um sítio só.
 */
export function findSamePlace(
  candidate: { name: string; lat: number | null; lng: number | null },
  known: readonly KnownPlace[],
): KnownPlace | null {
  const name = normalize(candidate.name);
  for (const place of known) {
    if (normalize(place.name) !== name) continue;
    if (candidate.lat === null || candidate.lng === null || place.lat === null || place.lng === null) continue;
    if (Math.abs(place.lat - candidate.lat) <= SAME_PLACE_DEGREES && Math.abs(place.lng - candidate.lng) <= SAME_PLACE_DEGREES) return place;
  }
  return null;
}
