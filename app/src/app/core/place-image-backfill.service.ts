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
}

/** Uma pausa entre sítios, para não sobrecarregar a Wikipédia (é um serviço gratuito). */
const PAUSE_MS = 250;

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

  async count(): Promise<void> {
    const { count } = await this.supabase.from('places').select('id', { count: 'exact', head: true }).is('image_path', null);
    this.missing.set(count ?? 0);
  }

  async run(): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    try {
      const { data } = await this.supabase.from('places').select('id, name, lat, lng').is('image_path', null).returns<MissingPlace[]>();
      const places = data ?? [];
      this.progress.set({ done: 0, total: places.length, found: 0 });
      for (const place of places) {
        const url = await this.images.find(place, this.language());
        const saved = url ? await attachPlaceImage(this.supabase, this.images, place.id, url) : false;
        this.progress.update((state) => (state ? { ...state, done: state.done + 1, found: state.found + (saved ? 1 : 0) } : state));
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    } finally {
      this.running.set(false);
      await Promise.all([this.trips.load(), this.wishlist.load(), this.count()]);
    }
  }
}
