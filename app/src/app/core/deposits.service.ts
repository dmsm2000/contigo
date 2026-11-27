import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { Deposit, DepositRow, newestDepositsFirst, toDeposit } from './deposits.logic';
import { SupabaseService } from './supabase.service';

export interface DepositInput {
  amount: number;
  madeOn: string;
  note: string | null;
}

/** Os depósitos na cebola dos dois. Atualiza-se sozinha quando o outro mete dinheiro ou corrige um depósito. */
@Injectable({ providedIn: 'root' })
export class DepositsService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<Deposit[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);
  readonly newest = computed(() => newestDepositsFirst(this.items()));

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      // Recarrega quando a rede volta, a app volta ao primeiro plano ou a sessão se renova.
      this.auth.reload();
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

  byId(id: string): Deposit | null {
    return this.items().find((deposit) => deposit.id === id) ?? null;
  }

  async load(): Promise<void> {
    if (this.auth.stale()) return;
    const { data, error } = await this.supabase.from('onion_deposits').select('*').order('made_on').returns<DepositRow[]>();
    if (error || !data) {
      this.loadFailed.set(true);
      return;
    }
    this.loadFailed.set(false);
    this.items.set(data.map(toDeposit));
    this.loaded.set(true);
  }

  async add(input: DepositInput): Promise<void> {
    const { data, error } = await this.supabase.from('onion_deposits').insert(this.toRow(input)).select('*').single<DepositRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o depósito.');
    this.items.update((items) => [...items, toDeposit(data)]);
  }

  async update(id: string, input: DepositInput): Promise<void> {
    const { data, error } = await this.supabase.from('onion_deposits').update(this.toRow(input)).eq('id', id).select('*').single<DepositRow>();
    if (error || !data) throw error ?? new Error('Não foi possível guardar o depósito.');
    this.items.update((items) => items.map((item) => (item.id === id ? toDeposit(data) : item)));
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('onion_deposits').delete().eq('id', id);
    if (error) throw error;
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  private toRow(input: DepositInput) {
    return { amount: input.amount, made_on: input.madeOn, note: input.note };
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-deposits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'onion_deposits' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
