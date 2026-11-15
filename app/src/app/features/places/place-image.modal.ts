import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { cameraOutline, checkmarkCircle, closeOutline, trashOutline } from 'ionicons/icons';
import { compressImage } from '../../core/image-compress';
import { LanguageService } from '../../core/language.service';
import { ImageCandidate } from '../../core/place-image.logic';
import { PlaceImageService, placeImageUrl } from '../../core/place-image.service';
import { storePlaceImage } from '../../core/places.service';
import { SupabaseService } from '../../core/supabase.service';

interface PlaceRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
  image_path: string | null;
  image_credit: string | null;
}

/** Escolher a imagem de um sítio: as melhores que se encontram, uma foto vossa, ou nenhuma. */
@Component({
  selector: 'app-place-image-modal',
  imports: [IonContent, IonIcon, TranslocoPipe],
  templateUrl: './place-image.modal.html',
  styleUrl: './place-image.modal.scss',
})
export class PlaceImageModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly supabase = inject(SupabaseService).client;
  private readonly images = inject(PlaceImageService);
  private readonly language = inject(LanguageService).language;

  @Input() placeId = '';

  protected readonly place = signal<PlaceRow | null>(null);
  protected readonly candidates = signal<ImageCandidate[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    addIcons({ cameraOutline, checkmarkCircle, closeOutline, trashOutline });
  }

  async ngOnInit(): Promise<void> {
    const { data } = await this.supabase
      .from('places')
      .select('id, name, lat, lng, country_code, image_path, image_credit')
      .eq('id', this.placeId)
      .single<PlaceRow>();
    if (!data) return this.close();
    this.place.set(data);
    const found = await this.images.candidates({ ...data, countryCode: data.country_code }, this.language(), undefined, 9);
    this.candidates.set(found);
    this.loading.set(false);
  }

  protected current(): string | null {
    return placeImageUrl(this.place()?.image_path);
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async choose(candidate: ImageCandidate): Promise<void> {
    if (this.busy()) return;
    this.busy.set(candidate.url);
    this.failed.set(false);
    const blob = await this.images.download(candidate.url);
    const ok = blob ? await storePlaceImage(this.supabase, this.placeId, blob, candidate.credit, 'user') : false;
    await this.finish(ok);
  }

  protected async pickOwn(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy()) return;
    this.busy.set('own');
    this.failed.set(false);
    let ok = false;
    try {
      const { full } = await compressImage(file);
      ok = await storePlaceImage(this.supabase, this.placeId, full, 'Foto nossa', 'user');
    } catch {
      ok = false;
    }
    await this.finish(ok);
  }

  protected async remove(): Promise<void> {
    const place = this.place();
    if (!place?.image_path || this.busy()) return;
    this.busy.set('remove');
    const update = await this.supabase.from('places').update({ image_path: null, image_credit: null, image_source: 'user' }).eq('id', this.placeId);
    if (!update.error) await this.supabase.storage.from('place-images').remove([place.image_path]);
    await this.finish(!update.error);
  }

  private async finish(ok: boolean): Promise<void> {
    this.busy.set(null);
    if (!ok) {
      this.failed.set(true);
      return;
    }
    await this.modalCtrl.dismiss({ changed: true });
    const toast = await this.toasts.create({ message: this.transloco.translate('placeImage.done'), duration: 2200, position: 'top' });
    await toast.present();
  }
}
