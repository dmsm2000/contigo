import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronBackOutline, chevronForwardOutline, receiptOutline, trashOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { todayIso } from '../../core/availability.logic';
import { Expense, monthlyLedger, spentByPerson, totalOf } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { formatCost } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';
import { AuditLineComponent } from '../../features/audit/audit-line.component';
import { AvatarComponent } from '../../features/profile/avatar.component';

/** Quanto se gastou, por viagem e por categoria, e a cebola: o que sobra das dotações. */
import { BackDirective } from '../../shared/back.directive';
@Component({
  selector: 'app-expenses',
  imports: [BackDirective, IonContent, IonIcon, RouterLink, TranslocoPipe, AuditLineComponent, AvatarComponent],
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage {
  private readonly flow = inject(TripFlowService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  protected readonly expenses = inject(ExpensesService);
  protected readonly profile = inject(ProfileService);
  protected readonly trips = inject(TripsService);
  protected readonly labels = inject(TripLabels);

  private readonly auth = inject(AuthService);
  protected readonly cebola = this.expenses.cebola;

  /** Os dois, com o que cada um põe por mês e o que gastou este mês. */
  protected readonly pot = computed(() => {
    const month = todayIso().slice(0, 7);
    const spent = spentByPerson(this.expenses.items(), month);
    const me = this.auth.userId();
    return this.profile.people().map((person) => ({
      id: person.id,
      name: person.id === me ? this.transloco.translate('wish.you') : person.name || this.transloco.translate('wish.theOther'),
      mine: person.id === me,
      allowance: Number(person.monthly_allowance),
      spent: spent.get(person.id) ?? 0,
    }));
  });

  /** Mês a mês: o que entrou, o que se gastou e o que ficou. Mostram-se os 6 mais recentes até se pedir o resto. */
  protected readonly showAllMonths = signal(false);
  protected readonly ledger = computed(() => monthlyLedger(this.expenses.items(), this.profile.incomeFor, todayIso()));
  protected readonly ledgerShown = computed(() => (this.showAllMonths() ? this.ledger() : this.ledger().slice(0, 6)));
  protected readonly total = computed(() => totalOf(this.expenses.items()));
  protected readonly myAllowance = computed(() => Number(this.profile.profile()?.monthly_allowance ?? 0));

  /** Quanto do que havia para este mês já foi gasto (0 a 1; passa de 1 quando se gastou a mais). */
  protected readonly spentShare = computed(() => {
    const { available, spentThisMonth } = this.cebola();
    const budget = available + spentThisMonth;
    return budget > 0 ? Math.min(1, spentThisMonth / budget) : spentThisMonth > 0 ? 1 : 0;
  });

  /** O valor da cebola com sinal: "+140 €" ou "−30 €". */
  protected readonly cebolaText = computed(() => {
    const { amount } = this.cebola();
    return `${amount < 0 ? '−' : '+'}${this.money(Math.abs(amount))}`;
  });

  /** As viagens com gastos, as mais caras primeiro. */
  protected readonly tripRows = computed(() =>
    [...this.expenses.byTrip()]
      .map(([tripId, amount]) => ({ trip: this.trips.trips().find((candidate) => candidate.id === tripId) ?? null, amount }))
      .filter((row): row is { trip: NonNullable<typeof row.trip>; amount: number } => row.trip !== null)
      .sort((a, b) => b.amount - a.amount),
  );

  /** As categorias com a parte de cada uma (0 a 1), para as barras. */
  protected readonly categoryRows = computed(() => {
    const total = this.total();
    return this.expenses.byCategory().map((row) => ({ ...row, share: total ? row.total / total : 0 }));
  });

  constructor() {
    addIcons({ add, chevronBackOutline, chevronForwardOutline, receiptOutline, trashOutline });
  }

  protected money(amount: number): string {
    return formatCost(amount, this.language());
  }

  /** "novembro de 2026", com a inicial em maiúscula. */
  protected monthLabel(month: string): string {
    const locale = { pt: 'pt-PT', es: 'es-ES', en: 'en-GB' }[this.language()];
    const text = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected tripName(expense: Expense): string {
    const trip = this.trips.trips().find((candidate) => candidate.id === expense.tripId);
    return trip?.place.name ?? '';
  }

  protected add(): void {
    void this.flow.openExpense();
  }

  protected openTrip(tripId: string): void {
    void this.flow.openDetail(tripId);
  }

  protected edit(expense: Expense): void {
    void this.flow.openExpense(expense.tripId, expense);
  }

  protected async confirmRemove(expense: Expense): Promise<void> {
    const t = (key: string) => this.transloco.translate(key);
    const alert = await this.alerts.create({
      header: t('expenses.removeTitle'),
      message: t('expenses.removeText'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('expenses.remove'), role: 'destructive', handler: () => void this.remove(expense) },
      ],
    });
    await alert.present();
  }

  private async remove(expense: Expense): Promise<void> {
    try {
      await this.expenses.remove(expense.id);
      await this.toast('expenses.removed');
    } catch {
      await this.toast('expenses.removeError');
    }
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2200, position: 'top' });
    await toast.present();
  }
}
