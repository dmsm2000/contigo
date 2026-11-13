import { Component, ElementRef, Input, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircle,
  closeOutline,
  imagesOutline,
  refreshOutline,
} from 'ionicons/icons';
import { LanguageService } from '../../core/language.service';
import { chunk } from '../../core/photos.logic';
import { PhotoError, PhotosService } from '../../core/photos.service';
import { formatTripDate } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';

type Status = 'waiting' | 'working' | 'done' | 'error';

interface Item {
  id: number;
  file: File;
  preview: string;
  status: Status;
  /** O motivo, se falhou: uma chave de tradução. */
  reason: string | null;
}

/** Quantas fotos se enviam ao mesmo tempo: poucas, para não esgotar o telemóvel nem a rede. */
const PARALLEL = 2;

/** Juntar fotos a uma viagem: escolhem-se, comprimem-se no telemóvel e enviam-se. */
@Component({
  selector: 'app-add-photos-modal',
  imports: [IonContent, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './add-photos.modal.html',
  styleUrl: './add-photos.modal.scss',
})
export class AddPhotosModal implements OnInit, OnDestroy {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly photos = inject(PhotosService);
  private readonly trips = inject(TripsService);

  /** A viagem a que se juntam as fotos; sem ela, escolhe-se no ecrã. */
  @Input() tripId: string | null = null;

  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private nextId = 1;

  protected readonly chosenTrip = signal('');
  protected readonly items = signal<Item[]>([]);
  protected readonly options = computed(() =>
    this.trips.trips().map((trip) => ({
      id: trip.id,
      label: `${trip.place.name} · ${formatTripDate(trip, this.language())}`,
    })),
  );
  protected readonly started = computed(() => this.items().length > 0);
  protected readonly working = computed(() => this.items().some((item) => item.status === 'waiting' || item.status === 'working'));
  protected readonly doneCount = computed(() => this.items().filter((item) => item.status === 'done').length);
  protected readonly failedCount = computed(() => this.items().filter((item) => item.status === 'error').length);
  protected readonly progress = computed(() => {
    const total = this.items().length;
    return total ? Math.round(((this.doneCount() + this.failedCount()) / total) * 100) : 0;
  });

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircle, closeOutline, imagesOutline, refreshOutline });
  }

  ngOnInit(): void {
    this.chosenTrip.set(this.tripId ?? this.trips.trips()[0]?.id ?? '');
  }

  ngOnDestroy(): void {
    for (const item of this.items()) URL.revokeObjectURL(item.preview);
  }

  protected close(): void {
    void this.modalCtrl.dismiss({ added: this.doneCount() });
  }

  protected choose(): void {
    this.picker().nativeElement.click();
  }

  protected onTrip(event: Event): void {
    this.chosenTrip.set((event.target as HTMLSelectElement).value);
  }

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Limpa-se para se poder escolher as mesmas fotos outra vez, se for preciso.
    input.value = '';
    if (!files.length || !this.chosenTrip()) return;

    const added: Item[] = files.map((file) => ({
      id: this.nextId++,
      file,
      preview: URL.createObjectURL(file),
      status: 'waiting',
      reason: null,
    }));
    this.items.update((items) => [...items, ...added]);
    await this.run(added);
  }

  protected async retry(item: Item): Promise<void> {
    this.patch(item.id, { status: 'waiting', reason: null });
    await this.run([item]);
  }

  private async run(items: readonly Item[]): Promise<void> {
    const tripId = this.chosenTrip();
    for (const group of chunk(items, PARALLEL)) {
      await Promise.all(group.map((item) => this.send(tripId, item)));
    }
    if (!this.working() && !this.failedCount()) {
      await this.finish();
    }
  }

  private async send(tripId: string, item: Item): Promise<void> {
    this.patch(item.id, { status: 'working' });
    try {
      await this.photos.upload(tripId, item.file);
      this.patch(item.id, { status: 'done' });
    } catch (error) {
      const reason = error instanceof PhotoError ? error.reason : 'upload';
      this.patch(item.id, { status: 'error', reason: `photos.errors.${reason}` });
    }
  }

  private patch(id: number, changes: Partial<Item>): void {
    this.items.update((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  /** Tudo enviado sem falhas: fecha sozinho e diz quantas ficaram. */
  private async finish(): Promise<void> {
    const count = this.doneCount();
    await this.modalCtrl.dismiss({ added: count });
    const toast = await this.toasts.create({
      message: this.transloco.translate(count === 1 ? 'photos.saved_one' : 'photos.saved_other', { count }),
      duration: 2200,
      position: 'top',
    });
    await toast.present();
  }
}
