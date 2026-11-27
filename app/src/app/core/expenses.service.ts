import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { DepositsService } from './deposits.service';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import {
  cebola,
  Expense,
  ExpenseCategory,
  ExpenseRow,
  isUnreachable,
  newestFirst,
  PendingExpense,
  toExpense,
  totalsByCategory,
  totalsByTrip,
  withPending,
} from './expenses.logic';
import { readPending, readSnapshot, writePending, writeSnapshot } from './offline-store';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';
import { todayIso } from './availability.logic';

/** Sem rede não se corrige nem se apaga uma despesa que já foi enviada: só as novas se registam sem rede. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

/** Uma despesa nova ou foi enviada logo, ou ficou guardada no telemóvel à espera de rede. */
export type AddResult = 'sent' | 'queued';

/** O código do Postgres para "já existe um registo com este id": a despesa já tinha chegado ao servidor. */
const DUPLICATE = '23505';

interface DraftExpense {
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  spentOn: string;
}

/**
 * As despesas das viagens e a cebola que delas sai. Atualiza-se sozinha quando o outro regista, corrige ou apaga uma.
 * Registar uma despesa nova funciona sem rede: fica guardada no telemóvel, conta logo nos totais e envia-se sozinha
 * quando a rede volta.
 */
@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly deposits = inject(DepositsService);
  private readonly connectivity = inject(ConnectivityService);
  private channel: RealtimeChannel | null = null;

  /** As despesas como estão no servidor (da última vez que se foi lá). */
  private readonly server = signal<Expense[]>([]);
  /** As registadas sem rede que ainda não foram enviadas. */
  private readonly pending = signal<PendingExpense[]>([]);
  private pendingFor: string | null = null;
  private flushing = false;

  /** Todas as despesas: as do servidor e as que ainda não foram enviadas (marcadas com `sync`). */
  readonly items = computed(() => withPending(this.server(), this.pending()));
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);

  readonly newest = computed(() => newestFirst(this.items()));
  readonly byTrip = computed(() => totalsByTrip(this.items()));
  readonly byCategory = computed(() => totalsByCategory(this.items()));
  readonly cebola = computed(() => cebola(this.items(), this.profile.incomeFor, todayIso(), this.deposits.items()));
  /** Quantas despesas ainda não chegaram ao servidor. */
  readonly pendingCount = computed(() => this.pending().length);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      // Recarrega (e envia o que falta) quando a rede volta, a app volta ao primeiro plano ou a sessão se renova.
      this.auth.reload();
      untracked(() => {
        if (userId) {
          this.restore(userId);
          void this.load();
          void this.flush();
          this.listen();
        } else {
          this.stopListening();
          this.server.set([]);
          this.pending.set([]);
          this.pendingFor = null;
          this.loaded.set(false);
        }
      });
    });
  }

  /** O que havia da última vez (despesas e fila por enviar): aparece logo, e sem rede. */
  private restore(userId: string): void {
    if (this.pendingFor !== userId) {
      this.pending.set(readPending<PendingExpense>(userId, 'expenses'));
      this.pendingFor = userId;
    }
    if (this.loaded()) return;
    const rows = readSnapshot<ExpenseRow>(userId, 'expenses');
    if (!rows) return;
    this.server.set(rows.map(toExpense));
    this.loaded.set(true);
  }

  async load(): Promise<void> {
    // Com a sessão só guardada (sem rede), um pedido iria como anónimo: espera-se pela renovação.
    if (this.auth.stale()) return;
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
    this.server.set(rows.map(toExpense));
    this.loaded.set(true);
    const userId = this.auth.userId();
    if (userId) writeSnapshot(userId, 'expenses', rows);
  }

  /**
   * Regista uma despesa. Sem rede (ou se a rede falha a meio), fica guardada no telemóvel e envia-se sozinha quando
   * houver ligação; o resultado diz qual dos casos foi. Lança se o servidor a recusar ou se não houver onde guardá-la.
   */
  async add(input: DraftExpense & { tripId: string }): Promise<AddResult> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('sem sessão');
    // O id nasce aqui: se o envio se repetir, o servidor reconhece-o e não duplica.
    const item: PendingExpense = {
      ...input,
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    if (this.canReach()) {
      const { error, status } = await this.send(item);
      if (!error) {
        await this.load();
        return 'sent';
      }
      if (!isUnreachable(status)) throw error;
    }
    this.pending.update((list) => [...list, item]);
    if (!writePending(userId, 'expenses', this.pending())) {
      this.pending.update((list) => list.filter((entry) => entry.id !== item.id));
      throw new Error('sem espaço para guardar a despesa');
    }
    return 'queued';
  }

  /**
   * Envia as despesas guardadas, uma a uma. Pára à primeira falta de rede (o resto fica para depois). Uma que o
   * servidor recuse fica marcada, e não se volta a tentar até a pessoa a corrigir ou apagar.
   */
  async flush(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId || this.flushing || !this.canReach() || !this.pending().length) return;
    this.flushing = true;
    let sent = false;
    try {
      for (const item of this.pending()) {
        if (item.failed) continue;
        const { error, status } = await this.send(item);
        if (error && isUnreachable(status)) break;
        if (error && error.code !== DUPLICATE) {
          this.changePending(userId, item.id, { failed: true });
          continue;
        }
        this.dropPending(userId, item.id);
        sent = true;
      }
    } finally {
      this.flushing = false;
    }
    if (sent) await this.load();
  }

  /** Corrige uma despesa: o valor, a categoria, a nota e o dia. A viagem e o autor não mudam. */
  async update(id: string, input: DraftExpense): Promise<void> {
    const userId = this.auth.userId();
    if (userId && this.pending().some((item) => item.id === id)) {
      // Ainda não foi enviada: corrige-se a cópia do telemóvel (e, se estava recusada, tenta-se outra vez).
      this.changePending(userId, id, { ...input, failed: false });
      void this.flush();
      return;
    }
    if (!this.canReach()) throw new OfflineError();
    const { error, status } = await this.supabase
      .from('expenses')
      .update({
        amount_eur: input.amount,
        category: input.category,
        note: input.note,
        spent_on: input.spentOn,
      })
      .eq('id', id);
    if (error) throw isUnreachable(status) ? new OfflineError() : error;
    await this.load();
  }

  async remove(id: string): Promise<void> {
    const userId = this.auth.userId();
    if (userId && this.pending().some((item) => item.id === id)) {
      this.dropPending(userId, id);
      return;
    }
    if (!this.canReach()) throw new OfflineError();
    const { error, status } = await this.supabase.from('expenses').delete().eq('id', id);
    if (error) throw isUnreachable(status) ? new OfflineError() : error;
    await this.load();
  }

  /** Há como falar com o servidor (com a sessão renovada e, pelo que o browser diz, com rede). */
  private canReach(): boolean {
    return this.connectivity.online() && !this.auth.stale();
  }

  private send(item: PendingExpense) {
    return this.supabase.from('expenses').insert({
      id: item.id,
      trip_id: item.tripId,
      amount_eur: item.amount,
      category: item.category,
      note: item.note,
      spent_on: item.spentOn,
    });
  }

  private changePending(userId: string, id: string, changes: Partial<PendingExpense>): void {
    this.pending.update((list) =>
      list.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
    writePending(userId, 'expenses', this.pending());
  }

  private dropPending(userId: string, id: string): void {
    this.pending.update((list) => list.filter((item) => item.id !== id));
    writePending(userId, 'expenses', this.pending());
  }

  private listen(): void {
    if (this.channel) return;
    this.channel = this.supabase
      .channel('contigo-expenses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => void this.load(),
      )
      .subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
