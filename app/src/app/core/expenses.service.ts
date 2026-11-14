import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { cebola, Expense, ExpenseCategory, ExpenseRow, newestFirst, toExpense, totalsByCategory, totalsByTrip } from './expenses.logic';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';
import { todayIso } from './availability.logic';

/** As despesas das viagens e a cebola que delas sai. Atualiza-se sozinha quando o outro regista, corrige ou apaga uma. */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private channel: RealtimeChannel | null = null;

  readonly items = signal<Expense[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  readonly newest = computed(() => newestFirst(this.items()));
  readonly byTrip = computed(() => totalsByTrip(this.items()));
  readonly byCategory = computed(() => totalsByCategory(this.items()));
  readonly cebola = computed(() => cebola(this.items(), this.profile.monthlyTotal(), todayIso()));

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

  async load(): Promise<void> {
    const rows: ExpenseRow[] = [];
    for (let start = 0; ; start += 1000) {
      const page = await this.supabase
        .from('expenses')
        .select('*')
        .order('spent_on', { ascending: false })
        .order('id')
        .range(start, start + 999)
        .returns<ExpenseRow[]>();
      if (page.error || !page.data) {
        this.loadFailed.set(true);
        return;
      }
      rows.push(...page.data);
      if (page.data.length < 1000) break;
    }
    this.loadFailed.set(false);
    this.items.set(rows.map(toExpense));
    this.loaded.set(true);
  }

  async add(input: { tripId: string; amount: number; category: ExpenseCategory; note: string | null; spentOn: string }): Promise<void> {
    const { error } = await this.supabase.from('expenses').insert({
      trip_id: input.tripId,
      amount_eur: input.amount,
      category: input.category,
      note: input.note,
      spent_on: input.spentOn,
    });
    if (error) throw error;
    await this.load();
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await this.load();
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => void this.load())
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
