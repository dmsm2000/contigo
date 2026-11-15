import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { PlaceCandidate } from '../../core/geocoder';
import { LanguageService } from '../../core/language.service';
import { PlaceImageService } from '../../core/place-image.service';
import { MinStay, Suggestion } from '../../core/suggestions';
import { MIN_STAYS, nearestOrigin, normalizeLink } from '../../core/wishlist.logic';
import { Stars, WishlistService } from '../../core/wishlist.service';
import { PlacePickerComponent } from '../places/place-picker.component';
import { MonthPickerComponent } from './month-picker.component';
import { StarsComponent } from './stars.component';

/** Juntar um sítio à lista "Por ir". Pode vir já preenchido com uma sugestão. */
@Component({
  selector: 'app-add-wish-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe, PlacePickerComponent, StarsComponent, MonthPickerComponent],
  templateUrl: './add-wish.modal.html',
  styleUrl: './add-wish.modal.scss',
})
export class AddWishModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly wishlist = inject(WishlistService);
  private readonly images = inject(PlaceImageService);
  private readonly language = inject(LanguageService).language;

  /** Quando se vem de uma sugestão, o sítio já está escolhido. */
  @Input() suggestion: Suggestion | null = null;

  protected readonly place = signal<PlaceCandidate | null>(null);
  protected readonly stars = signal<Stars>(2);
  protected readonly minStay = signal<MinStay | null>(null);
  protected readonly minStays = MIN_STAYS;
  protected readonly bestMonths = signal<number[] | null>(null);
  protected link = '';
  protected note = '';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** A que distância fica, a partir da casa mais perto. */
  protected readonly distance = computed(() => {
    const place = this.place();
    return place && place.lat !== null && place.lng !== null ? nearestOrigin([place.lng, place.lat]) : null;
  });

  constructor() {
    addIcons({ closeOutline });
  }

  ngOnInit(): void {
    const suggestion = this.suggestion;
    if (!suggestion) return;
    this.place.set({
      osmRef: null,
      name: suggestion.name,
      admin1: suggestion.admin1,
      countryCode: suggestion.countryCode,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
    this.minStay.set(suggestion.minStay);
    // Uma sugestão também ganha a sua imagem.
    void this.images.find(suggestion, this.language()).then((found) => {
      const current = this.place();
      if (current && current.name === suggestion.name) this.place.set({ ...current, imageUrl: found?.url ?? null, imageCredit: found?.credit ?? null });
    });
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected setPlace(place: PlaceCandidate | null): void {
    this.place.set(place);
    this.error.set(null);
  }

  protected toggleMinStay(option: MinStay): void {
    // Tocar outra vez na mesma opção tira-a: é opcional.
    this.minStay.update((current) => (current === option ? null : option));
  }

  protected async save(): Promise<void> {
    const place = this.place();
    if (!place) return this.fail('wish.form.errors.place');
    const link = normalizeLink(this.link);
    if (link === 'invalid') return this.fail('wish.form.errors.link');

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.wishlist.add(place, {
        stars: this.stars(),
        note: this.note.trim() || null,
        link,
        minStay: this.minStay(),
        bestMonths: this.bestMonths(),
      });
    } catch {
      this.saving.set(false);
      return this.fail('wish.form.errors.save');
    }
    await this.modalCtrl.dismiss({ saved: true });
    const toast = await this.toasts.create({
      message: this.transloco.translate('wish.form.saved', { place: place.name }),
      duration: 2200,
      position: 'top',
    });
    await toast.present();
  }

  private fail(key: string): void {
    this.error.set(key);
  }
}
