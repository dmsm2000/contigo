import { Component, ElementRef, Input, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';
import { PlaceCandidate } from '../../core/geocoder';
import { LanguageService } from '../../core/language.service';
import { checkFile } from '../../core/photos.logic';
import { PhotosService } from '../../core/photos.service';
import { TripsService } from '../../core/trips.service';
import { isFutureMonth, monthOptions, parseCost, previousMonth, Trip, WouldReturn, yearOptions } from '../../core/trips.logic';
import { PlacePickerComponent } from '../places/place-picker.component';

/** Quantas fotos se podem juntar ao registar a viagem (as outras juntam-se depois, na viagem). */
const MAX_PHOTOS = 12;

interface Picked {
  id: number;
  file: File;
  preview: string;
}

@Component({
  selector: 'app-past-trip-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe, PlacePickerComponent],
  templateUrl: './past-trip.modal.html',
  styleUrl: './past-trip.modal.scss',
})
export class PastTripModal implements OnInit, OnDestroy {
  /** Com uma viagem, o formulário abre preenchido para a corrigir; sem ela, regista-se uma nova. */
  @Input() trip: Trip | null = null;

  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly trips = inject(TripsService);
  private readonly language = inject(LanguageService).language;
  private readonly photos = inject(PhotosService);

  // Fotos: ficam no telemóvel até se guardar a viagem; só aí é que se enviam.
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');
  private nextId = 1;
  protected readonly picked = signal<Picked[]>([]);
  protected readonly maxPhotos = MAX_PHOTOS;
  /** Enquanto se enviam as fotos: quantas já foram, e de quantas. */
  protected readonly sending = signal<{ done: number; total: number } | null>(null);

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
    addIcons({ addOutline, closeOutline });
  }

  ngOnInit(): void {
    const trip = this.trip;
    if (!trip) return;
    this.place.set({
      osmRef: trip.place.osmRef,
      name: trip.place.name,
      admin1: trip.place.admin1,
      countryCode: trip.place.countryCode,
      lat: trip.place.lat,
      lng: trip.place.lng,
    });
    const [year, month] = trip.startDate.split('-').map(Number);
    this.year.set(year);
    this.month.set(month);
    this.withPartner.set(trip.withPartner);
    this.wouldReturn.set(trip.wouldReturn);
    this.cost = trip.costEur === null ? '' : String(trip.costEur).replace('.', ',');
    this.note = trip.note ?? '';
  }

  ngOnDestroy(): void {
    for (const item of this.picked()) URL.revokeObjectURL(item.preview);
  }

  protected choosePhotos(): void {
    this.picker()?.nativeElement.click();
  }

  protected onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const room = MAX_PHOTOS - this.picked().length;
    const good = files.filter((file) => checkFile(file) === 'ok').slice(0, Math.max(0, room));
    if (!good.length) {
      if (files.length) this.error.set('photos.errors.notImage');
      return;
    }
    this.error.set(null);
    this.picked.update((list) => [...list, ...good.map((file) => ({ id: this.nextId++, file, preview: URL.createObjectURL(file) }))]);
  }

  protected removePhoto(item: Picked): void {
    URL.revokeObjectURL(item.preview);
    this.picked.update((list) => list.filter((candidate) => candidate.id !== item.id));
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
    let tripId: string | null = null;
    try {
      const input = {
        place,
        year: this.year(),
        month: this.month(),
        withPartner: this.withPartner(),
        wouldReturn: this.wouldReturn(),
        costEur: cost,
        note: this.note.trim() || null,
      };
      if (this.trip) await this.trips.updatePastTrip(this.trip, input);
      else tripId = await this.trips.addPastTrip(input);
    } catch {
      this.saving.set(false);
      return this.fail('trip.form.errors.save');
    }
    // A viagem já está guardada; as fotos seguem-se, uma a uma (se alguma falhar, a viagem não se perde).
    let failed = 0;
    if (tripId && this.picked().length) {
      const files = this.picked().map((item) => item.file);
      this.sending.set({ done: 0, total: files.length });
      for (const file of files) {
        try {
          await this.photos.upload(tripId, file);
        } catch {
          failed++;
        }
        this.sending.update((state) => (state ? { ...state, done: state.done + 1 } : state));
      }
    }
    await this.modalCtrl.dismiss({ saved: true });
    const toast = await this.toasts.create({
      message: failed
        ? this.transloco.translate('trip.form.photosFailed', { count: failed })
        : this.transloco.translate(this.trip ? 'trip.form.updated' : 'trip.form.saved'),
      duration: failed ? 4200 : 2200,
      position: 'top',
    });
    await toast.present();
  }

  private fail(key: string): void {
    this.error.set(key);
  }
}
