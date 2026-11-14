import { Injectable } from '@angular/core';
import { CAPITALS, normalize, parseSearch } from './country.logic';
import { Lang } from './trips.logic';

export interface PlaceCandidate {
  /** Identificador do sítio: do OpenStreetMap (R4115866, N123…) ou do GeoNames (G3117735). Nulo quando o nome foi escrito à mão. */
  osmRef: string | null;
  name: string;
  admin1: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  /** Só para ordenar e mostrar os resultados: não se guarda. */
  capital?: boolean;
  population?: number;
  /** A imagem encontrada para o sítio (endereço do Wikimedia). Só para guardar; não faz parte do sítio. */
  imageUrl?: string | null;
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

interface MeteoResult {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  admin1?: string;
  feature_code?: string;
  population?: number;
}

/** Os tipos de sítio do GeoNames que servem de destino: povoações, ilhas, montanhas, parques, praias, regiões… */
const METEO_WANTED = /^(PPL|ISL|MT|PK|PRK|RES|BCH|CAPE|LK|FLLS|VLC|DSRT|RGN|ADM1|CSTL|MNMT|HSTS|TMPL|CLF|FJD|BAY|GLCR|CAVE|SPA)/;

/** A importância de um tipo de sítio do GeoNames: capital, sede de concelho ou distrito, povoação, outros e, no fim, bairros. */
export function meteoRank(code: string): number {
  if (code === 'PPLC') return 0;
  if (/^PPLA/.test(code) || code === 'PPLG') return 1;
  if (code === 'PPL') return 2;
  if (/^PPL[XL]$/.test(code) || code === 'PPLH' || code === 'PPLW') return 4;
  return 3;
}

/**
 * Converte a resposta do Open-Meteo (nomes do GeoNames em várias línguas). O código do GeoNames fica como "G123".
 * Os resultados vêm primeiro por quão bem o nome bate com o que se escreveu, depois a capital, depois a população.
 */
export function mapMeteo(json: unknown, typed: string, limit = 8): PlaceCandidate[] {
  const results = (json as { results?: MeteoResult[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const wanted = normalize(typed);
  const candidates: PlaceCandidate[] = [];
  const codes = new Map<PlaceCandidate, string>();
  const seen = new Set<string>();
  for (const item of results) {
    const name = asText(item?.name);
    if (!name || typeof item.latitude !== 'number' || typeof item.longitude !== 'number') continue;
    const code = item.feature_code ?? '';
    if (!METEO_WANTED.test(code)) continue;
    const countryCode = asText(item.country_code)?.toUpperCase() ?? null;
    const admin1 = asText(item.admin1);
    const key = `${normalize(name)}|${normalize(admin1 ?? '')}|${countryCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const candidate: PlaceCandidate = {
      osmRef: typeof item.id === 'number' ? `G${item.id}` : null,
      name,
      admin1,
      countryCode,
      lat: Math.round(item.latitude * 1e6) / 1e6,
      lng: Math.round(item.longitude * 1e6) / 1e6,
      capital: code === 'PPLC',
      population: typeof item.population === 'number' ? item.population : 0,
    };
    codes.set(candidate, code);
    candidates.push(candidate);
  }
  const score = (c: PlaceCandidate) => (normalize(c.name) === wanted ? 0 : normalize(c.name).startsWith(wanted) ? 1 : 2);
  // A cidade antes de um bairro com o mesmo nome (a Salamanca de Castela e Leão antes da Salamanca de Madrid).
  const kind = (c: PlaceCandidate) => meteoRank(codes.get(c) ?? '');
  candidates.sort((a, b) => score(a) - score(b) || kind(a) - kind(b) || (b.population ?? 0) - (a.population ?? 0));
  return candidates.slice(0, limit);
}

/** Junta as listas sem repetir o mesmo sítio (mesmo nome e país): fica a primeira, que é a mais relevante. */
export function mergeCandidates(lists: readonly PlaceCandidate[][], limit = 8): PlaceCandidate[] {
  const seen = new Set<string>();
  const merged: PlaceCandidate[] = [];
  for (const list of lists) {
    for (const candidate of list) {
      const key = `${normalize(candidate.name)}|${candidate.countryCode ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
    }
  }
  return merged.slice(0, limit);
}

/**
 * Pesquisa de sítios. A principal é a do Open-Meteo (GeoNames): percebe os nomes em português, espanhol e inglês
 * ("Munique", "Sevilha") e deixa escrever o país ("Madrid, Espanha"); escrevendo só o país, a capital vem primeiro.
 * O Photon (OpenStreetMap) completa com sítios mais pequenos (um miradouro, uma serra). Serviços públicos, sem chave.
 */
@Injectable({ providedIn: 'root' })
export class GeocoderService {
  async search(query: string, lang: Lang, signal?: AbortSignal): Promise<PlaceCandidate[]> {
    const text = query.trim();
    if (text.length < 2) return [];
    const parsed = parseSearch(text);

    const jobs: Promise<PlaceCandidate[]>[] = [];
    // Com só o país escrito, procura-se a capital e, à parte, um sítio com esse nome (Granada é uma cidade antes de ser um país).
    if (parsed.countryOnly && parsed.countryCode) {
      const capital = CAPITALS[parsed.countryCode];
      jobs.push(capital ? this.meteo(capital, lang, parsed.countryCode, signal).then((list) => list.filter((c) => c.capital).slice(0, 1)) : Promise.resolve([]));
      jobs.push(this.meteo(parsed.city, lang, null, signal));
    } else {
      jobs.push(this.meteo(parsed.city, lang, parsed.countryCode, signal));
    }
    // Escrevendo só o país não vale a pena ir ao OpenStreetMap: só traria ruído.
    if (parsed.city.length >= 3 && !parsed.countryOnly) jobs.push(this.photon(parsed.city, parsed.countryCode, signal));

    const settled = await Promise.allSettled(jobs);
    if (settled.every((job) => job.status === 'rejected')) throw new Error('A pesquisa de sítios não respondeu.');
    const lists = settled.map((job) => (job.status === 'fulfilled' ? job.value : []));

    if (parsed.countryOnly) {
      // [capital, sítio com o nome, extras]: se o sítio com o nome for maior do que a capital, vem primeiro.
      const [capital, named, ...extras] = lists;
      // Só conta como "um sítio com esse nome" se for uma povoação a sério: não há de ser a Espanha de Pernambuco.
      const city = named?.find((candidate) => (candidate.population ?? 0) >= 20_000);
      const first = city && (city.population ?? 0) > (capital?.[0]?.population ?? 0) ? [city, ...(capital ?? [])] : [...(capital ?? []), ...(city ? [city] : [])];
      return mergeCandidates([first, ...extras]);
    }
    return mergeCandidates(lists);
  }

  private async meteo(name: string, lang: Lang, countryCode: string | null, signal?: AbortSignal): Promise<PlaceCandidate[]> {
    if (name.trim().length < 2) return [];
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name.trim());
    url.searchParams.set('count', '12');
    url.searchParams.set('language', lang);
    url.searchParams.set('format', 'json');
    if (countryCode) url.searchParams.set('countryCode', countryCode);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`A pesquisa de sítios respondeu ${response.status}`);
    return mapMeteo(await response.json(), name);
  }

  private async photon(text: string, countryCode: string | null, signal?: AbortSignal): Promise<PlaceCandidate[]> {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', text);
    url.searchParams.set('limit', '15');
    // Dá preferência ao que está perto do Porto, onde começam quase todas as viagens.
    url.searchParams.set('lat', '41.15');
    url.searchParams.set('lon', '-8.61');
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`A pesquisa de sítios respondeu ${response.status}`);
    const found = mapPhoton(await response.json());
    return countryCode ? found.filter((candidate) => candidate.countryCode === countryCode) : found;
  }
}
