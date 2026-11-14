// Escolher a imagem de um sítio entre os resultados da Wikipédia: lógica pura, sem Angular nem rede.
import { normalize } from './country.logic';
import { distanceKm } from './wishlist.logic';

export interface WikiPage {
  title: string;
  /** Posição na pesquisa (1 é o mais relevante). */
  index?: number;
  thumbnail?: { source?: string };
  coordinates?: { lat: number; lon: number }[];
}

/** A que distância (km) do sítio escolhido pode estar o artigo para ser o mesmo sítio. */
const NEAR_KM = 30;

/** Aceita só endereços do Wikimedia (https), para nunca ir buscar uma imagem a outro lado. */
export function isWikimediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /(^|\.)wikimedia\.org$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** Bandeiras, brasões, mapas e logótipos não são fotos do sítio. */
function looksLikeEmblem(url: string): boolean {
  return /flag_of|coat_of_arms|\blogo\b|_logo|escudo|brasao|bandeira|locator|location_map|map_of|\.svg(\.|\/|$)/i.test(decodeURIComponent(url));
}

/**
 * Dos artigos que a pesquisa devolveu, a foto do que é mesmo o sítio: o artigo com coordenadas perto do sítio
 * escolhido e um nome parecido; sem coordenadas, o artigo cujo título é o nome. Nunca uma bandeira nem um mapa.
 */
export function pickImage(
  pages: readonly WikiPage[],
  place: { name: string; lat: number | null; lng: number | null },
): string | null {
  const name = normalize(place.name);
  const withImage = [...pages]
    .filter((page) => page.thumbnail?.source && isWikimediaUrl(page.thumbnail.source) && !looksLikeEmblem(page.thumbnail.source))
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  const near = (page: WikiPage): boolean => {
    if (place.lat === null || place.lng === null) return false;
    return (page.coordinates ?? []).some((c) => distanceKm([place.lng as number, place.lat as number], [c.lon, c.lat]) <= NEAR_KM);
  };
  const title = (page: WikiPage) => normalize(page.title.replace(/\s*\(.*\)\s*$/, ''));

  // 1.º o artigo com o nome do sítio, perto dele; 2.º o artigo com o nome (se não há coordenadas); 3.º um artigo perto cujo nome contém o do sítio.
  const best =
    withImage.find((page) => title(page) === name && near(page)) ??
    withImage.find((page) => title(page) === name && (place.lat === null || !(page.coordinates ?? []).length)) ??
    withImage.find((page) => near(page) && title(page).includes(name));
  return best?.thumbnail?.source ?? null;
}
