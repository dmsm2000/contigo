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
export function looksLikeEmblem(url: string): boolean {
  const name = decodeURIComponent(url)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return /flag_of|bandera|bandeira|drapeau|coat_of_arms|escudo|brasao|blason|emblem|\blogo\b|_logo|seal_of|sello|locator|location_map|localizacion|ubicacion|situacion|_map\b|\bmap_|mapa|provincia_|distrito_|\.svg(\.|\/|$)/i.test(name);
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
    withImage.find((page) => title(page) === name && place.lat === null) ??
    withImage.find((page) => near(page) && title(page).includes(name));
  return best?.thumbnail?.source ?? null;
}

// ---------------------------------------------------------------- Wikimedia Commons

/** Um ficheiro devolvido pela pesquisa do Wikimedia Commons (só o que interessa). */
export interface CommonsFile {
  title: string;
  /** Posição na pesquisa (1 é o mais relevante). */
  index: number;
  mime: string;
  width: number;
  height: number;
  /** A miniatura de 1000 px de largura. */
  thumbUrl: string;
  /** O autor (pode vir com HTML) e a licença, se se sabem. */
  artist: string | null;
  license: string | null;
}

/** Uma imagem que se pode usar para um sítio, com a fonte e o crédito. */
export interface ImageCandidate {
  url: string;
  title: string;
  credit: string | null;
  source: 'wikidata' | 'quality' | 'commons' | 'wikipedia';
}

/** Fotografias que não mostram o sítio: carros de ralis, animais, portas, retratos, cartazes… */
const NOT_A_VIEW = /azulejo|\btiles?\b|paint|pintura|retabl|altar|statue|estatua|sculpt|escultura|portal\b|portico|capital\b|column|detail|detalhe|ceiling|interior|inside|stained|mosaic|fresco|relief|gargoyle|tomb|grave|rally|\bcars?\b|\bbus\b|locomotive|macaw|\bbirds?\b|pernilongo|insect|butterfl|flower|\bplant|\bdog\b|\bcat\b|knocker|\bdoors?\b|window|portrait|people|crowd|festival|concert|football|futebol|\bmatch\b|poster|stamp|diagram|\bplan of|\bmap\b/i;

/** As palavras do nome que têm de aparecer no título do ficheiro ("San Lorenzo de El Escorial" → san, lorenzo). */
export function nameWords(name: string): string[] {
  return normalize(name)
    .replace(/[-–]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !['del', 'las', 'los', 'dos', 'das', 'the'].includes(word))
    .slice(0, 2);
}

/** "Foto: Autor · CC BY-SA 4.0 · Wikimedia Commons": o autor limpo de HTML. */
export function creditOf(artist: string | null, license: string | null): string | null {
  const author = (artist ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const parts = [author ? `Foto: ${author.slice(0, 80)}` : 'Foto', license, 'Wikimedia Commons'].filter(Boolean);
  return parts.join(' · ').slice(0, 200);
}

/**
 * Das fotografias do Commons, as boas para um sítio: JPEG, grandes (as de "qualidade" desde 1600 px, as outras desde
 * 2000), na horizontal (como um postal), com o nome do sítio no título (para não ser o castelo de uma vila ao lado) e
 * sem bandeiras, mapas nem brasões.
 */
export function pickCommons(files: readonly CommonsFile[], place: { name: string }, kind: 'quality' | 'commons', limit = 8): ImageCandidate[] {
  const words = nameWords(place.name);
  const minWidth = kind === 'quality' ? 1600 : 2000;
  const seen = new Set<string>();
  const out: ImageCandidate[] = [];
  for (const file of [...files].sort((a, b) => a.index - b.index)) {
    if (file.mime !== 'image/jpeg' || file.width < minWidth) continue;
    const ratio = file.width / Math.max(1, file.height);
    if (ratio < 1.3 || ratio > 2.2) continue;
    const title = normalize(file.title.replace(/^file:/i, ''));
    if (words.length && !words.every((word) => title.includes(word))) continue;
    if (!isWikimediaUrl(file.thumbUrl) || looksLikeEmblem(file.title) || looksLikeEmblem(file.thumbUrl) || NOT_A_VIEW.test(title)) continue;
    // Séries do mesmo autor ("Salamanca - BC 03", "- BC 04") não enchem a lista: uma de cada.
    const stem = title.replace(/[\s_-]*\(?\d+\)?\.jpe?g$/, '').replace(/[\s_-]*\d+$/, '');
    if (seen.has(stem)) continue;
    seen.add(stem);
    out.push({ url: file.thumbUrl, title: file.title.replace(/^File:/i, ''), credit: creditOf(file.artist, file.license), source: kind === 'quality' ? 'quality' : 'commons' });
    if (out.length === limit) break;
  }
  return out;
}

// ---------------------------------------------------------------- Wikidata

/** Os dados de um item da Wikidata que interessam para escolher a imagem principal. */
export interface WikidataItem {
  label: string | null;
  /** Coordenadas do item (P625). */
  lat: number | null;
  lng: number | null;
  /** A imagem principal (P18): o nome do ficheiro no Commons. */
  image: string | null;
}

/** A que distância (km) do sítio escolhido pode estar o item da Wikidata para ser o mesmo sítio. */
const WIKIDATA_NEAR_KM = 30;

/**
 * A imagem principal (P18) do item da Wikidata que é este sítio: o primeiro (a pesquisa já os ordena) com o mesmo nome e
 * coordenadas perto, e que tenha imagem. É a fotografia que quem edita a Wikidata escolheu para representar o sítio.
 */
export function pickWikidataImage(items: readonly WikidataItem[], place: { name: string; lat: number | null; lng: number | null }): string | null {
  const name = normalize(place.name);
  for (const item of items) {
    if (!item.image || item.lat === null || item.lng === null || place.lat === null || place.lng === null) continue;
    if (!item.label || normalize(item.label) !== name) continue;
    if (distanceKm([place.lng, place.lat], [item.lng, item.lat]) > WIKIDATA_NEAR_KM) continue;
    if (!/\.(jpe?g|png|webp)$/i.test(item.image)) continue;
    return item.image;
  }
  return null;
}
