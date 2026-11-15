import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AlertController, IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeOutline, diceOutline, heartOutline, sparklesOutline } from 'ionicons/icons';
import { FreeWindow, formatWeekdays, formatWindow } from '../../core/availability.logic';
import { AvailabilityService } from '../../core/availability.service';
import { drawPool, reelDelays, reelFrames, summarizePool } from '../../core/draw.logic';
import { DrawService } from '../../core/draw.service';
import { LanguageService } from '../../core/language.service';
import { PlaceImageService, placeImageUrl } from '../../core/place-image.service';
import { attachPlaceImage } from '../../core/places.service';
import { SupabaseService } from '../../core/supabase.service';
import { ProfileService } from '../../core/profile.service';
import { SUGGESTIONS } from '../../core/suggestions';
import { formatTripDate, initialOf, placeSubtitle, tileColors, Trip } from '../../core/trips.logic';
import { nearestOrigin, pick, PoolEntry } from '../../core/wishlist.logic';
import { WishlistService } from '../../core/wishlist.service';
import { TripDetailModal } from '../trips/trip-detail.modal';

type Phase = 'setup' | 'rolling' | 'result';

interface Outcome {
  entry: PoolEntry;
  window: FreeWindow | null;
  /** A viagem guardada; nula se o sorteio saiu mas não se conseguiu guardar. */
  trip: Trip | null;
}

interface Piece {
  x: number;
  y: number;
  r: number;
  delay: number;
  color: string;
}

/** Quantos frames tem a roleta antes de parar. */
const REEL_FRAMES = 18;
const CONFETTI_COLORS = ['#c2306f', '#ee5a62', '#f7a55a', '#3fa864', '#fbead3', '#ffffff'];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** O sorteio do mês: escolhe a janela, sorteia com a cerimónia da roleta e guarda a viagem sorteada. */
@Component({
  selector: 'app-draw-modal',
  imports: [IonContent, IonFooter, IonIcon, TranslocoPipe],
  templateUrl: './draw.modal.html',
  styleUrl: './draw.modal.scss',
})
export class DrawModal implements OnDestroy {
  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly availability = inject(AvailabilityService);
  private readonly profile = inject(ProfileService);
  protected readonly wishlist = inject(WishlistService);
  protected readonly draws = inject(DrawService);
  private readonly images = inject(PlaceImageService);
  private readonly supabase = inject(SupabaseService).client;
  /** A imagem encontrada para o sítio sorteado (ainda por guardar), enquanto a viagem não a tem. */
  private readonly foundImage = signal<string | null>(null);

  private destroyed = false;

  protected readonly phase = signal<Phase>('setup');
  protected readonly reelName = signal('');
  protected readonly reelKey = signal(0);
  protected readonly outcome = signal<Outcome | null>(null);
  protected readonly confetti = signal<Piece[]>([]);
  protected readonly busy = signal(false);

  /** A janela escolhida: `undefined` é "a próxima"; `''` é "qualquer data". */
  private readonly chosenStart = signal<string | undefined>(undefined);
  protected readonly windows = computed(() =>
    this.availability.windows().slice(0, 6).map((window) => ({
      ...window,
      label: formatWindow(window, this.language()),
      weekdays: formatWeekdays(window, this.language()),
    })),
  );
  protected readonly window = computed<FreeWindow | null>(() => {
    const start = this.chosenStart();
    if (start === '') return null;
    if (start === undefined) return this.availability.next();
    return this.availability.windows().find((window) => window.start === start) ?? null;
  });
  protected readonly anyDate = computed(() => this.window() === null);

  protected readonly pool = computed(() =>
    drawPool(this.wishlist.items(), this.wishlist.suggestions(), {
      window: this.window(),
      includeSuggestions: this.wishlist.includeSuggestions(),
      vetoed: this.draws.vetoedEntries(),
    }),
  );
  protected readonly summary = computed(() => summarizePool(this.pool()));
  protected readonly chancePercent = computed(() => Math.round(this.summary().surpriseChance * 100));

  protected readonly partnerName = computed(() => this.profile.partner()?.name || this.transloco.translate('wish.theOther'));
  protected readonly hasPartner = computed(() => this.profile.partner() !== null);

  /** O sítio do resultado, com o que se mostra dele. */
  protected readonly shown = computed(() => {
    const outcome = this.outcome();
    if (!outcome) return null;
    const suggestion = SUGGESTIONS.find((item) => `suggestion:${item.id}` === outcome.entry.id) ?? null;
    const place = outcome.trip?.place ?? null;
    const lat = place?.lat ?? suggestion?.lat ?? null;
    const lng = place?.lng ?? suggestion?.lng ?? null;
    const admin1 = place?.admin1 ?? suggestion?.admin1 ?? null;
    const countryCode = place?.countryCode ?? suggestion?.countryCode ?? null;
    return {
      name: outcome.entry.name,
      where: placeSubtitle({ admin1, countryCode }, this.language()),
      kind: outcome.entry.kind,
      when: outcome.trip
        ? formatTripDate(outcome.trip, this.language())
        : outcome.window
          ? formatWindow(outcome.window, this.language())
          : '',
      distance: lat !== null && lng !== null ? nearestOrigin([lng, lat]) : null,
      initial: initialOf(outcome.entry.name),
      tile: this.tile(outcome.entry.name),
      image: placeImageUrl(place?.imagePath) ?? this.foundImage(),
      placeId: outcome.trip?.placeId ?? null,
    };
  });
  /** Se o sítio sorteado já está na lista "Por ir" (ou acabou de ir para lá). */
  protected readonly onWishlist = computed(() => {
    const placeId = this.shown()?.placeId;
    return placeId ? this.wishlist.items().some((item) => item.place.id === placeId) : false;
  });

