import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronBackOutline, chevronForwardOutline, receiptOutline, trashOutline } from 'ionicons/icons';
import { Expense, totalOf } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { formatCost } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';
import { AuditLineComponent } from '../../features/audit/audit-line.component';

/** Quanto se gastou, por viagem e por categoria, e a cebola: o que sobra das dotações. */
@Component({
  selector: 'app-expenses',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe, AuditLineComponent],
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

  protected readonly cebola = this.expenses.cebola;
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
