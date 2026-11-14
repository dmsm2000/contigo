import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { compressImage } from './image-compress';
import { isWikimediaUrl, pickImage, WikiPage } from './place-image.logic';
import { Lang } from './trips.logic';

/** O endereço público da imagem de um sítio guardada no bucket "place-images". */
export function placeImageUrl(path: string | null | undefined): string | null {
  return path ? `${environment.supabaseUrl}/storage/v1/object/public/place-images/${path}` : null;
}

/**
 * Procura uma imagem do sítio na Wikipédia (que usa as fotos do Wikimedia Commons): primeiro na língua da app, depois em
 * inglês. Serviço público e gratuito, sem chave. Devolve o endereço da imagem, ou nulo se não houver uma boa.
 */
@Injectable({ providedIn: 'root' })
export class PlaceImageService {
  async find(place: { name: string; lat: number | null; lng: number | null }, lang: Lang, signal?: AbortSignal): Promise<string | null> {
    const languages = lang === 'en' ? ['en'] : [lang, 'en'];
    for (const wiki of languages) {
      try {
        const url = pickImage(await this.search(place.name, wiki, signal), place);
        if (url) return url;
      } catch {
        if (signal?.aborted) return null;
        // Uma Wikipédia que não responde não impede de tentar a seguinte.
      }
    }
    return null;
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
