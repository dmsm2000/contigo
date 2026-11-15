import { inject, Injectable, signal } from '@angular/core';
import { LanguageService } from './language.service';
import { PlaceImageService } from './place-image.service';
import { attachPlaceImage } from './places.service';
import { SupabaseService } from './supabase.service';
import { TripsService } from './trips.service';
import { WishlistService } from './wishlist.service';

interface MissingPlace {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
}

/** Uma pausa entre sítios, para não sobrecarregar a Wikipédia (é um serviço gratuito). */
const PAUSE_MS = 1200;

/**
 * Procura imagens para os sítios que já existiam antes de a app as guardar. Corre quando alguém pede (nas Definições)
 * e pode repetir-se: só trata dos sítios que ainda não têm imagem.
 */
@Injectable({ providedIn: 'root' })
export class PlaceImageBackfillService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly images = inject(PlaceImageService);
  private readonly language = inject(LanguageService).language;
  private readonly trips = inject(TripsService);
  private readonly wishlist = inject(WishlistService);

  /** Quantos sítios ainda não têm imagem (nulo enquanto não se contou). */
  readonly missing = signal<number | null>(null);
  readonly running = signal(false);
  readonly progress = signal<{ done: number; total: number; found: number } | null>(null);

  /** Quantos sítios têm uma imagem automática (que se pode refazer; as escolhidas por nós não). */
  readonly automatic = signal<number | null>(null);

  async count(): Promise<void> {
    const [missing, auto] = await Promise.all([
      this.supabase.from('places').select('id', { count: 'exact', head: true }).is('image_path', null),
      this.supabase.from('places').select('id', { count: 'exact', head: true }).not('image_path', 'is', null).eq('image_source', 'auto'),
    ]);
    this.missing.set(missing.count ?? 0);
    this.automatic.set(auto.count ?? 0);
  }

  /** Procura imagens para os sítios sem imagem; com `redo`, refaz também as automáticas (nunca as escolhidas à mão). */
  async run(redo = false): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    try {
      const query = this.supabase.from('places').select('id, name, lat, lng, country_code');
      const { data } = await (redo ? query.eq('image_source', 'auto') : query.is('image_path', null)).returns<MissingPlace[]>();
      const places = data ?? [];
      this.progress.set({ done: 0, total: places.length, found: 0 });
      for (const place of places) {
        const found = await this.images.find({ ...place, countryCode: place.country_code }, this.language());
        const saved = found ? await attachPlaceImage(this.supabase, this.images, place.id, found, { replace: redo }) : false;
        this.progress.update((state) => (state ? { ...state, done: state.done + 1, found: state.found + (saved ? 1 : 0) } : state));
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    } finally {
      this.running.set(false);
      await Promise.all([this.trips.load(), this.wishlist.load(), this.count()]);
    }
  }
}
