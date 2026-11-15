import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { compressImage } from './image-compress';
import { CommonsFile, ImageCandidate, isWikimediaUrl, pickCommons, pickImage, pickWikidataImage, WikidataItem, WikiPage, creditOf } from './place-image.logic';
import { Lang } from './trips.logic';

/** O endereço público da imagem de um sítio guardada no bucket "place-images". */
export function placeImageUrl(path: string | null | undefined): string | null {
  return path ? `${environment.supabaseUrl}/storage/v1/object/public/place-images/${path}` : null;
}

/** O que a pesquisa devolve para um sítio: o endereço da imagem e de quem é a foto. */
export interface FoundImage {
  url: string;
  credit: string | null;
}

/** Uma pausa entre pedidos seguidos: o Wikimedia recusa quem pede demasiado depressa (erro 429). */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Procura imagens de um sítio. Primeiro a imagem principal da Wikidata (a que quem a edita escolheu para representar o
 * sítio); depois o Wikimedia Commons (fotografias grandes, de preferência as marcadas como "imagens de qualidade"); a
 * Wikipédia fica de reserva, para o que as outras não têm. Serviços públicos e gratuitos,
 * sem chave. Com `candidates` mostram-se várias, para a pessoa escolher; com `find` fica a melhor.
 */
@Injectable({ providedIn: 'root' })
export class PlaceImageService {
  async find(place: { name: string; lat: number | null; lng: number | null; countryCode?: string | null }, lang: Lang, signal?: AbortSignal): Promise<FoundImage | null> {
    const [first] = await this.candidates(place, lang, signal, 1);
    return first ? { url: first.url, credit: first.credit } : null;
  }

  async candidates(
    place: { name: string; lat: number | null; lng: number | null; countryCode?: string | null },
    lang: Lang,
    signal?: AbortSignal,
    limit = 8,
  ): Promise<ImageCandidate[]> {
    const country = place.countryCode ? (new Intl.DisplayNames(['en'], { type: 'region' }).of(place.countryCode) ?? '') : '';
    const query = `${place.name} ${country}`.trim();
    let list: ImageCandidate[] = [];
    try {
      const main = await this.wikidataMain(place, lang, signal);
      if (main) list.push(main);
    } catch {
      if (signal?.aborted) return [];
    }
    if (list.length >= limit) return list;
    if (list.length) await sleep(300);
    try {
      list = [...list, ...pickCommons(await this.commons(query, 'incategory:"Quality images"', signal), place, 'quality', limit)];
      if (list.length < limit) {
        if (list.length) await sleep(400);
        const more = pickCommons(await this.commons(query, '', signal), place, 'commons', limit);
        const titles = new Set(list.map((item) => item.title));
        list = [...list, ...more.filter((item) => !titles.has(item.title))];
      }
      list = list.slice(0, limit);
    } catch {
      if (signal?.aborted) return [];
      // O Commons não respondeu: segue para a Wikipédia.
    }
    if (list.length) return list;

    const languages = lang === 'en' ? ['en'] : [lang, 'en'];
    for (const wiki of languages) {
      try {
        const url = pickImage(await this.search(place.name, wiki, signal), place);
        if (url) return [{ url, title: place.name, credit: 'Foto: Wikipédia', source: 'wikipedia' }];
      } catch {
        if (signal?.aborted) return [];
      }
    }
    return [];
  }

