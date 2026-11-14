import { Component, HostListener, Input, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { PhotosService } from '../../core/photos.service';
import { buildSlides, nextPosition, previousPosition, StoryPosition, tapAction } from '../../core/stories.logic';
import { StoriesService } from '../../core/stories.service';
import { Trip } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripFlowService } from '../trips/trip-flow.service';
import { TripLabels } from '../trips/trip-labels.service';

/** Quanto dura cada ecrã de uma história. */
const SLIDE_MS = 5000;
/** Um toque que dura mais do que isto é "segurar": pausa em vez de passar. */
const HOLD_MS = 220;

/**
 * As viagens como histórias, em ecrã inteiro: tocar à direita passa, à esquerda volta, segurar pausa,
 * deslizar para baixo fecha. Cada viagem mostra as suas fotos e, no fim, o cartão com a nota.
 */
@Component({
  selector: 'app-stories-modal',
  imports: [IonIcon, TranslocoPipe],
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
  protected readonly slideMs = SLIDE_MS;

  protected readonly at = signal<StoryPosition>({ group: 0, slide: 0 });
  protected readonly held = signal(false);

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
  /** A foto grande (ou a miniatura, enquanto a grande não chega). Sem link, o tempo não corre. */
  protected readonly imageUrl = computed(() => {
    const photo = this.photo();
    return photo ? (this.photos.fullUrl(photo) ?? this.photos.thumbUrl(photo)) : null;
  });
  protected readonly waiting = computed(() => this.slide()?.kind === 'photo' && !this.imageUrl());

  constructor() {
    addIcons({ closeOutline });

    // Pede os links da foto que se vê e da seguinte, para passar sem esperar.
    effect(() => {
      const groups = this.groups();
      const at = this.at();
      const here = groups[at.group];
      if (!here) return;
      const wanted = here.slides.slice(at.slide, at.slide + 2).flatMap((slide) => (slide.kind === 'photo' ? [slide.photoId] : []));
      const list = this.photos.photosOf(here.trip.id).filter((photo) => wanted.includes(photo.id));
      untracked(() => {
        void this.photos.ensureThumbs(here.trip.id);
        void this.photos.ensureFull(list);
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
    if (target) this.at.set(target);
    else this.close();
  }

  protected previous(): void {
    this.at.set(previousPosition(this.at(), this.counts()));
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