  constructor() {
    addIcons({ checkmarkCircleOutline, closeOutline, diceOutline, heartOutline, sparklesOutline });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected chooseWindow(start: string): void {
    this.chosenStart.set(start);
  }

  protected setSurprises(): void {
    this.wishlist.setIncludeSuggestions(!this.wishlist.includeSuggestions());
  }

  protected tile(name: string): string {
    const { from, to } = tileColors(name);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  protected async openActive(trip: Trip): Promise<void> {
    const modal = await this.modalCtrl.create({ component: TripDetailModal, componentProps: { tripId: trip.id }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async roll(): Promise<void> {
    if (this.busy()) return;
    const pool = this.pool();
    const entry = pick(pool);
    if (!entry) return;

    this.busy.set(true);
    this.phase.set('rolling');
    const window = this.window();
    // Guarda-se enquanto a roleta gira: se falhar, o resultado fica na mesma e pode tentar-se outra vez.
    const saving = this.draws.saveDraw(entry, window).catch(() => null);
    // Também se procura uma imagem do sítio sorteado, ao mesmo tempo (sem a esperar mais do que 2,5 s).
    this.foundImage.set(null);
    const lookup = Promise.race([this.images.find(this.entryPlace(entry), this.language()).catch(() => null), sleep(2500).then(() => null)]);
    await this.spin(pool.map((candidate) => candidate.name), entry.name);
    const trip = await saving;
    const found = await lookup;
    if (this.destroyed) return;
    if (found && trip && !trip.place.imagePath) {
      this.foundImage.set(found.url);
      void attachPlaceImage(this.supabase, this.images, trip.placeId, found);
    }

    this.outcome.set({ entry, window, trip });
    this.phase.set('result');
    this.busy.set(false);
    this.celebrate();
  }

  /** O nome e as coordenadas do sítio sorteado (da lista "Por ir" ou da sugestão), para lhe procurar a imagem. */
  private entryPlace(entry: PoolEntry): { name: string; lat: number | null; lng: number | null } {
    const suggestion = SUGGESTIONS.find((item) => `suggestion:${item.id}` === entry.id);
    if (suggestion) return suggestion;
    const wish = this.wishlist.items().find((item) => `wish:${item.place.id}` === entry.id);
    return wish ? wish.place : { name: entry.name, lat: null, lng: null };
  }

  protected async retrySave(): Promise<void> {
    const outcome = this.outcome();
    if (!outcome || outcome.trip || this.busy()) return;
    this.busy.set(true);
    try {
      const trip = await this.draws.saveDraw(outcome.entry, outcome.window);
      this.outcome.set({ ...outcome, trip });
    } catch {
      await this.toast('draw.saveFailed');
    }
    this.busy.set(false);
  }

  protected async confirmVeto(): Promise<void> {
    const trip = this.outcome()?.trip;
    if (!trip || this.draws.myVetoUsed()) return;
    const t = (key: string, params?: Record<string, unknown>) => this.transloco.translate(key, params);
    const alert = await this.alerts.create({
      header: t('draw.vetoConfirmTitle'),
      message: t('draw.vetoConfirmText', { place: trip.place.name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('draw.vetoConfirm'), role: 'destructive', handler: () => void this.veto(trip) },
      ],
    });
    await alert.present();
  }

  protected async addToWishlist(): Promise<void> {
    const placeId = this.shown()?.placeId;
    const name = this.shown()?.name ?? '';
    if (!placeId) return;
    try {
      await this.wishlist.addExisting(placeId);
      await this.toast('draw.addedToWishlist', { place: name });
    } catch {
      await this.toast('wish.errors.save');
    }
  }

  private async veto(trip: Trip): Promise<void> {
    try {
      await this.draws.veto(trip);
    } catch {
      await this.toast('draw.vetoError');
      return;
    }
    // Volta ao princípio, já sem esta opção na rotação, para sortearem outra vez.
    this.outcome.set(null);
    this.confetti.set([]);
    this.phase.set('setup');
    await this.toast('draw.vetoDone');
  }

  /** A roleta: nomes a passar cada vez mais devagar até parar no sorteado. Sem movimento, mostra-o logo. */
  private async spin(names: readonly string[], winner: string): Promise<void> {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.reelName.set(winner);
      await sleep(500);
      return;
    }
    const frames = reelFrames(names, winner, REEL_FRAMES);
    const delays = reelDelays(REEL_FRAMES);
    for (let index = 0; index < frames.length; index++) {
      if (this.destroyed) return;
      this.reelName.set(frames[index]);
      this.reelKey.update((key) => key + 1);
      await sleep(delays[index]);
    }
    await sleep(350);
  }

  private celebrate(): void {
    this.confetti.set(
      Array.from({ length: 44 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 44 + Math.random() * 0.4;
        const force = 120 + Math.random() * 190;
        return {
          x: Math.round(Math.cos(angle) * force),
          y: Math.round(Math.sin(angle) * force - 120),
          r: Math.round(Math.random() * 720 - 360),
          delay: Math.round(Math.random() * 160),
          color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        };
      }),
    );
  }

  private async toast(key: string, params?: Record<string, unknown>): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key, params), duration: 2400, position: 'top' });
    await toast.present();
  }
}