  /** A imagem principal (P18) do item da Wikidata que é este sítio, com o crédito vindo do Commons. */
  private async wikidataMain(place: { name: string; lat: number | null; lng: number | null }, lang: Lang, signal?: AbortSignal): Promise<ImageCandidate | null> {
    if (place.lat === null || place.lng === null) return null;
    const base = 'https://www.wikidata.org/w/api.php';
    const search = new URL(base);
    for (const [key, value] of Object.entries({ action: 'wbsearchentities', format: 'json', origin: '*', search: place.name, language: lang, type: 'item', limit: '7' })) search.searchParams.set(key, value);
    const found = (await (await fetch(search, { signal })).json())?.search as { id: string }[] | undefined;
    const ids = (found ?? []).map((item) => item.id);
    if (!ids.length) return null;
    const entities = new URL(base);
    for (const [key, value] of Object.entries({ action: 'wbgetentities', format: 'json', origin: '*', ids: ids.join('|'), props: 'claims|labels', languages: `${lang}|en` })) entities.searchParams.set(key, value);
    const data = (await (await fetch(entities, { signal })).json())?.entities as Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>; labels?: Record<string, { value: string }> }> | undefined;
    if (!data) return null;
    const items: WikidataItem[] = ids.map((id) => {
      const entity = data[id];
      const coords = entity?.claims?.['P625']?.[0]?.mainsnak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
      const image = entity?.claims?.['P18']?.[0]?.mainsnak?.datavalue?.value;
      return {
        label: entity?.labels?.[lang]?.value ?? entity?.labels?.['en']?.value ?? null,
        lat: coords?.latitude ?? null,
        lng: coords?.longitude ?? null,
        image: typeof image === 'string' ? image : null,
      };
    });
    const file = pickWikidataImage(items, place);
    if (!file) return null;
    // O endereço da miniatura e o autor vêm do Commons (e confirma-se que é uma imagem grande o bastante).
    const info = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [key, value] of Object.entries({ action: 'query', format: 'json', origin: '*', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1000' })) info.searchParams.set(key, value);
    const pages = (await (await fetch(info, { signal })).json())?.query?.pages as Record<string, { imageinfo?: Record<string, unknown>[] }> | undefined;
    const meta = Object.values(pages ?? {})[0]?.imageinfo?.[0] as { thumburl?: string; width?: number; extmetadata?: Record<string, { value?: string }> } | undefined;
    if (!meta?.thumburl || !isWikimediaUrl(meta.thumburl) || (meta.width ?? 0) < 1000) return null;
    return { url: meta.thumburl, title: file, credit: creditOf(meta.extmetadata?.['Artist']?.value ?? null, meta.extmetadata?.['LicenseShortName']?.value ?? null), source: 'wikidata' };
  }

  private async commons(query: string, filter: string, signal?: AbortSignal): Promise<CommonsFile[]> {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', `${query} ${filter}`.trim());
    url.searchParams.set('gsrnamespace', '6');
    url.searchParams.set('gsrlimit', '30');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|size|mime|extmetadata');
    url.searchParams.set('iiurlwidth', '1000');
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`O Commons respondeu ${response.status}`);
    const pages = (await response.json())?.query?.pages as Record<string, { title: string; index?: number; imageinfo?: Record<string, unknown>[] }> | undefined;
    if (!pages) return [];
    const files: CommonsFile[] = [];
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0] as { mime?: string; width?: number; height?: number; thumburl?: string; extmetadata?: Record<string, { value?: string }> } | undefined;
      if (!info?.thumburl) continue;
      files.push({
        title: page.title,
        index: page.index ?? 99,
        mime: info.mime ?? '',
        width: info.width ?? 0,
        height: info.height ?? 0,
        thumbUrl: info.thumburl,
        artist: info.extmetadata?.['Artist']?.value ?? null,
        license: info.extmetadata?.['LicenseShortName']?.value ?? null,
      });
    }
    return files;
  }

  private async search(name: string, wiki: string, signal?: AbortSignal): Promise<WikiPage[]> {
    const url = new URL(`https://${wiki}.wikipedia.org/w/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', name);
    url.searchParams.set('gsrlimit', '8');
    url.searchParams.set('prop', 'pageimages|coordinates');
    url.searchParams.set('piprop', 'thumbnail');
    url.searchParams.set('pithumbsize', '1000');
    url.searchParams.set('colimit', 'max');
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`A Wikipédia respondeu ${response.status}`);
    const pages = (await response.json())?.query?.pages as Record<string, WikiPage> | undefined;
    return pages ? Object.values(pages) : [];
  }

  /** Descarrega a imagem, reduz-a e devolve o ficheiro pronto a guardar. Nulo se não for possível. */
  async download(imageUrl: string): Promise<Blob | null> {
    if (!isWikimediaUrl(imageUrl)) return null;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null;
      const { full } = await compressImage(new File([blob], 'sitio.jpg', { type: blob.type }));
      return full;
    } catch {
      return null;
    }
  }
}
