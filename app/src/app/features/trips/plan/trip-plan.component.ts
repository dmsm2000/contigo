import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bedOutline,
  boatOutline,
  bulbOutline,
  carOutline,
  checkmarkCircle,
  ellipseOutline,
  ellipsisHorizontal,
  openOutline,
  star,
  starOutline,
  trainOutline,
  trashOutline,
  airplaneOutline,
  bus,
} from 'ionicons/icons';
import { todayIso } from '../../../core/availability.logic';
import { EXPENSE_CATEGORIES, ExpenseCategory, parseAmount, totalOf } from '../../../core/expenses.logic';
import { ExpensesService } from '../../../core/expenses.service';
import { LanguageService } from '../../../core/language.service';
import {
  budgetTotals,
  CHECKLIST_KINDS,
  ChecklistKind,
  DateOption,
  formatDuration,
  formatRange,
  headroom,
  Leg,
  LegMode,
  missingForPrepared,
  nextStage,
  nightsBetween,
  openFirst,
  Stage,
  stageOf,
  STAGES,
  Stay,
  sortStays,
  statusForStage,
  suggestBudget,
  travellers,
} from '../../../core/trip-plan.logic';
import { TripPlanService } from '../../../core/trip-plan.service';
import { formatCost, Trip } from '../../../core/trips.logic';
import { TripsService } from '../../../core/trips.service';
import { CloseTripModal } from './close-trip.modal';
import { DateOptionModal, LegModal, StayModal } from './plan-forms';

/**
 * O plano de uma viagem que ainda não acabou: o passo do ciclo (a planear → preparada → em curso → fechada), as datas
 * em avaliação, como chegar, o alojamento, o orçamento contra o teto, a lista e as notas.
 */
@Component({
  selector: 'app-trip-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './trip-plan.component.html',
  styleUrl: './trip-plan.component.scss',
})
export class TripPlanComponent {
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly tripsService = inject(TripsService);
  private readonly expenses = inject(ExpensesService);
  protected readonly plan = inject(TripPlanService);

  readonly trip = input.required<Trip>();

  protected readonly stages = STAGES;
  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly kinds = CHECKLIST_KINDS;
  protected readonly newKind = signal<ChecklistKind>('see');
  protected newText = '';
  protected readonly busy = signal(false);

  protected readonly stage = computed<Stage>(() => stageOf(this.trip().status) ?? 'planning');
  protected readonly stageIndex = computed(() => STAGES.indexOf(this.stage()));
  protected readonly next = computed(() => nextStage(this.stage()));
  protected readonly people = computed(() => travellers(this.trip()));

  protected readonly dates = computed(() => this.plan.datesOf(this.trip().id));
  protected readonly stays = computed(() => sortStays(this.plan.staysOf(this.trip().id)));
  protected readonly chosenStay = computed(() => this.stays().find((stay) => stay.chosen) ?? null);
  protected readonly legs = computed(() => this.plan.legsOf(this.trip().id));
  protected readonly checklist = computed(() => openFirst(this.plan.checklistOf(this.trip().id)));
  protected readonly lines = computed(() => this.plan.budgetOf(this.trip().id));
  protected readonly totals = computed(() => budgetTotals(this.lines(), this.people()));
  protected readonly spent = computed(() => totalOf(this.expenses.items().filter((item) => item.tripId === this.trip().id)));
  /** O que já se gastou contra o teto (0 a 1, passa de 1 quando se ultrapassa), para o anel. */
  protected readonly ringShare = computed(() => {
    const cap = this.trip().budgetCapEur;
    return cap ? Math.min(1, this.spent() / cap) : 0;
  });
  protected readonly room = computed(() => headroom(this.trip().budgetCapEur, this.spent() > 0 ? this.spent() : this.totals().total));

  protected readonly rangeText = computed(() => {
    const trip = this.trip();
    return formatRange(trip.startDate, trip.endDate ?? trip.startDate, this.language());
  });
  protected readonly nights = computed(() => nightsBetween(this.trip().startDate, this.trip().endDate ?? this.trip().startDate));

  constructor() {
    addIcons({
      addOutline, airplaneOutline, bedOutline, boatOutline, bulbOutline, bus, carOutline, checkmarkCircle, ellipseOutline,
      ellipsisHorizontal, openOutline, star, starOutline, trainOutline, trashOutline,
    });
  }

  // ------------------------------------------------------------ apresentação

  protected money(amount: number | null): string {
    return amount === null ? '' : formatCost(amount, this.language());
  }

  protected range(option: Pick<DateOption, 'startDate' | 'endDate'>): string {
    return formatRange(option.startDate, option.endDate, this.language());
  }

