import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeOutline, locationOutline, searchOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { GeocoderService, PlaceCandidate } from '../../core/geocoder';
import { LanguageService } from '../../core/language.service';
import { placeImageUrl } from '../../core/place-image.service';
import { ProfileService } from '../../core/profile.service';
import { MinStay } from '../../core/suggestions';
import { tileColors } from '../../core/trips.logic';
import { WishMissing, wishMissing } from '../../core/wish-readiness.logic';
import { MIN_STAYS, WishlistItem } from '../../core/wishlist.logic';
import { Stars, WishlistService } from '../../core/wishlist.service';
import { MonthPickerComponent } from './month-picker.component';
import { StarsComponent } from './stars.component';

/**
 * O assistente "Preencher": passa pelos sítios por ir a que falta algo (duração, estrelas, altura ideal, localização),
 * um de cada vez, só com o que falta. Com `placeId` trata só desse sítio.
 */
@Component({
  selector: 'app-complete-wishes-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe, MonthPickerComponent, StarsComponent],
  templateUrl: './complete-wishes.modal.html',
  styleUrl: './complete-wishes.modal.scss',
})
export class CompleteWishesModal implements OnInit, OnDestroy {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly geocoder = inject(GeocoderService);
  private readonly language = inject(LanguageService).language;
  protected readonly wishlist = inject(WishlistService);

  /** Para tratar só de um sítio (por exemplo, o que acabou de ser sorteado). */
  @Input() placeId: string | null = null;

  protected readonly minStays = MIN_STAYS;
  /** Os sítios a tratar, fixados ao abrir (para não desaparecerem da fila enquanto se preenche). */
  private readonly queue = signal<string[]>([]);
  protected readonly index = signal(0);
  protected readonly filled = signal(0);
  protected readonly saving = signal(false);

  protected readonly minStay = signal<MinStay | null>(null);
  protected readonly months = signal<number[] | null>(null);
  protected readonly stars = signal<Stars | null>(null);
  protected readonly coords = signal<{ lat: number; lng: number; label: string } | null>(null);
  protected query = '';
  protected readonly results = signal<PlaceCandidate[]>([]);
  protected readonly searching = signal(false);
  private searchAbort: AbortController | null = null;

  private readonly userIds = computed(() => [this.auth.userId(), this.profile.partner()?.id].filter((id): id is string => !!id));
  protected readonly partnerName = computed(() => this.profile.partner()?.name || this.transloco.translate('wish.theOther'));

  protected readonly item = computed<WishlistItem | null>(() => {
    const id = this.queue()[this.index()];
    return this.wishlist.items().find((candidate) => candidate.place.id === id) ?? null;
  });
  protected readonly missing = computed<WishMissing[]>(() => {
    const item = this.item();
    return item ? this.fillable(item) : [];
  });
  /** A outra pessoa ainda não deu estrelas a este sítio (só ela as pode dar). */
  protected readonly waitingForPartner = computed(() => {
    const item = this.item();
    const partner = this.profile.partner()?.id;
    return !!item && !!partner && !item.stars[partner];
  });
  protected readonly total = computed(() => this.queue().length);
  protected readonly finished = computed(() => this.total() === 0 || this.index() >= this.total());
  protected readonly hasChanges = computed(
    () => this.minStay() !== null || this.months() !== null || this.stars() !== null || this.coords() !== null,
  );
  protected readonly isLast = computed(() => this.index() >= this.total() - 1);
  protected readonly photo = computed(() => placeImageUrl(this.item()?.place.imagePath));
  protected readonly tile = computed(() => {
    const { from, to } = tileColors(this.item()?.place.name ?? '');
    return `linear-gradient(135deg, ${from}, ${to})`;
  });

  constructor() {
    addIcons({ checkmarkCircleOutline, closeOutline, locationOutline, searchOutline });
  }

  ngOnInit(): void {
    const ids = this.wishlist
      .sorted()
      .filter((item) => (this.placeId ? item.place.id === this.placeId : true) && this.fillable(item).length > 0)
      .map((item) => item.place.id);
    this.queue.set(ids);
    this.enter();
  }

  ngOnDestroy(): void {
    this.searchAbort?.abort();
  }

  /** O que falta e que EU posso preencher: as estrelas da outra pessoa não. */
  private fillable(item: WishlistItem): WishMissing[] {
    const me = this.auth.userId();
    return wishMissing(item, this.userIds()).filter((field) => field !== 'stars' || (me !== null && !item.stars[me]));
  }

  /** Arruma o rascunho quando se chega a um sítio. */
  private enter(): void {
    this.minStay.set(null);
    this.months.set(null);
    this.stars.set(null);
    this.coords.set(null);
    this.results.set([]);
    this.query = this.item()?.place.name ?? '';
  }

  protected close(): void {
    void this.modalCtrl.dismiss({ filled: this.filled() });
  }

  protected toggleMinStay(option: MinStay): void {
    this.minStay.update((current) => (current === option ? null : option));
  }

  protected async search(): Promise<void> {
    const text = this.query.trim();
    if (text.length < 2) return;
    this.searchAbort?.abort();
    this.searchAbort = new AbortController();
    this.searching.set(true);
    try {
      const found = await this.geocoder.search(text, this.language(), this.searchAbort.signal);
      this.results.set(found.filter((candidate) => candidate.lat !== null && candidate.lng !== null).slice(0, 5));
    } catch {
      this.results.set([]);
    }
    this.searching.set(false);
  }

  protected where(candidate: PlaceCandidate): string {
    return [candidate.admin1, candidate.countryCode].filter(Boolean).join(' · ');
  }

  protected pickLocation(candidate: PlaceCandidate): void {
    if (candidate.lat === null || candidate.lng === null) return;
    this.coords.set({ lat: candidate.lat, lng: candidate.lng, label: candidate.name });
  }

  protected async saveAndNext(): Promise<void> {
    const item = this.item();
    if (!item || this.saving()) return;
    this.saving.set(true);
    try {
      const coords = this.coords();
      await this.wishlist.completePlace(item.place.id, {
        ...(this.minStay() ? { minStay: this.minStay()! } : {}),
        ...(this.months() ? { bestMonths: this.months()! } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      if (this.stars()) await this.wishlist.setMyStars(item, this.stars()!);
      this.filled.update((count) => count + 1);
    } catch {
      this.saving.set(false);
      const toast = await this.toasts.create({ message: this.transloco.translate('wish.errors.save'), duration: 2400, position: 'top' });
      await toast.present();
      return;
    }
    this.saving.set(false);
    this.next();
  }

  protected next(): void {
    this.index.update((value) => value + 1);
    this.enter();
  }
}
