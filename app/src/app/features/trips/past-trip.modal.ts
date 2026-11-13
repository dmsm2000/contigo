import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { PlaceCandidate } from '../../core/geocoder';
import { LanguageService } from '../../core/language.service';
import { TripsService } from '../../core/trips.service';
import { isFutureMonth, monthOptions, parseCost, previousMonth, WouldReturn, yearOptions } from '../../core/trips.logic';
import { PlacePickerComponent } from '../places/place-picker.component';

@Component({
  selector: 'app-past-trip-modal',
  imports: [IonContent, IonIcon, FormsModule, TranslocoPipe, PlacePickerComponent],
  templateUrl: './past-trip.modal.html',
  styleUrl: './past-trip.modal.scss',
})
export class PastTripModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly trips = inject(TripsService);
  private readonly language = inject(LanguageService).language;

  // Onde
  protected readonly place = signal<PlaceCandidate | null>(null);

  // Quando: por defeito, o mês passado, que é por onde a maioria das viagens já feitas começa.
  private readonly start = previousMonth();
  protected readonly year = signal(this.start.year);
  protected readonly month = signal(this.start.month);
  protected readonly months = computed(() => monthOptions(this.language()));
  protected readonly years = yearOptions();

  // O resto
  protected readonly withPartner = signal(true);
  protected readonly wouldReturn = signal<WouldReturn | null>(null);
  protected readonly returnOptions: readonly WouldReturn[] = ['yes', 'maybe', 'no'];
  protected cost = '';
  protected note = '';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline });
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected setPlace(place: PlaceCandidate | null): void {
    this.place.set(place);
    this.error.set(null);
  }

  protected toNumber(event: Event): number {
    return Number((event.target as HTMLSelectElement).value);
  }

  protected toggleReturn(option: WouldReturn): void {
    // Tocar outra vez na mesma opção tira-a: a resposta é opcional.
    this.wouldReturn.update((current) => (current === option ? null : option));
  }

  protected async save(): Promise<void> {
    const place = this.place();
    if (!place) return this.fail('trip.form.errors.place');
    if (isFutureMonth(this.year(), this.month())) return this.fail('trip.form.errors.future');
    const cost = parseCost(this.cost);
    if (cost === 'invalid') return this.fail('trip.form.errors.cost');

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.trips.addPastTrip({
        place,
        year: this.year(),
        month: this.month(),
        withPartner: this.withPartner(),
        wouldReturn: this.wouldReturn(),
        costEur: cost,
        note: this.note.trim() || null,
      });
    } catch {
      this.saving.set(false);
      return this.fail('trip.form.errors.save');
    }
    await this.modalCtrl.dismiss({ saved: true });
    const toast = await this.toasts.create({
      message: this.transloco.translate('trip.form.saved'),
      duration: 2200,
      position: 'top',
    });
    await toast.present();
  }

  private fail(key: string): void {
    this.error.set(key);
  }
}
