import { Component, computed, inject, input, signal } from '@angular/core';
import { IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { addOutline, attachOutline, documentTextOutline, ellipsisHorizontal, imageOutline, pinOutline } from 'ionicons/icons';
import { LanguageService } from '../../../core/language.service';
import { DocError, TripDocsService } from '../../../core/trip-docs.service';
import { formatSize, isImage, TripDoc } from '../../../core/trip-docs.logic';
import { LOCALES, Trip } from '../../../core/trips.logic';
import { DocModal, NoteModal } from './docs-modals';

/**
 * Os documentos da viagem: post-its com o que é importante e os ficheiros (bilhetes, reservas, seguros…).
 * Os ficheiros ficam num bucket privado; só os dois os veem.
 */
@Component({
  selector: 'app-trip-docs',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './trip-docs.component.html',
  styleUrl: './trip-docs.component.scss',
})
export class TripDocsComponent {
  readonly trip = input.required<Trip>();

  private readonly docs = inject(TripDocsService);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;

  protected readonly loaded = this.docs.loaded;
  protected readonly notes = computed(() => this.docs.notesOf(this.trip().id));
  protected readonly files = computed(() => this.docs.docsOf(this.trip().id));
  protected readonly uploading = signal(0);
  protected readonly openingId = signal<string | null>(null);

  constructor() {
    addIcons({ addOutline, attachOutline, documentTextOutline, ellipsisHorizontal, imageOutline, pinOutline });
  }

  protected icon(doc: TripDoc): string {
    return isImage(doc.mime) ? 'image-outline' : 'document-text-outline';
  }

  /** "PDF · 180 KB · 12 nov". */
  protected meta(doc: TripDoc): string {
    const kind = isImage(doc.mime) ? this.transloco.translate('docs.file.image') : 'PDF';
    const day = new Intl.DateTimeFormat(LOCALES[this.language()], { day: 'numeric', month: 'short' }).format(new Date(doc.createdAt));
    return `${kind} · ${formatSize(doc.sizeBytes, LOCALES[this.language()])} · ${day}`;
  }

  /** Uma ligeira inclinação, alternada, para os post-its parecerem colados à mão. */
  protected tilt(index: number): string {
    return `${[-1.2, 0.9, -0.6, 1.3][index % 4]}deg`;
  }

  protected async addNote(): Promise<void> {
    const modal = await this.modals.create({ component: NoteModal, componentProps: { tripId: this.trip().id }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async editNote(noteId: string): Promise<void> {
    const modal = await this.modals.create({ component: NoteModal, componentProps: { tripId: this.trip().id, noteId }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async editDoc(event: Event, docId: string): Promise<void> {
    event.stopPropagation();
    const modal = await this.modals.create({ component: DocModal, componentProps: { tripId: this.trip().id, docId }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async open(doc: TripDoc): Promise<void> {
    if (this.openingId()) return;
    this.openingId.set(doc.id);
    const ok = await this.docs.open(doc);
    this.openingId.set(null);
    if (!ok) await this.toast('docs.openFailed');
  }

  /** Envia os ficheiros escolhidos (um a um, para um que falhe não deitar abaixo os outros). */
  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    for (const file of chosen) {
      this.uploading.update((count) => count + 1);
      try {
        await this.docs.upload(this.trip().id, file);
      } catch (error) {
        await this.toast(error instanceof DocError ? `docs.error.${error.reason}` : 'docs.error.upload');
      } finally {
        this.uploading.update((count) => count - 1);
      }
    }
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 3200, position: 'bottom' });
    await toast.present();
  }
}
