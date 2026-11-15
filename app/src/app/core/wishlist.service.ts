import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { PlaceCandidate } from './geocoder';
import { PlaceImageService } from './place-image.service';
import { ProfileService } from './profile.service';
import { attachPlaceImage, reuseKnownPlace } from './places.service';
import { SupabaseService } from './supabase.service';
import { MinStay, Suggestion, SUGGESTIONS } from './suggestions';
import { TripsService } from './trips.service';
import { incompleteIds, WishMissing, wishMissing } from './wish-readiness.logic';
import { freshSuggestions, sortWishlist, toWishlistItem, WishlistItem, WishlistRow } from './wishlist.logic';
import { readStored, writeStored } from './storage';

export type Stars = 1 | 2 | 3;

export interface WishInput {
  stars: Stars;
  note: string | null;
  link: string | null;
  minStay: MinStay | null;
  bestMonths?: number[] | null;
}

const SURPRISES_KEY = 'contigo.surprises';

/** A lista de sítios por ir. Atualiza-se sozinha quando o outro mexe nela. */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly placeImages = inject(PlaceImageService);
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly trips = inject(TripsService);
  private readonly profile = inject(ProfileService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<WishlistItem[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  /** Do mais desejado para o menos. */
  readonly sorted = computed(() => sortWishlist(this.items()));

  /** Quem vai (eu e a outra pessoa): serve para ver o que falta preencher em cada sítio. */
  readonly readinessUserIds = computed(() => [this.auth.userId(), this.profile.partner()?.id].filter((id): id is string => !!id));
  /** Os sítios a que ainda falta algo para estarem prontos para o sorteio. */
  readonly incompleteIds = computed(() => incompleteIds(this.items(), this.readinessUserIds()));
  readonly incompleteCount = computed(() => this.incompleteIds().size);

  missingOf(item: WishlistItem): WishMissing[] {
    return wishMissing(item, this.readinessUserIds());
  }

  /** As sugestões ainda novidade: sem os sítios já visitados nem os que já estão na lista. */
  readonly suggestions = computed<Suggestion[]>(() => {
    const known = [...this.trips.trips().map((trip) => trip.place), ...this.items().map((item) => item.place)];
    return freshSuggestions(SUGGESTIONS, known);
  });

  /** Se as sugestões entram no sorteio. Guarda-se neste dispositivo; o sorteio lê-o daqui. */
  readonly includeSuggestions = signal(readStored(SURPRISES_KEY, ['on', 'off'] as const, 'on') === 'on');

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.items.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  setIncludeSuggestions(include: boolean): void {
    this.includeSuggestions.set(include);
    writeStored(SURPRISES_KEY, include ? 'on' : 'off');
  }

  /** As estrelas que eu dei a um sítio (0 se ainda não dei). */
  myStars(item: WishlistItem): number {
    const userId = this.auth.userId();
    return (userId && item.stars[userId]) || 0;
  }

  async load(): Promise<void> {
    // `!inner` só traz os sítios que têm pelo menos um desejo.
    const { data, error } = await this.supabase
      .from('places')
      .select('*, place_wishes!inner(*)')
      .returns<WishlistRow[]>();
    if (error || !data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.items.set(data.map(toWishlistItem));
    this.loaded.set(true);
  }

  async add(candidate: PlaceCandidate, input: WishInput): Promise<void> {
    const place = await reuseKnownPlace(this.supabase, candidate);
    const row: Record<string, unknown> = {
      name: place.name,
      admin1: place.admin1,
      country_code: place.countryCode,
      lat: place.lat,
      lng: place.lng,
      osm_ref: place.osmRef,
    };
    // Só se escrevem os campos preenchidos, para não apagar o que o sítio já tinha (por exemplo, se já foram lá).
    if (input.note) row['note'] = input.note;
    if (input.link) row['link'] = input.link;
    if (input.minStay) row['min_stay'] = input.minStay;
    if (input.bestMonths?.length) row['best_months'] = input.bestMonths;

    const query = place.osmRef
      ? this.supabase.from('places').upsert(row, { onConflict: 'osm_ref' })
      : this.supabase.from('places').insert(row);
    const { data, error } = await query.select('id').single<{ id: string }>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o sítio.');
    await attachPlaceImage(this.supabase, this.placeImages, data.id, place.imageUrl ? { url: place.imageUrl, credit: place.imageCredit ?? null } : null);
    await this.writeStars(data.id, input.stars);
    await this.load();
  }

  /** Junta à lista um sítio que já existe (por exemplo, o de uma sugestão sorteada). */
  async addExisting(placeId: string, stars: Stars = 2): Promise<void> {
    await this.writeStars(placeId, stars);
    await this.load();
  }

  async setMyStars(item: WishlistItem, stars: Stars): Promise<void> {
    await this.writeStars(item.place.id, stars);
    await this.load();
  }

  /** Preenche o que faltava num sítio (duração, altura ideal, localização). Só se mudam os campos dados. */
  async completePlace(placeId: string, fields: { minStay?: MinStay; bestMonths?: number[]; lat?: number; lng?: number }): Promise<void> {
    const row: Record<string, unknown> = {};
    if (fields.minStay !== undefined) row['min_stay'] = fields.minStay;
    if (fields.bestMonths !== undefined) row['best_months'] = fields.bestMonths;
    if (fields.lat !== undefined && fields.lng !== undefined) {
      row['lat'] = fields.lat;
      row['lng'] = fields.lng;
    }
    if (!Object.keys(row).length) return;
    const { error } = await this.supabase.from('places').update(row).eq('id', placeId);
    if (error) throw error;
    await this.load();
  }

  /** Tira as minhas estrelas. O sítio só sai da lista quando já ninguém lhe dá estrelas. */
  async removeMine(item: WishlistItem): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const { error } = await this.supabase.from('place_wishes').delete().eq('place_id', item.place.id).eq('user_id', userId);
    if (error) throw error;
    const othersLeft = Object.keys(item.stars).some((id) => id !== userId);
    if (!othersLeft) {
      // Se o sítio tiver viagens, a base de dados recusa apagá-lo e ele fica (nas memórias).
      await this.supabase.from('places').delete().eq('id', item.place.id);
    }
    await this.load();
  }

  private async writeStars(placeId: string, stars: Stars): Promise<void> {
    const { error } = await this.supabase
      .from('place_wishes')
      .upsert({ place_id: placeId, stars }, { onConflict: 'place_id,user_id' });
    if (error) throw error;
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    this.channel = this.supabase
      .channel('contigo-wishlist')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'place_wishes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, reload)
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
