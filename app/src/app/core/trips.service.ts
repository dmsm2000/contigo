import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { PlaceCandidate } from './geocoder';
import { PhotosService } from './photos.service';
import { SupabaseService } from './supabase.service';
import { isDone, startDateFor, toTrip, Trip, TripRow, WouldReturn } from './trips.logic';

export interface PastTripInput {
  place: PlaceCandidate;
  year: number;
  month: number;
  withPartner: boolean;
  wouldReturn: WouldReturn | null;
  costEur: number | null;
  note: string | null;
}

const TRIP_SELECT = '*, place:places(*)';

/** As viagens dos dois. Atualizam-se sozinhas quando o outro regista ou apaga alguma. */
@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly photos = inject(PhotosService);
  private channel: RealtimeChannel | null = null;

  /** Todas as viagens, também as sorteadas que ainda não aconteceram. */
  readonly trips = signal<Trip[]>([]);
  /** Só as que já aconteceram: são as memórias, os sítios visitados e os pins do mapa. */
  readonly done = computed(() => this.trips().filter(isDone));
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.trips.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  async load(): Promise<void> {
    const { data, error } = await this.supabase
      .from('trips')
      .select(TRIP_SELECT)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<TripRow[]>();
    if (error || !data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.trips.set(data.map(toTrip));
    this.loaded.set(true);
  }

  find(id: string): Trip | undefined {
    return this.trips().find((trip) => trip.id === id);
  }

  async addPastTrip(input: PastTripInput): Promise<void> {
    const placeId = await this.savePlace(input.place);
    const { error } = await this.supabase.from('trips').insert({
      place_id: placeId,
      status: 'past',
      start_date: startDateFor(input.year, input.month),
      date_precision: 'month',
      with_partner: input.withPartner,
      would_return: input.wouldReturn,
      cost_eur: input.costEur,
      note: input.note,
    });
    if (error) throw error;
    await this.load();
  }

  async remove(trip: Trip): Promise<void> {
    // Os registos das fotos saem com a viagem, mas os ficheiros no bucket têm de ser apagados antes.
    await this.photos.removeFilesOfTrip(trip.id).catch(() => undefined);
    const { error } = await this.supabase.from('trips').delete().eq('id', trip.id);
    if (error) throw error;
    // O sítio só sai se já não tiver mais viagens; se tiver, a base de dados recusa e ele fica.
    await this.supabase.from('places').delete().eq('id', trip.placeId);
    await this.load();
  }

  private async savePlace(place: PlaceCandidate): Promise<string> {
    const row = {
      name: place.name,
      admin1: place.admin1,
      country_code: place.countryCode,
      lat: place.lat,
      lng: place.lng,
      osm_ref: place.osmRef,
    };
    // Um sítio do OpenStreetMap só existe uma vez, por mais viagens que lá tenhamos feito.
    const query = place.osmRef
      ? this.supabase.from('places').upsert(row, { onConflict: 'osm_ref' })
      : this.supabase.from('places').insert(row);
    const { data, error } = await query.select('id').single<{ id: string }>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o sítio.');
    return data.id;
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    this.channel = this.supabase
      .channel('contigo-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, reload)
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
