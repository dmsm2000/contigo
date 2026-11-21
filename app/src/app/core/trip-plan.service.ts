import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ExpenseCategory } from './expenses.logic';
import { SupabaseService } from './supabase.service';
import {
  BudgetLine,
  BudgetLineRow,
  ChecklistItem,
  ChecklistKind,
  ChecklistRow,
  DateOption,
  DateOptionRow,
  Leg,
  LegMode,
  LegRow,
  PlanApproval,
  PlanApprovalRow,
  Stay,
  StayRow,
  toBudgetLine,
  toChecklistItem,
  toDateOption,
  toLeg,
  legKey,
  LegDirection,
  toPlanApproval,
  toStay,
} from './trip-plan.logic';
import { TripsService } from './trips.service';

const TABLES = ['trip_date_options', 'trip_stays', 'trip_legs', 'trip_budget_lines', 'trip_checklist', 'trip_plan_approvals'] as const;

/**
 * O plano de cada viagem: datas em avaliação, alojamento, como chegar, orçamento e lista. Carrega tudo de uma vez
 * (são poucas linhas) e atualiza-se sozinho quando o outro mexe.
 */
@Injectable({ providedIn: 'root' })
export class TripPlanService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly trips = inject(TripsService);
  private channel: RealtimeChannel | null = null;

  private readonly dates = signal<DateOption[]>([]);
  private readonly stays = signal<Stay[]>([]);
  private readonly legs = signal<Leg[]>([]);
  private readonly budget = signal<BudgetLine[]>([]);
  private readonly checklist = signal<ChecklistItem[]>([]);
  private readonly approvals = signal<PlanApproval[]>([]);
  readonly loaded = signal(false);

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
          for (const list of [this.dates, this.stays, this.legs, this.budget, this.checklist, this.approvals]) (list as ReturnType<typeof signal<unknown[]>>).set([]);
          this.loaded.set(false);
        }
      });
    });
  }

  datesOf(tripId: string): DateOption[] {
    return this.dates().filter((item) => item.tripId === tripId).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  staysOf(tripId: string): Stay[] {
    return this.stays().filter((item) => item.tripId === tripId);
  }
  legsOf(tripId: string): Leg[] {
    return this.legs().filter((item) => item.tripId === tripId);
  }
  budgetOf(tripId: string): BudgetLine[] {
    return this.budget().filter((item) => item.tripId === tripId);
  }
  checklistOf(tripId: string): ChecklistItem[] {
    return this.checklist().filter((item) => item.tripId === tripId);
  }
  approvalsOf(tripId: string): PlanApproval[] {
    return this.approvals().filter((item) => item.tripId === tripId);
  }

  async load(): Promise<void> {
    // Com a sessão só guardada (sem rede), um pedido iria como anónimo: espera-se pela renovação.
    if (this.auth.stale()) return;
    const [dates, stays, legs, budget, checklist, approvals] = await Promise.all([
      this.supabase.from('trip_date_options').select('*').returns<DateOptionRow[]>(),
      this.supabase.from('trip_stays').select('*').order('created_at').returns<StayRow[]>(),
      this.supabase.from('trip_legs').select('*').order('created_at').returns<LegRow[]>(),
      this.supabase.from('trip_budget_lines').select('*').returns<BudgetLineRow[]>(),
      this.supabase.from('trip_checklist').select('*').order('created_at').returns<ChecklistRow[]>(),
      this.supabase.from('trip_plan_approvals').select('*').returns<PlanApprovalRow[]>(),
    ]);
    if (dates.error || stays.error || legs.error || budget.error || checklist.error || approvals.error) return;
    this.dates.set((dates.data ?? []).map(toDateOption));
    this.stays.set((stays.data ?? []).map(toStay));
    this.legs.set((legs.data ?? []).map(toLeg));
    this.budget.set((budget.data ?? []).map(toBudgetLine));
    this.checklist.set((checklist.data ?? []).map(toChecklistItem));
    this.approvals.set((approvals.data ?? []).map(toPlanApproval));
    this.loaded.set(true);
  }

  // ------------------------------------------------------------ datas

  async addDateOption(tripId: string, input: { start: string; end: string; note: string | null }): Promise<void> {
    const first = this.datesOf(tripId).length === 0;
    await this.run(this.supabase.from('trip_date_options').insert({ trip_id: tripId, start_date: input.start, end_date: input.end, note: input.note, preferred: first }));
  }

  async updateDateOption(id: string, input: { start: string; end: string; note: string | null }): Promise<void> {
    await this.run(this.supabase.from('trip_date_options').update({ start_date: input.start, end_date: input.end, note: input.note }).eq('id', id));
  }

  async removeDateOption(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_date_options').delete().eq('id', id));
  }

  /** A opção preferida (só há uma): tira a marca à anterior antes de pôr a nova. */
  async setPreferred(tripId: string, id: string): Promise<void> {
    await this.run(this.supabase.from('trip_date_options').update({ preferred: false }).eq('trip_id', tripId).eq('preferred', true));
    await this.run(this.supabase.from('trip_date_options').update({ preferred: true }).eq('id', id));
  }

  /** Fecha as datas: a viagem passa a ter as datas desta opção, confirmadas. */
  async confirmDates(tripId: string, option: Pick<DateOption, 'startDate' | 'endDate'>): Promise<void> {
    await this.trips.patch(tripId, { start_date: option.startDate, end_date: option.endDate, date_precision: 'day', dates_confirmed: true });
  }

  /** Volta a deixar as datas em avaliação. */
  async unconfirmDates(tripId: string): Promise<void> {
    await this.trips.patch(tripId, { dates_confirmed: false });
  }

  // ------------------------------------------------------------ alojamento

  async saveStay(tripId: string, input: { id?: string; name: string; priceEur: number | null; rating: number | null; note: string | null; link: string | null }): Promise<void> {
    const row = { name: input.name, price_eur: input.priceEur, rating: input.rating, note: input.note, link: input.link };
    if (input.id) await this.run(this.supabase.from('trip_stays').update(row).eq('id', input.id));
    else await this.run(this.supabase.from('trip_stays').insert({ trip_id: tripId, ...row }));
  }

  async removeStay(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_stays').delete().eq('id', id));
  }

  /** Escolhe o alojamento (só um); voltar a tocar na escolhida tira-lhe a escolha. */
  async chooseStay(tripId: string, id: string, chosen: boolean): Promise<void> {
    await this.run(this.supabase.from('trip_stays').update({ chosen: false }).eq('trip_id', tripId).eq('chosen', true));
    if (chosen) await this.run(this.supabase.from('trip_stays').update({ chosen: true }).eq('id', id));
  }

  // ------------------------------------------------------------ como chegar

  async saveLeg(tripId: string, input: { id?: string; origin: string; direction: LegDirection; departsOn: string | null; departsTime: string | null; arrivesTime: string | null; mode: LegMode; minutes: number | null; priceEur: number | null; note: string | null }): Promise<void> {
    const row = { origin: input.origin, direction: input.direction, departs_on: input.departsOn, departs_time: input.departsTime, arrives_time: input.arrivesTime, mode: input.mode, minutes: input.minutes, price_eur: input.priceEur, note: input.note };
    if (input.id) await this.run(this.supabase.from('trip_legs').update(row).eq('id', input.id));
    else {
      // A primeira deslocação de uma origem fica escolhida (é a única); as outras entram como alternativas.
      const key = legKey(input);
      const first = !this.legsOf(tripId).some((leg) => legKey(leg) === key);
      await this.run(this.supabase.from('trip_legs').insert({ trip_id: tripId, ...row, chosen: first }));
    }
  }

  /** Escolhe a deslocação de uma origem (só uma por origem); voltar a tocar na escolhida tira-lhe a escolha. */
  async chooseLeg(tripId: string, leg: Pick<Leg, 'id' | 'origin' | 'direction'>, chosen: boolean): Promise<void> {
    const sameOrigin = this.legsOf(tripId).filter((item) => legKey(item) === legKey(leg));
    for (const other of sameOrigin.filter((item) => item.chosen && item.id !== leg.id)) {
      await this.run(this.supabase.from('trip_legs').update({ chosen: false }).eq('id', other.id));
    }
    await this.run(this.supabase.from('trip_legs').update({ chosen }).eq('id', leg.id));
  }

  // ------------------------------------------------------------ aprovações

  /** Aprovo as 3 decisões (datas, alojamento e deslocação). */
  async approve(tripId: string): Promise<void> {
    await this.run(this.supabase.from('trip_plan_approvals').insert({ trip_id: tripId }));
  }

  /** Retiro a minha aprovação. */
  async withdraw(tripId: string): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    await this.run(this.supabase.from('trip_plan_approvals').delete().eq('trip_id', tripId).eq('user_id', userId));
  }

  async removeLeg(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_legs').delete().eq('id', id));
  }

  // ------------------------------------------------------------ orçamento

  /** Põe (ou tira, com nulo) a estimativa por pessoa de uma categoria. */
  async setBudgetLine(tripId: string, category: ExpenseCategory, amount: number | null): Promise<void> {
    if (amount === null) {
      await this.run(this.supabase.from('trip_budget_lines').delete().eq('trip_id', tripId).eq('category', category));
    } else {
      await this.run(this.supabase.from('trip_budget_lines').upsert({ trip_id: tripId, category, amount_eur: amount }, { onConflict: 'trip_id,category' }));
    }
  }

  async setCap(tripId: string, cap: number | null): Promise<void> {
    await this.trips.patch(tripId, { budget_cap_eur: cap });
  }

  // ------------------------------------------------------------ lista

  async addChecklistItem(tripId: string, kind: ChecklistKind, text: string): Promise<void> {
    await this.run(this.supabase.from('trip_checklist').insert({ trip_id: tripId, kind, text }));
  }

  async toggleChecklistItem(id: string, done: boolean): Promise<void> {
    await this.run(this.supabase.from('trip_checklist').update({ done }).eq('id', id));
  }

  async removeChecklistItem(id: string): Promise<void> {
    await this.run(this.supabase.from('trip_checklist').delete().eq('id', id));
  }

  // ------------------------------------------------------------

  private async run(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await query;
    if (error) throw new Error(error.message);
    await this.load();
  }

  private listen(): void {
    if (this.channel) return;
    const reload = () => void this.load();
    let channel = this.supabase.channel('contigo-trip-plan');
    for (const table of TABLES) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, reload);
    this.channel = channel.subscribe();
  }

  private stopListening(): void {
    if (!this.channel) return;
    void this.supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
