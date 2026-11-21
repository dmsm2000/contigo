import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import {
  costSummary,
  Itinerary,
  ItineraryItem,
  ItineraryItemRow,
  ItineraryRow,
  ParsedItinerary,
  toItinerary,
  toItineraryItem,
} from './itinerary.logic';
import { readSnapshot, writeSnapshot } from './offline-store';
import { SupabaseService } from './supabase.service';
import { TripPlanService } from './trip-plan.service';

const TABLES = ['trip_itineraries', 'trip_itinerary_items'] as const;

/**
 * Os roteiros das viagens: um rascunho (o que veio do chat) e um roteiro aceite por viagem.
 * Atualiza-se sozinho quando o outro cola, aceita ou apaga alguma coisa.
 */
@Injectable({ providedIn: 'root' })
export class ItineraryService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly plan = inject(TripPlanService);
  private readonly connectivity = inject(ConnectivityService);
  private channel: RealtimeChannel | null = null;

  readonly itineraries = signal<Itinerary[]>([]);
  readonly loaded = signal(false);
  /** A última tentativa de ir buscar os roteiros falhou (por exemplo, sem rede): o que se vê é a cópia da última vez. */
  readonly loadFailed = signal(false);

  private readonly byTrip = computed(() => {
    const map = new Map<string, { draft: Itinerary | null; accepted: Itinerary | null }>();
    for (const itinerary of this.itineraries()) {
      const entry = map.get(itinerary.tripId) ?? { draft: null, accepted: null };
      entry[itinerary.status] = itinerary;
      map.set(itinerary.tripId, entry);
    }
    return map;
  });

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      const stale = this.auth.stale();
      // Recarrega quando a rede volta ou a app volta ao primeiro plano.
      this.connectivity.refresh();
      untracked(() => {
        if (userId) {
          this.restore(userId);
          void this.load();
          if (!stale) this.listen();
        } else {
          this.stopListening();
          this.itineraries.set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  /** O roteiro da última vez, para aparecer logo (e sem rede): a rede só o atualiza. */
  private restore(userId: string): void {
    if (this.loaded()) return;
    const itineraries = readSnapshot<ItineraryRow>(userId, 'itineraries');
    const items = readSnapshot<ItineraryItemRow>(userId, 'itinerary-items');
    if (!itineraries || !items) return;
    this.apply(itineraries, items);
  }

  private apply(itineraries: ItineraryRow[], items: ItineraryItemRow[]): void {
    const byItinerary = new Map<string, ItineraryItem[]>();
    for (const row of items) {
      const item = toItineraryItem(row);
      byItinerary.set(item.itineraryId, [...(byItinerary.get(item.itineraryId) ?? []), item]);
    }
    this.itineraries.set(itineraries.map((row) => toItinerary(row, byItinerary.get(row.id) ?? [])));
    this.loaded.set(true);
  }

  /** O rascunho e o roteiro aceite de uma viagem (qualquer um pode não existir). */
  of(tripId: string): { draft: Itinerary | null; accepted: Itinerary | null } {
    return this.byTrip().get(tripId) ?? { draft: null, accepted: null };
  }

  async load(): Promise<void> {
    // Com a sessão só guardada (sem rede), um pedido iria como anónimo e voltaria vazio: fica a cópia.
    if (this.auth.stale()) return;
    const [itineraries, items] = await Promise.all([
      this.supabase.from('trip_itineraries').select('*').returns<ItineraryRow[]>(),
      this.supabase.from('trip_itinerary_items').select('*').order('day').order('position').returns<ItineraryItemRow[]>(),
    ]);
    if (itineraries.error || items.error) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.apply(itineraries.data ?? [], items.data ?? []);
    const userId = this.auth.userId();
    if (userId) {
      writeSnapshot(userId, 'itineraries', itineraries.data ?? []);
      writeSnapshot(userId, 'itinerary-items', items.data ?? []);
    }
  }

  /** Guarda o que veio do chat como rascunho, no lugar do rascunho anterior (se havia). */
  async importDraft(tripId: string, parsed: ParsedItinerary): Promise<void> {
    await this.run(this.supabase.from('trip_itineraries').delete().eq('trip_id', tripId).eq('status', 'draft'));
    const { data, error } = await this.supabase
      .from('trip_itineraries')
      .insert({ trip_id: tripId, status: 'draft', summary: parsed.summary, tips: parsed.tips })
      .select('id')
      .single<{ id: string }>();
    if (error || !data) throw new Error(error?.message ?? 'insert');
    const rows = parsed.items.map((item) => ({
      itinerary_id: data.id,
      trip_id: tripId,
      day: item.day,
      position: item.position,
      start_time: item.startTime,
      end_time: item.endTime,
      title: item.title,
      category: item.category,
      description: item.description,
      place_name: item.placeName,
      address: item.address,
      cost_eur: item.costEur,
      booking: item.booking,
      link: item.link,
      tip: item.tip,
    }));
    await this.run(this.supabase.from('trip_itinerary_items').insert(rows));
  }

  async discardDraft(tripId: string): Promise<void> {
    await this.run(this.supabase.from('trip_itineraries').delete().eq('trip_id', tripId).eq('status', 'draft'));
  }

  async removeAccepted(tripId: string): Promise<void> {
    await this.run(this.supabase.from('trip_itineraries').delete().eq('trip_id', tripId).eq('status', 'accepted'));
  }

  async removeItem(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_itinerary_items').delete().eq('id', id));
  }

  /** O rascunho passa a ser o roteiro da viagem, no lugar do anterior. */
  async accept(tripId: string): Promise<void> {
    const draft = this.of(tripId).draft;
    if (!draft) return;
    await this.run(this.supabase.from('trip_itineraries').delete().eq('trip_id', tripId).eq('status', 'accepted'));
    await this.run(this.supabase.from('trip_itineraries').update({ status: 'accepted' }).eq('id', draft.id));
  }

  /** Põe os custos do roteiro nas estimativas do orçamento (comida, atividades, transportes e outros). */
  async useInBudget(tripId: string): Promise<void> {
    const accepted = this.of(tripId).accepted;
    if (!accepted) return;
    const { byCategory } = costSummary(accepted.items);
    // Só se mexe nas categorias que o roteiro tem: as outras estimativas ficam como estavam.
    for (const category of ['food', 'activities', 'transport', 'other'] as const) {
      const amount = byCategory[category];
      if (amount !== undefined) await this.plan.setBudgetLine(tripId, category, amount);
    }
  }

  private async run(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await query;
    if (error) throw new Error(error.message);
    await this.load();
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    let channel = this.supabase.channel('contigo-itinerary');
    for (const table of TABLES) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, reload);
    this.channel = channel.subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