  protected optionNights(option: Pick<DateOption, 'startDate' | 'endDate'>): number {
    return nightsBetween(option.startDate, option.endDate);
  }

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }

  protected modeIcon(mode: LegMode): string {
    return { car: 'car-outline', train: 'train-outline', bus: 'bus', flight: 'airplane-outline', other: 'ellipsis-horizontal' }[mode];
  }

  protected kindIcon(kind: ChecklistKind): string {
    return { see: 'star-outline', do: 'ellipse-outline', eat: 'bed-outline', todo: 'bulb-outline' }[kind];
  }

  protected lineAmount(category: ExpenseCategory): string {
    const line = this.lines().find((item) => item.category === category);
    return line ? String(line.amountEur).replace('.', ',') : '';
  }

  // ------------------------------------------------------------ ciclo

  protected async advance(): Promise<void> {
    const target = this.next();
    if (!target) return;
    if (target === 'closed') return this.openClose();
    if (target === 'prepared') {
      const missing = missingForPrepared({ datesConfirmed: this.trip().datesConfirmed, hasStay: this.chosenStay() !== null, hasBudget: this.lines().length > 0 });
      if (missing.length) {
        const t = (key: string) => this.transloco.translate(key);
        const alert = await this.alerts.create({
          header: t('plan.stage.missingTitle'),
          message: missing.map((item) => `• ${t('plan.stage.missing.' + item)}`).join('\n'),
          cssClass: 'ct-alert-lines',
          buttons: [
            { text: t('plan.stage.missingBack'), role: 'cancel' },
            { text: t('plan.stage.missingGo'), handler: () => void this.moveTo('prepared') },
          ],
        });
        await alert.present();
        return;
      }
    }
    await this.moveTo(target);
  }

  protected async goBack(): Promise<void> {
    const index = this.stageIndex();
    if (index <= 0) return;
    await this.moveTo(STAGES[index - 1]);
  }

  private async moveTo(stage: Stage): Promise<void> {
    this.busy.set(true);
    try {
      await this.tripsService.patch(this.trip().id, { status: statusForStage(stage, this.trip().status) });
    } catch {
      await this.toast('plan.errors.save');
    }
    this.busy.set(false);
  }

  private async openClose(): Promise<void> {
    const modal = await this.modals.create({ component: CloseTripModal, componentProps: { tripId: this.trip().id }, cssClass: 'ct-modal' });
    await modal.present();
  }

  // ------------------------------------------------------------ datas

  protected async addDate(): Promise<void> {
    await this.open(DateOptionModal, { tripId: this.trip().id });
  }

  protected async editDate(option: DateOption): Promise<void> {
    await this.open(DateOptionModal, { tripId: this.trip().id, option });
  }

  protected async prefer(option: DateOption): Promise<void> {
    await this.attempt(() => this.plan.setPreferred(this.trip().id, option.id));
  }

  protected async confirmDate(option: DateOption): Promise<void> {
    await this.attempt(() => this.plan.confirmDates(this.trip().id, option));
  }

  protected async reopenDates(): Promise<void> {
    await this.attempt(() => this.plan.unconfirmDates(this.trip().id));
  }

  // ------------------------------------------------------------ como chegar e alojamento

  protected async addLeg(): Promise<void> {
    await this.open(LegModal, { tripId: this.trip().id });
  }

  protected async editLeg(leg: Leg): Promise<void> {
    await this.open(LegModal, { tripId: this.trip().id, leg });
  }

  protected async addStay(): Promise<void> {
    await this.open(StayModal, { tripId: this.trip().id });
  }

  protected async editStay(stay: Stay): Promise<void> {
    await this.open(StayModal, { tripId: this.trip().id, stay });
  }

  protected async chooseStay(stay: Stay): Promise<void> {
    await this.attempt(() => this.plan.chooseStay(this.trip().id, stay.id, !stay.chosen));
  }

  // ------------------------------------------------------------ orçamento

  protected async setLine(category: ExpenseCategory, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return this.attempt(() => this.plan.setBudgetLine(this.trip().id, category, null));
    const value = trimmed === '0' ? 0 : parseAmount(trimmed);
    if (value === 'invalid') return this.toast('plan.errors.amount');
    await this.attempt(() => this.plan.setBudgetLine(this.trip().id, category, value));
  }

  protected async setCap(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return this.attempt(() => this.plan.setCap(this.trip().id, null));
    const value = parseAmount(trimmed);
    if (value === 'invalid') return this.toast('plan.errors.amount');
    await this.attempt(() => this.plan.setCap(this.trip().id, value));
  }

  /** Preenche o que já se sabe (alojamento escolhido, deslocações) sem mexer no que já escreveste. */
  protected async fillBudget(): Promise<void> {
    const suggestion = suggestBudget(this.chosenStay(), this.legs(), this.people());
    const existing = new Set(this.lines().map((line) => line.category));
    await this.attempt(async () => {
      for (const [category, amount] of Object.entries(suggestion) as [ExpenseCategory, number][]) {
        if (!existing.has(category)) await this.plan.setBudgetLine(this.trip().id, category, amount);
      }
    });
  }

  protected get canFill(): boolean {
    const suggestion = suggestBudget(this.chosenStay(), this.legs(), this.people());
    return Object.keys(suggestion).some((category) => !this.lines().some((line) => line.category === category));
  }

  // ------------------------------------------------------------ lista e notas

  protected async addItem(): Promise<void> {
    const text = this.newText.trim();
    if (!text) return;
    this.newText = '';
    await this.attempt(() => this.plan.addChecklistItem(this.trip().id, this.newKind(), text));
  }

  protected async toggleItem(id: string, done: boolean): Promise<void> {
    await this.attempt(() => this.plan.toggleChecklistItem(id, !done));
  }

  protected async removeItem(id: string): Promise<void> {
    await this.attempt(() => this.plan.removeChecklistItem(id));
  }

  protected async saveNote(text: string): Promise<void> {
    const value = text.trim() || null;
    if (value === this.trip().planNote) return;
    await this.attempt(() => this.tripsService.patch(this.trip().id, { plan_note: value }));
  }

  // ------------------------------------------------------------

  private async open(component: unknown, props: Record<string, unknown>): Promise<void> {
    const modal = await this.modals.create({ component: component as never, componentProps: props, cssClass: 'ct-modal' });
    await modal.present();
  }

  private async attempt(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      await this.toast('plan.errors.save');
    }
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2400, position: 'top' });
    await toast.present();
  }

  protected readonly today = todayIso();
}
