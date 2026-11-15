import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { todayIso } from './availability.logic';
import { Meeting, MeetingPlace, MeetingRow, toMeeting, upcomingMeetings } from './meetings.logic';
import { SupabaseService } from './supabase.service';

export interface MeetingInput {
  startDate: string;
  endDate: string | null;
  place: MeetingPlace;
  note: string | null;
}

/** Os encontros dos dois (visitas sem ser viagem). Atualiza-se sozinha quando o outro marca ou muda um. */
@Injectable({ providedIn: 'root' })
export class MeetingsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<Meeting[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  /** Os que ainda vêm aí (ou estão a decorrer), do mais próximo para o mais distante. */
  readonly upcoming = computed(() => upcomingMeetings(this.items(), todayIso()));

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

  byId(id: string): Meeting | null {
    return this.items().find((meeting) => meeting.id === id) ?? null;
  }

  async load(): Promise<void> {
    const { data, error } = await this.supabase.from('meetings').select('*').order('start_date').returns<MeetingRow[]>();
    if (error || !data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.items.set(data.map(toMeeting));
    this.loaded.set(true);
  }

  async add(input: MeetingInput): Promise<void> {
    const { data, error } = await this.supabase.from('meetings').insert(this.toRow(input)).select('*').single<MeetingRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o encontro.');
    this.items.update((items) => [...items, toMeeting(data)]);
  }

  async update(id: string, input: MeetingInput): Promise<void> {
    const { data, error } = await this.supabase.from('meetings').update(this.toRow(input)).eq('id', id).select('*').single<MeetingRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o encontro.');
    this.items.update((items) => items.map((item) => (item.id === id ? toMeeting(data) : item)));
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('meetings').delete().eq('id', id);
    if (error) throw error;
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  private toRow(input: MeetingInput) {
    return { start_date: input.startDate, end_date: input.endDate, at_place: input.place, note: input.note };
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-meetings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
