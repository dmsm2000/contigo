import { AfterViewInit, Component, computed, ElementRef, inject, Input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { bedOutline, closeOutline, ellipsisHorizontal, restaurantOutline, ticketOutline, trainOutline } from 'ionicons/icons';
import { todayIso } from '../../core/availability.logic';
import { DrawService } from '../../core/draw.service';
import { cleanExpenseNote, EXPENSE_CATEGORIES, Expense, ExpenseCategory, parseAmount } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { formatTripDate } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';

/** Registar uma despesa numa viagem. */
@Component({
  selector: 'app-expense-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './expense.modal.html',
  styleUrl: './expense.modal.scss',
})
export class ExpenseModal implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly expenses = inject(ExpensesService);
  private readonly trips = inject(TripsService);
  private readonly draws = inject(DrawService);
  private readonly language = inject(LanguageService).language;

  /** A viagem já escolhida (quando se abre a partir de uma viagem). */
  @Input() tripId: string | null = null;
  /** Com uma despesa, o formulário abre preenchido para a corrigir (a viagem não muda). */
  @Input() expense: Expense | null = null;

  protected readonly categories = EXPENSE_CATEGORIES;
  protected readonly categoryIcon: Record<ExpenseCategory, string> = {
    transport: 'train-outline',
    stay: 'bed-outline',
    food: 'restaurant-outline',
    activities: 'ticket-outline',
    other: 'ellipsis-horizontal',
  };
  private readonly amountField = viewChild<ElementRef<HTMLInputElement>>('amountField');
  protected readonly chosenTrip = signal('');
  protected readonly category = signal<ExpenseCategory>('food');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected amount = '';
  protected note = '';
  protected spentOn = todayIso();
  protected readonly today = todayIso();

  protected readonly options = computed(() =>
    this.trips.trips().map((trip) => ({ id: trip.id, label: `${trip.place.name} · ${formatTripDate(trip, this.language())}` })),
  );

  constructor() {
    addIcons({ bedOutline, closeOutline, ellipsisHorizontal, restaurantOutline, ticketOutline, trainOutline });
  }

  ngOnInit(): void {
    // Por defeito, a viagem sorteada que vem aí (é onde se gasta) ou a mais recente.
    const expense = this.expense;
    if (expense) {
      this.chosenTrip.set(expense.tripId);
      this.category.set(expense.category);
      this.amount = String(expense.amount).replace('.', ',');
      this.note = expense.note ?? '';
      this.spentOn = expense.spentOn;
      return;
    }
    this.chosenTrip.set(this.tripId ?? this.draws.active()?.id ?? this.trips.trips()[0]?.id ?? '');
  }

  ngAfterViewInit(): void {
    // Uma despesa nova começa pelo valor: abre o teclado logo (depois de a animação de entrada acabar).
    if (!this.expense) setTimeout(() => this.amountField()?.nativeElement.focus(), 450);
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected onTrip(event: Event): void {
    this.chosenTrip.set((event.target as HTMLSelectElement).value);
  }

  protected async save(): Promise<void> {
    if (!this.chosenTrip()) return this.error.set('expenses.form.errors.noTrip');
    const amount = parseAmount(this.amount);
    if (amount === 'invalid') return this.error.set('expenses.form.errors.amount');
    const note = cleanExpenseNote(this.note);
    if (note === 'tooLong') return this.error.set('expenses.form.errors.note');

    this.saving.set(true);
    this.error.set(null);
    try {
      const fields = { amount, category: this.category(), note, spentOn: this.spentOn || this.today };
      if (this.expense) await this.expenses.update(this.expense.id, fields);
      else await this.expenses.add({ tripId: this.chosenTrip(), ...fields });
    } catch {
      this.saving.set(false);
      return this.error.set('expenses.form.errors.save');
    }
    await this.modalCtrl.dismiss({ saved: true });
    const toast = await this.toasts.create({ message: this.transloco.translate(this.expense ? 'expenses.form.updated' : 'expenses.form.saved'), duration: 2200, position: 'top' });
    await toast.present();
  }
}
