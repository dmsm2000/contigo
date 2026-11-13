import { Injectable } from '@angular/core';

export interface PlaceCandidate {
  /** Identificador do OpenStreetMap (R4115866, N123…). Nulo quando o nome foi escrito à mão. */
  osmRef: string | null;
  name: string;
  admin1: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
}

// A pesquisa devolve de tudo (paragens de comboio, ruas, lojas). Só interessa o que é destino de uma visita.
const WANTED_KEYS = new Set(['place', 'tourism', 'natural', 'historic', 'leisure', 'landuse', 'man_made']);
const WANTED_AMENITIES = new Set(['place_of_worship', 'theatre', 'arts_centre', 'marketplace', 'fountain', 'university']);
const UNWANTED_PLACES = new Set(['country', 'state', 'region', 'province', 'county', 'municipality', 'continent']);

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const asText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

export function mapPhoton(json: unknown, limit = 6): PlaceCandidate[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];

  const seen = new Set<string>();
  const candidates: PlaceCandidate[] = [];

  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const properties = feature.properties ?? {};
    const key = asText(properties['osm_key']);
    const value = asText(properties['osm_value']);
    const name = asText(properties['name']);
    const coordinates = feature.geometry?.coordinates;
    if (!name || !key || !value || !Array.isArray(coordinates)) continue;

    const wanted =
      (key === 'amenity' && WANTED_AMENITIES.has(value)) ||
      (WANTED_KEYS.has(key) && !(key === 'place' && UNWANTED_PLACES.has(value)));
    if (!wanted) continue;

    const [lng, lat] = coordinates as number[];
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const type = asText(properties['osm_type']);
    const id = properties['osm_id'];
    const osmRef = type && /^[NWR]$/.test(type) && typeof id === 'number' ? `${type}${id}` : null;
    const countryCode = asText(properties['countrycode'])?.toUpperCase() ?? null;
    const admin1 = asText(properties['county']) ?? asText(properties['state']);

    // O mesmo sítio aparece várias vezes (nó, relação, outro tipo…) e fica igual no ecrã. Fica o primeiro,
    // que é o mais relevante para a pesquisa.
    const dedupe = `${name.toLowerCase()}|${admin1?.toLowerCase() ?? ''}|${countryCode}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    candidates.push({
      osmRef,
      name,
      admin1,
      countryCode,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
    if (candidates.length === limit) break;
  }
  return candidates;
}

/** Pesquisa de sítios no Photon (dados do OpenStreetMap). Serviço público e gratuito, sem chave. */
@Injectable({ providedIn: 'root' })
export class GeocoderService {
  async search(query: string, signal?: AbortSignal): Promise<PlaceCandidate[]> {
    const text = query.trim();
    if (text.length < 2) return [];

    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', text);
    url.searchParams.set('limit', '15');
    // Dá preferência ao que está perto do Porto, onde começam quase todas as viagens.
    url.searchParams.set('lat', '41.15');
    url.searchParams.set('lon', '-8.61');

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`A pesquisa de sítios respondeu ${response.status}`);
    return mapPhoton(await response.json());
  }
}
