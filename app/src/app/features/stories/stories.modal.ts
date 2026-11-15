import { Component, HostListener, Input, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { SettingsService } from '../../core/settings.service';
import { PhotosService } from '../../core/photos.service';
import { buildSlides, nextPosition, previousPosition, StoryPosition, tapAction } from '../../core/stories.logic';
import { StoriesService } from '../../core/stories.service';
import { Trip } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { PhotoImgComponent } from '../photos/photo-img.component';
import { TripFlowService } from '../trips/trip-flow.service';
import { TripLabels } from '../trips/trip-labels.service';

/** Um toque que dura mais do que isto é "segurar": pausa em vez de passar. */
const HOLD_MS = 220;

/**
 * As viagens como histórias, em ecrã inteiro: tocar à direita passa, à esquerda volta, segurar pausa,
 * deslizar para baixo fecha. Cada viagem mostra as suas fotos e, no fim, o cartão com a nota.
 */
@Component({
  selector: 'app-stories-modal',
  imports: [IonIcon, TranslocoPipe, PhotoImgComponent],
  templateUrl: './stories.modal.html',
  styleUrl: './stories.modal.scss',
})
export class StoriesModal implements OnInit {
  /** Os ids das viagens, pela ordem em que aparecem no Início, e por qual se começa. */
  @Input() tripIds: string[] = [];
  @Input() startAt = 0;

  private readonly modalCtrl = inject(ModalController);
  private readonly flow = inject(TripFlowService);
  private readonly tripsService = inject(TripsService);
  protected readonly photos = inject(PhotosService);
  protected readonly labels = inject(TripLabels);
  /** Quanto dura cada ecrã de uma história: escolhe-se nas Definições. */
  protected readonly slideMs = inject(SettingsService).storyMs;

  protected readonly at = signal<StoryPosition>({ group: 0, slide: 0 });
  protected readonly held = signal(false);
  /** Ao mudar de viagem: de onde entra a nova (null enquanto se fica na mesma, ou na primeira). */
  protected readonly entering = signal<'next' | 'previous' | null>(null);

  private readonly stories = inject(StoriesService);
  private pressedAt = 0;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private start: { x: number; y: number } | null = null;

  protected readonly groups = computed(() =>
    this.tripIds
      .map((id) => this.tripsService.done().find((trip) => trip.id === id))
      .filter((trip): trip is Trip => Boolean(trip))
      .map((trip) => ({
        trip,
        slides: buildSlides(
          this.photos.photosOf(trip.id).map((photo) => photo.id),
          Boolean(trip.note),
        ),
      })),
  );
  private readonly counts = computed(() => this.groups().map((group) => group.slides.length));

  protected readonly group = computed(() => this.groups()[this.at().group] ?? null);
  protected readonly slide = computed(() => this.group()?.slides[this.at().slide] ?? null);
  protected readonly photo = computed(() => {
    const slide = this.slide();
    return slide?.kind === 'photo' ? (this.photos.photosOf(this.group()!.trip.id).find((p) => p.id === slide.photoId) ?? null) : null;
  });
  /** A foto grande já chegou? Até lá o tempo não corre (a miniatura desfocada ocupa o lugar). */
  protected readonly ready = signal(false);
  protected readonly waiting = computed(() => this.slide()?.kind === 'photo' && !this.ready());

  constructor() {
    addIcons({ closeOutline });

    // Cada ecrã novo recomeça à espera da sua foto.
    effect(() => {
      this.at();
      untracked(() => this.ready.set(false));
    });

    // Põe na cache as fotos que se vêem a seguir: as próximas desta viagem e as primeiras da viagem seguinte.
    effect(() => {
      const groups = this.groups();
      const at = this.at();
      const here = groups[at.group];
      if (!here) return;
      const idsOf = (slides: typeof here.slides, from: number, count: number) =>
        slides.slice(from, from + count).flatMap((slide) => (slide.kind === 'photo' ? [slide.photoId] : []));
      const wanted: { tripId: string; ids: string[] }[] = [{ tripId: here.trip.id, ids: idsOf(here.slides, at.slide, 3) }];
      const next = groups[at.group + 1];
      if (next) wanted.push({ tripId: next.trip.id, ids: idsOf(next.slides, 0, 2) });
      untracked(() => {
        for (const { tripId, ids } of wanted) {
          void this.photos.warm(this.photos.photosOf(tripId).filter((photo) => ids.includes(photo.id)));
        }
      });
    });

    // Marca a viagem como vista quando se chega a ela.
    effect(() => {
      const trip = this.group()?.trip;
      if (trip) untracked(() => this.stories.markSeen(trip.id));
    });
  }

  ngOnInit(): void {
    this.at.set({ group: Math.max(0, Math.min(this.startAt, this.tripIds.length - 1)), slide: 0 });
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected next(): void {
    const target = nextPosition(this.at(), this.counts());
    if (target) this.move(target);
    else this.close();
  }

  protected previous(): void {
    this.move(previousPosition(this.at(), this.counts()));
  }

  /** Muda de ecrã; se mudar de viagem, a nova entra de lado (como no Instagram) em vez de aparecer de repente. */
  private move(target: StoryPosition): void {
    const from = this.at().group;
    this.entering.set(target.group === from ? null : target.group > from ? 'next' : 'previous');
    this.at.set(target);
  }

  /** O ecrã de uma barra de progresso: já passou, está a correr ou ainda vem. */
  protected barState(index: number): 'done' | 'active' | 'todo' {
    const current = this.at().slide;
    return index < current ? 'done' : index === current ? 'active' : 'todo';
  }

  protected openTrip(): void {
    const id = this.group()?.trip.id;
    if (!id) return;
    void this.modalCtrl.dismiss().then(() => this.flow.openDetail(id));
  }

  protected pressStart(event: PointerEvent): void {
    this.start = { x: event.clientX, y: event.clientY };
    this.pressedAt = Date.now();
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => this.held.set(true), HOLD_MS);
  }

  protected pressEnd(event: PointerEvent): void {
    clearTimeout(this.holdTimer);
    const start = this.start;
    this.start = null;
    this.held.set(false);
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Deslizar para baixo fecha.
    if (dy > 90 && Math.abs(dx) < 80) return this.close();
    // Um toque curto (sem arrastar) passa ou volta; segurar só pausava.
    if (Date.now() - this.pressedAt >= HOLD_MS || Math.hypot(dx, dy) > 20) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (tapAction(event.clientX - rect.left, rect.width) === 'previous') this.previous();
    else this.next();
  }

  protected pressCancel(): void {
    clearTimeout(this.holdTimer);
    this.start = null;
    this.held.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.previous();
    else if (event.key === 'Escape') this.close();
  }
}
