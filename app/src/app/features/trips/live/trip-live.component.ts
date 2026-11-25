import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { IonIcon, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  add,
  bedOutline,
  airplaneOutline,
  busOutline,
  carOutline,
  checkmarkCircle,
  chevronDownOutline,
  documentTextOutline,
  ellipseOutline,
  eyeOutline,
  imageOutline,
  cloudOfflineOutline,
  listOutline,
  navigateOutline,
  openOutline,
  phonePortraitOutline,
  restaurantOutline,
  ticketOutline,
  trainOutline,
  walkOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth.service';
import { ClockService } from '../../../core/clock.service';
import { ConnectivityService } from '../../../core/connectivity.service';
import { DocCacheService } from '../../../core/doc-cache.service';
import { ItineraryCategory, ItineraryItem } from '../../../core/itinerary.logic';
import { ItineraryService } from '../../../core/itinerary.service';
import { LanguageService } from '../../../core/language.service';
import { nextTransport } from '../../../core/transport-live.logic';
import { Leg, LegMode } from '../../../core/trip-plan.logic';
import { TripPlanService } from '../../../core/trip-plan.service';
import { isImage, TripDoc } from '../../../core/trip-docs.logic';
import { TripDocsService } from '../../../core/trip-docs.service';
import {
  buildLiveView,
  durationText,
  firstTimed,
  itemsOfDay,
  LiveEntry,
  liveDayOf,
  mapUrlOf,
} from '../../../core/trip-live.logic';
import { formatCost, LOCALES, Trip } from '../../../core/trips.logic';
import { TripFlowService } from '../trip-flow.service';

const ICONS: Record<ItineraryCategory, string> = {
  see: 'eye-outline',
  eat: 'restaurant-outline',
  do: 'walk-outline',
  move: 'navigate-outline',
  rest: 'bed-outline',
  other: 'ellipse-outline',
};

/**
 * A viagem em curso: com a viagem a decorrer, é o guia do dia. Mostra o que está a acontecer agora, o que vem
 * a seguir (com a contagem decrescente), o dia todo ao pormenor e os documentos à mão. O estado de cada atividade
 * (feita, agora, a seguir) vem só da hora: não há nada a marcar.
 */
@Component({
  selector: 'app-trip-live',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './trip-live.component.html',
  styleUrl: './trip-live.component.scss',
})
export class TripLiveComponent {
  readonly trip = input.required<Trip>();

  private readonly itineraries = inject(ItineraryService);
  private readonly docs = inject(TripDocsService);
  private readonly plan = inject(TripPlanService);
  private readonly flow = inject(TripFlowService);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly clock = inject(ClockService);
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly saved = inject(DocCacheService);

  /** O instante real, de segundo a segundo, para os contadores andarem. */
  private readonly tick = signal(Date.now());
  protected readonly nowMs = computed(() => this.clock.at(this.tick()).getTime());
  /** Só no desenvolvimento: há uma hora simulada no lugar da real (ver ClockService). */
  protected readonly simulated = this.clock.offsetMs !== 0;
  protected readonly clockText = computed(() => {
    const now = new Date(this.nowMs());
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  protected readonly loaded = this.itineraries.loaded;
  /** Sem rede (ou sem conseguir ir buscar o roteiro): o que se vê é a cópia guardada da última vez que houve. */
  protected readonly offline = computed(
    () => !this.connectivity.online() || this.auth.stale() || this.itineraries.loadFailed(),
  );
  protected readonly today = computed(() => liveDayOf(this.trip(), new Date(this.nowMs())));
  protected readonly accepted = computed(() => this.itineraries.of(this.trip().id).accepted);
  protected readonly dots = computed(() =>
    Array.from({ length: this.today()?.total ?? 0 }, (_, index) => index + 1),
  );
  protected readonly view = computed(() => {
    const today = this.today();
    const accepted = this.accepted();
    return today && accepted
      ? buildLiveView(itemsOfDay(accepted.items, today.day), today.date, this.nowMs())
      : null;
  });
  /** A primeira atividade de amanhã, para quando o dia de hoje já acabou. */
  protected readonly tomorrow = computed(() => {
    const today = this.today();
    const accepted = this.accepted();
    return today && accepted && today.day < today.total
      ? firstTimed(itemsOfDay(accepted.items, today.day + 1))
      : null;
  });
  /** O transporte a seguir (ou a caminho), com a hora da partida no fuso certo. */
  protected readonly transport = computed(() =>
    nextTransport(this.plan.legsOf(this.trip().id), this.nowMs(), Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  protected readonly files = computed(() => this.docs.docsOf(this.trip().id));
  /** "quinta-feira, 3 de dezembro". */
  protected readonly dateText = computed(() => {
    const today = this.today();
    if (!today) return '';
    const [year, month, day] = today.date.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALES[this.language()], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  });

  /** A atividade aberta na lista do dia (só uma de cada vez, para a lista não crescer sem fim). */
  protected readonly expandedId = signal<string | null>(null);
  protected readonly openingId = signal<string | null>(null);

  constructor() {
    addIcons({
      add,
      airplaneOutline,
      bedOutline,
      busOutline,
      carOutline,
      checkmarkCircle,
      chevronDownOutline,
      cloudOfflineOutline,
      documentTextOutline,
      ellipseOutline,
      eyeOutline,
      imageOutline,
      listOutline,
      navigateOutline,
      openOutline,
      phonePortraitOutline,
      restaurantOutline,
      ticketOutline,
      trainOutline,
      walkOutline,
    });
    const timer = setInterval(() => this.tick.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected icon(category: ItineraryCategory): string {
    return ICONS[category];
  }

  protected until(ms: number | null): string {
    return durationText(ms ?? 0);
  }

  /** "13:45–15:15" (ou só a hora de início). */
  protected time(item: ItineraryItem): string {
    return item.startTime
      ? item.endTime
        ? `${item.startTime}–${item.endTime}`
        : item.startTime
      : '';
  }

  /** O nome do sítio, a não ser que seja o mesmo que o título (para não aparecer duas vezes). */
  protected place(item: ItineraryItem): string | null {
    return item.placeName && item.placeName.trim().toLowerCase() !== item.title.trim().toLowerCase()
      ? item.placeName
      : null;
  }

  protected mapUrl(item: ItineraryItem): string | null {
    return mapUrlOf(item, this.trip().place.name);
  }

  protected money(value: number): string {
    return formatCost(value, this.language());
  }

  protected toggle(entry: LiveEntry): void {
    this.expandedId.update((id) => (id === entry.item.id ? null : entry.item.id));
  }

  protected modeIcon(mode: LegMode): string {
    return { car: 'car-outline', train: 'train-outline', bus: 'bus-outline', flight: 'airplane-outline', other: 'navigate-outline' }[mode];
  }

  /** "Comboio · Desde Madrid". */
  protected transportTitle(leg: Leg): string {
    const mode = this.transloco.translate(`plan.legs.modes.${leg.mode}`);
    return leg.origin ? `${mode} · ${this.transloco.translate('plan.legs.from', { origin: leg.origin })}` : mode;
  }

  /** "Ida · 16:30 → 20:45". */
  protected transportMeta(leg: Leg): string {
    const times = [leg.departsTime, leg.arrivesTime].filter(Boolean).join(' → ');
    return [this.transloco.translate(`plan.legs.directions.${leg.direction}`), times].filter(Boolean).join(' · ');
  }

  /** Os bilhetes ligados a uma deslocação. */
  protected ticketsOf(leg: Leg): TripDoc[] {
    return this.files().filter((doc) => doc.legId === leg.id);
  }

  protected docIcon(doc: TripDoc): string {
    return isImage(doc.mime) ? 'image-outline' : 'document-text-outline';
  }

  /** O ficheiro já está no telemóvel (abre sem rede). */
  protected isSaved(doc: TripDoc): boolean {
    return this.saved.has(doc.id);
  }

  protected newExpense(): void {
    void this.flow.openExpense(this.trip().id);
  }

  /** O roteiro completo, os documentos e as notas ficam todos na página da viagem. */
  protected openTrip(): void {
    void this.flow.openDetail(this.trip().id);
  }

  protected async openDoc(doc: TripDoc): Promise<void> {
    if (this.openingId()) return;
    this.openingId.set(doc.id);
    const result = await this.docs.open(doc);
    this.openingId.set(null);
    if (result !== 'opened') {
      const toast = await this.toasts.create({
        message: this.transloco.translate(
          result === 'offline' ? 'docs.openOffline' : 'docs.openFailed',
        ),
        duration: 2600,
        position: 'bottom',
      });
      await toast.present();
    }
  }
}
