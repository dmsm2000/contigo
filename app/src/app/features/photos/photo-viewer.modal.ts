import { Component, HostListener, Input, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { AlertController, IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, closeOutline, createOutline, trashOutline } from 'ionicons/icons';
import { cleanCaption, MAX_CAPTION_LENGTH, Photo } from '../../core/photos.logic';
import { PhotosService } from '../../core/photos.service';
import { PhotoImgComponent } from './photo-img.component';

/** As fotos de uma viagem em ecrã inteiro: passa-se de uma a outra, lê-se e muda-se a legenda e apaga-se. */
@Component({
  selector: 'app-photo-viewer-modal',
  imports: [IonContent, IonIcon, TranslocoPipe, PhotoImgComponent],
  templateUrl: './photo-viewer.modal.html',
  styleUrl: './photo-viewer.modal.scss',
})
export class PhotoViewerModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  protected readonly photos = inject(PhotosService);

  @Input() tripId = '';
  @Input() startAt = 0;

  protected readonly index = signal(0);
  protected readonly editing = signal(false);
  protected readonly maxCaption = MAX_CAPTION_LENGTH;
  protected readonly busy = signal(false);

  protected readonly list = computed(() => this.photos.photosOf(this.tripId));
  protected readonly current = computed<Photo | null>(() => {
    const list = this.list();
    return list[Math.min(this.index(), list.length - 1)] ?? null;
  });
  protected readonly position = computed(() => Math.min(this.index(), this.list().length - 1) + 1);

  private swipeStart: { x: number; y: number } | null = null;

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, closeOutline, createOutline, trashOutline });

    // Põe na cache a foto que se vê e as vizinhas, para passar de uma a outra sem esperar.
    effect(() => {
      const list = this.list();
      const at = Math.min(this.index(), list.length - 1);
      const near = [list[at], list[at + 1], list[at - 1]].filter((photo): photo is Photo => Boolean(photo));
      untracked(() => void this.photos.warm(near));
    });

    // Se a última foto for apagada (aqui ou no outro telemóvel), fecha-se.
    effect(() => {
      if (this.photos.loaded() && this.list().length === 0) untracked(() => void this.modalCtrl.dismiss());
    });
  }

  ngOnInit(): void {
    this.index.set(Math.max(0, this.startAt));
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected go(step: number): void {
    const count = this.list().length;
    if (count < 2) return;
    this.editing.set(false);
    this.index.update((value) => (Math.min(value, count - 1) + step + count) % count);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (this.editing()) return;
    if (event.key === 'ArrowLeft') this.go(-1);
    else if (event.key === 'ArrowRight') this.go(1);
  }

  protected touchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.swipeStart = { x: touch.clientX, y: touch.clientY };
  }

  /** Deslizar para o lado passa à foto seguinte ou à anterior. */
  protected touchEnd(event: TouchEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start || this.editing()) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60) this.go(dx < 0 ? 1 : -1);
  }

  protected startEdit(): void {
    this.editing.set(true);
    setTimeout(() => document.getElementById('photo-caption')?.focus(), 50);
  }

  protected async saveCaption(photo: Photo, value: string): Promise<void> {
    const caption = cleanCaption(value);
    if (caption === 'tooLong') return void (await this.toast('photos.errors.captionTooLong'));
    this.editing.set(false);
    if (caption === photo.caption) return;
    try {
      await this.photos.setCaption(photo, caption);
    } catch {
      await this.toast('photos.errors.save');
    }
  }

  protected async confirmRemove(photo: Photo): Promise<void> {
    const t = (key: string) => this.transloco.translate(key);
    const alert = await this.alerts.create({
      header: t('photos.removeTitle'),
      message: t('photos.removeText'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('photos.remove'), role: 'destructive', handler: () => void this.remove(photo) },
      ],
    });
    await alert.present();
  }

  private async remove(photo: Photo): Promise<void> {
    this.busy.set(true);
    try {
      await this.photos.remove(photo);
      await this.toast('photos.removed');
    } catch {
      await this.toast('photos.errors.remove');
    }
    this.busy.set(false);
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2200, position: 'top' });
    await toast.present();
  }
}
