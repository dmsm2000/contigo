// Lógica pura da wishlist e da rotação do sorteio: sem Angular nem rede, para se testar facilmente.
import { LngLat } from './map.logic';
import { MinStay, Suggestion } from './suggestions';
import { initialOf, Place, PlaceRow, tileColors, toPlace } from './trips.logic';

export const HOME_PORTO: LngLat = [-8.611, 41.1496];
export const HOME_MADRID: LngLat = [-3.7038, 40.4168];

export interface WishRow {
  place_id: string;
  user_id: string;
  stars: number;
}

/** Um sítio com os desejos de cada um, como chega do Supabase. */
export interface WishlistRow extends PlaceRow {
  note: string | null;
  link: string | null;
  min_stay: MinStay | null;
  best_months: number[] | null;
  place_wishes: WishRow[];
}

export interface WishlistItem {
  place: Place;
  note: string | null;
  link: string | null;
  minStay: MinStay | null;
  /** Os meses (1 a 12) em que vale mais a pena ir; `null` enquanto não se preencheu. */
  bestMonths: number[] | null;
  /** As estrelas (1 a 3) que cada pessoa deu, pelo id da pessoa. */
  stars: Record<string, number>;
  /** A soma das estrelas dos dois: é o peso do sítio no sorteio. */
  total: number;
}

export function toWishlistItem(row: WishlistRow): WishlistItem {
  const stars: Record<string, number> = {};
  for (const wish of row.place_wishes) stars[wish.user_id] = wish.stars;
  return {
    place: toPlace(row),
    note: row.note,
    link: row.link,
    minStay: row.min_stay,
    bestMonths: row.best_months ?? null,
    stars,
    total: Object.values(stars).reduce((sum, value) => sum + value, 0),
  };
}

/** Os mais desejados primeiro; a igualdade desfaz-se pelo nome. */
export function sortWishlist(items: readonly WishlistItem[]): WishlistItem[] {
  return [...items].sort((a, b) => b.total - a.total || a.place.name.localeCompare(b.place.name, 'pt'));
}

/** Distância em linha reta entre dois pontos, em quilómetros (fórmula de Haversine). */
export function distanceKm(a: LngLat, b: LngLat): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export interface KnownPlace {
  name: string;
  lat: number | null;
  lng: number | null;
}

export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * As sugestões que ainda são novidade: fora as que já foram visitadas ou já estão na wishlist.
 * Conta como "o mesmo sítio" ter o mesmo nome ou estar a menos de `radiusKm`.
 */
export function freshSuggestions(
  catalogue: readonly Suggestion[],
  known: readonly KnownPlace[],
  radiusKm = 6,
): Suggestion[] {
  return catalogue.filter((suggestion) => {
    const name = normalize(suggestion.name);
    return !known.some((place) => {
      if (normalize(place.name) === name) return true;
      if (place.lat === null || place.lng === null) return false;
      return distanceKm([place.lng, place.lat], [suggestion.lng, suggestion.lat]) < radiusKm;
    });
  });
}

/** Uma opção da rotação do sorteio. */
export interface PoolEntry {
  /** `wish:<id do sítio>` ou `suggestion:<id da sugestão>`: é com isto que se lembram vetos. */
  id: string;
  kind: 'wishlist' | 'suggestion';
  name: string;
  /** Probabilidade de sair, de 0 a 1; todas as opções somam 1. */
  weight: number;
}

export interface PoolOptions {
  /** A fatia da probabilidade para as sugestões, de 0 a 1. Por defeito, 25%. */
  surpriseShare?: number;
  /** Desligar as sugestões: só entra a wishlist. */
  includeSuggestions?: boolean;
  /** Opções a deixar de fora (vetadas, ou que não cabem na janela). */
  exclude?: ReadonlySet<string>;
  /** Os sítios da wishlist por completar (ids de sítio): saem com menos peso, mas saem. */
  incomplete?: ReadonlySet<string>;
}

export const DEFAULT_SURPRISE_SHARE = 0.25;

/** Um sítio incompleto continua a poder sair, mas com metade do peso (sorteio "equilibrado"). */
export const INCOMPLETE_WEIGHT = 0.5;

/**
 * A rotação do sorteio: os sítios da wishlist (com mais peso os mais desejados) e as sugestões, cada fonte
 * com a sua fatia. A fatia das sugestões não encolhe nem cresce com o tamanho da wishlist: com 3 sítios ou com
 * 30, 25% das vezes sai uma surpresa.
 */
