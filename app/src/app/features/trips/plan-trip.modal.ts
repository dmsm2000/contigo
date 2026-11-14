import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { todayIso } from '../../core/availability.logic';
import { PlaceCandidate } from '../../core/geocoder';
import { TripsService } from '../../core/trips.service';
import { PlacePickerComponent } from '../places/place-picker.component';

/** Planear uma viagem à mão (sem sorteio): o sítio, quem vai e as datas, se já se sabem. O resto faz-se no plano. */
@Component({
  selector: 'app-plan-trip-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe, PlacePickerComponent],
  templateUrl: './plan-trip.modal.html',
  styleUrl: './plan-trip.modal.scss',
})
export class PlanTripModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly trips = inject(TripsService);

  protected readonly place = signal<PlaceCandidate | null>(null);
  protected readonly knownDates = signal(false);
  protected readonly withPartner = signal(true);
  protected readonly today = todayIso();
  protected start = '';
  protected end = '';

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

  protected onStart(): void {
    // Se o fim ficou antes do começo (ou por escolher), acompanha o começo.
    if (!this.end || this.end < this.start) this.end = this.start;
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    const place = this.place();
    if (!place) return this.fail('plan.form.errors.place');
    let start: string | null = null;
    let end: string | null = null;
    if (this.knownDates()) {
      if (!this.start) return this.fail('plan.form.errors.start');
      start = this.start;
      end = this.end && this.end >= this.start ? this.end : this.start;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const id = await this.trips.addPlannedTrip({ place, withPartner: this.withPartner(), start, end });
      await this.modalCtrl.dismiss({ tripId: id });
    } catch {
      this.saving.set(false);
      this.fail('plan.form.errors.save');
    }
  }

  private fail(key: string): void {
    this.error.set(key);
  }
}
