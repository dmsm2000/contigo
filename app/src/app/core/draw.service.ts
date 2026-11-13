import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FreeWindow, todayIso } from './availability.logic';
import { AuthService } from './auth.service';
import { expandVetoes, monthKey, tripDatesFor } from './draw.logic';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';
import { SUGGESTIONS } from './suggestions';
import { isUpcoming, Trip } from './trips.logic';
import { TripsService } from './trips.service';
import { PoolEntry } from './wishlist.logic';
import { WishlistService } from './wishlist.service';

interface VetoRow {
  user_id: string;
  month: string;
  entry_id: string;
}

/** O sorteio do mês: guarda a viagem sorteada e os vetos (um por pessoa e por mês). */
@Injectable({ providedIn: 'root' })
export class DrawService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly trips = inject(TripsService);
  private readonly wishlist = inject(WishlistService);
  private channel: RealtimeChannel | null = null;

  private readonly vetoes = signal<VetoRow[]>([]);
  readonly loaded = signal(false);

  private readonly month = computed(() => monthKey(todayIso()));
  private readonly thisMonth = computed(() => this.vetoes().filter((veto) => veto.month === this.month()));

  /** As opções vetadas este mês (por qualquer um dos dois): ficam fora do sorteio até ao mês que vem. */
  readonly vetoedEntries = computed(() =>
    expandVetoes(new Set(this.thisMonth().map((veto) => veto.entry_id)), this.wishlist.items(), SUGGESTIONS),
  );
  readonly myVetoUsed = computed(() => this.thisMonth().some((veto) => veto.user_id === this.auth.userId()));
  readonly partnerVetoUsed = computed(() => {
    const partner = this.profile.partner()?.id;
    return partner !== undefined && this.thisMonth().some((veto) => veto.user_id === partner);
  });

  /** A viagem sorteada que ainda não aconteceu, se houver. Enquanto existir, não se sorteia outra. */
  readonly active = computed<Trip | null>(
    () => this.trips.trips().find((trip) => trip.status === 'drawn' && isUpcoming(trip, todayIso())) ?? null,
  );

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId) {
          void this.load();
          this.listen();
        } else {
          this.stopListening();
          this.vetoes.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  async load(): Promise<void> {
    const { data, error } = await this.supabase.from('draw_vetoes').select('*').returns<VetoRow[]>();
    if (error || !data) return;
    this.vetoes.set(data);
    this.loaded.set(true);
  }

  /** Guarda o resultado como uma viagem "sorteada" e devolve-a. Os dois veem-na logo no Início. */
  async saveDraw(entry: PoolEntry, window: Pick<FreeWindow, 'start' | 'end'> | null): Promise<Trip> {
    const placeId = await this.placeFor(entry);
    const dates = tripDatesFor(window, todayIso());
    const { data, error } = await this.supabase
      .from('trips')
      .insert({
        place_id: placeId,
        status: 'drawn',
        start_date: dates.start,
        end_date: dates.end,
        date_precision: dates.precision,
        with_partner: true,
        draw_entry: entry.id,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o sorteio.');
    await this.trips.load();
    const saved = this.trips.find(data.id);
    if (!saved) throw new Error('A viagem sorteada não apareceu na lista.');
    return saved;
  }

  /**
   * Usa o meu veto do mês: a viagem sorteada deixa de existir e a opção sai do sorteio até ao mês que vem.
   * A base de dados recusa um segundo veto do mesmo mês.
   */
  async veto(trip: Trip): Promise<void> {
    const { error } = await this.supabase
      .from('draw_vetoes')
      .insert({ month: this.month(), entry_id: trip.drawEntry ?? `wish:${trip.placeId}` });
    if (error) throw error;
    await this.trips.remove(trip);
    await this.load();
  }

  /** O sítio de uma opção do sorteio: o da wishlist já existe; o de uma sugestão cria-se (ou reaproveita-se). */
  private async placeFor(entry: PoolEntry): Promise<string> {
    if (entry.kind === 'wishlist') return entry.id.slice('wish:'.length);

    const suggestion = SUGGESTIONS.find((item) => `suggestion:${item.id}` === entry.id);
    if (!suggestion) throw new Error('Sugestão desconhecida.');

    // Se um sorteio anterior já criou este sítio, não se repete.
    const existing = await this.supabase
      .from('places')
      .select('id')
      .eq('name', suggestion.name)
      .eq('lat', suggestion.lat)
      .eq('lng', suggestion.lng)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing.data) return existing.data.id;

    const { data, error } = await this.supabase
      .from('places')
      .insert({
        name: suggestion.name,
        admin1: suggestion.admin1,
        country_code: suggestion.countryCode,
        lat: suggestion.lat,
        lng: suggestion.lng,
        min_stay: suggestion.minStay,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o sítio.');
    return data.id;
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-draws')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draw_vetoes' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
