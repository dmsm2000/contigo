import { Component, computed, inject, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { totalOf } from '../../../core/expenses.logic';
import { ExpensesService } from '../../../core/expenses.service';
import { LanguageService } from '../../../core/language.service';
import { formatCost, WouldReturn } from '../../../core/trips.logic';
import { TripsService } from '../../../core/trips.service';

/** Fechar a viagem: quanto se gastou face ao teto, "voltávamos?" e uma nota final. A viagem passa a memória. */
@Component({
  selector: 'app-close-trip-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ 'plan.close.title' | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>

        @if (trip(); as t) {
          <section class="summary ct-card ct-rise" style="--i: 0">
            <p class="summary-line">{{ 'plan.close.spent' | transloco: { amount: money(spent()) } }}</p>
            @if (t.budgetCapEur !== null) {
              <p class="summary-line" [class.low]="spent() > t.budgetCapEur">
                {{ (spent() > t.budgetCapEur ? 'plan.close.over' : 'plan.close.within') | transloco: { cap: money(t.budgetCapEur), diff: money(spent() > t.budgetCapEur ? spent() - t.budgetCapEur : t.budgetCapEur - spent()) } }}
              </p>
              <p class="hint">{{ 'plan.close.cebolaHint' | transloco }}</p>
            }
          </section>
        }

        <form id="close-form" (ngSubmit)="save()" novalidate>
          <section class="block ct-rise" style="--i: 1">
            <span class="label" id="close-return">{{ 'trip.form.wouldReturn' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></span>
            <div class="pills" role="group" aria-labelledby="close-return">
              @for (option of options; track option) {
                <button class="pill" type="button" [class.on]="wouldReturn() === option" [attr.aria-pressed]="wouldReturn() === option" (click)="toggle(option)">{{ 'trip.form.' + option | transloco }}</button>
              }
            </div>
          </section>
          <section class="block ct-rise" style="--i: 2">
            <label class="label" for="close-note">{{ 'plan.close.note' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></label>
            <textarea id="close-note" name="note" rows="4" maxlength="500" [placeholder]="'trip.form.notePlaceholder' | transloco" [(ngModel)]="note"></textarea>
          </section>
          @if (error(); as key) {<p class="error" role="alert">{{ key | transloco }}</p>}
        </form>
      </div>
    </ion-content>
    <ion-footer class="form-footer"><button class="ct-btn save" type="submit" form="close-form" [disabled]="saving()">{{ 'plan.close.save' | transloco }}</button></ion-footer>
  `,
  styleUrl: './plan-forms.scss',
})
export class CloseTripModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly trips = inject(TripsService);
  private readonly expenses = inject(ExpensesService);
  private readonly language = inject(LanguageService).language;

  @Input() tripId = '';
  protected readonly options: readonly WouldReturn[] = ['yes', 'maybe', 'no'];
  protected readonly wouldReturn = signal<WouldReturn | null>(null);
  protected note = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly trip = computed(() => this.trips.find(this.tripId) ?? null);
  protected readonly spent = computed(() => totalOf(this.expenses.items().filter((item) => item.tripId === this.tripId)));

  constructor() {
    addIcons({ closeOutline });
  }

  protected money(amount: number): string {
    return formatCost(amount, this.language());
  }

  protected toggle(option: WouldReturn): void {
    this.wouldReturn.update((current) => (current === option ? null : option));
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async save(): Promise<void> {
    const trip = this.trip();
    if (!trip) return;
    this.saving.set(true);
    try {
      const final = this.note.trim();
      const note = [trip.note, final].filter(Boolean).join('\n\n') || null;
      await this.trips.patch(trip.id, {
        status: 'closed',
        would_return: this.wouldReturn(),
        note,
        // O gasto fica guardado no registo da viagem, para as estatísticas e para o fecho não depender das despesas.
        cost_eur: this.spent() > 0 ? this.spent() : trip.costEur,
      });
      await this.modalCtrl.dismiss({ closed: true });
      const toast = await this.toasts.create({ message: this.transloco.translate('plan.close.done'), duration: 2600, position: 'top' });
      await toast.present();
    } catch {
      this.saving.set(false);
      this.error.set('plan.errors.save');
    }
  }
}