export function buildPool(
  wishlist: readonly WishlistItem[],
  suggestions: readonly Suggestion[],
  options: PoolOptions = {},
): PoolEntry[] {
  const exclude = options.exclude ?? new Set<string>();
  const wishes = wishlist.filter((item) => !exclude.has(`wish:${item.place.id}`));
  const surprises = options.includeSuggestions === false ? [] : suggestions.filter((item) => !exclude.has(`suggestion:${item.id}`));

  const requested = Math.min(1, Math.max(0, options.surpriseShare ?? DEFAULT_SURPRISE_SHARE));
  // Sem uma das fontes, a outra leva tudo.
  const surpriseShare = !surprises.length ? 0 : !wishes.length ? 1 : requested;
  const wishShare = 1 - surpriseShare;

  const incomplete = options.incomplete ?? new Set<string>();
  const weightOf = (item: WishlistItem) => Math.max(item.total, 1) * (incomplete.has(item.place.id) ? INCOMPLETE_WEIGHT : 1);
  const wishTotal = wishes.reduce((sum, item) => sum + weightOf(item), 0);
  const pool: PoolEntry[] = [];
  if (wishShare > 0) {
    for (const item of wishes) {
      pool.push({
        id: `wish:${item.place.id}`,
        kind: 'wishlist',
        name: item.place.name,
        weight: (wishShare * weightOf(item)) / wishTotal,
      });
    }
  }
  for (const item of surprises) {
    pool.push({ id: `suggestion:${item.id}`, kind: 'suggestion', name: item.name, weight: surpriseShare / surprises.length });
  }
  return pool;
}

/** Sorteia uma opção, segundo os pesos. `random` devolve um número em [0, 1): serve para testar. */
export function pick(pool: readonly PoolEntry[], random: () => number = Math.random): PoolEntry | null {
  if (!pool.length) return null;
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let target = random() * total;
  for (const entry of pool) {
    target -= entry.weight;
    if (target < 0) return entry;
  }
  return pool[pool.length - 1];
}

export const MIN_STAYS: readonly MinStay[] = ['day', 'weekend', 'long'];

/**
 * Prepara uma ligação escrita à mão: vazia → null; sem "https://" põe-se; só se aceita http(s) (nada de
 * "javascript:" ou semelhantes); tudo o resto → 'invalid'.
 */
export function normalizeLink(input: string): string | null | 'invalid' {
  const text = input.trim();
  if (!text) return null;
  const hasHttp = /^https?:\/\//i.test(text);
  if (!hasHttp && /^[a-z][a-z0-9+.-]*:/i.test(text)) return 'invalid';
  try {
    const url = new URL(hasHttp ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.') || url.href.length > 500) return 'invalid';
    return url.href;
  } catch {
    return 'invalid';
  }
}

/** O ponto de partida mais perto (Porto ou Madrid) e a distância em linha reta, arredondada a 5 km. */
export function nearestOrigin(point: LngLat): { origin: 'Porto' | 'Madrid'; km: number } {
  const toPorto = distanceKm(HOME_PORTO, point);
  const toMadrid = distanceKm(HOME_MADRID, point);
  const closer = toPorto <= toMadrid ? 'Porto' : 'Madrid';
  const km = Math.min(toPorto, toMadrid);
  return { origin: closer, km: Math.max(5, Math.round(km / 5) * 5) };
}

/** Um sítio por ir no mapa. */
export interface WishPin {
  placeId: string;
  name: string;
  initial: string;
  lng: number;
  lat: number;
  colors: { from: string; to: string };
}

/**
 * Os pins dos sítios por ir. Ficam de fora os que não têm coordenadas e os que já foram visitados
 * (esses já têm o seu pin, o dos sítios onde já fomos).
 */
export function wishPins(items: readonly WishlistItem[], visitedPlaceIds: ReadonlySet<string>): WishPin[] {
  const pins: WishPin[] = [];
  for (const { place } of items) {
    if (place.lat === null || place.lng === null || visitedPlaceIds.has(place.id)) continue;
    pins.push({
      placeId: place.id,
      name: place.name,
      initial: initialOf(place.name),
      lng: place.lng,
      lat: place.lat,
      colors: tileColors(place.name),
    });
  }
  return pins;
}

/** A vontade média dos que deram estrelas, de 1 a 3 (0 se ninguém deu). */
export function averageStars(item: WishlistItem): 0 | 1 | 2 | 3 {
  const voters = Object.keys(item.stars).length;
  if (!voters) return 0;
  return Math.min(3, Math.max(1, Math.round(item.total / voters))) as 1 | 2 | 3;
}
