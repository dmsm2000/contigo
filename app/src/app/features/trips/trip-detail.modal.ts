import { Component, Input, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { AlertController, IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, createOutline, imageOutline, trashOutline } from 'ionicons/icons';
import { Expense, totalOf } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { AuthService } from '../../core/auth.service';
import { ProfileService } from '../../core/profile.service';
import { entrySource } from '../../core/draw.logic';
import { DrawService } from '../../core/draw.service';
import { TripsService } from '../../core/trips.service';
import { Photo } from '../../core/photos.logic';
import { PhotosService } from '../../core/photos.service';
import { formatCost, Trip } from '../../core/trips.logic';
import { isLive } from '../../core/trip-plan.logic';
import { AuditLineComponent } from '../audit/audit-line.component';
import { TripPlanComponent } from './plan/trip-plan.component';
import { ExpenseModal } from '../expenses/expense.modal';
import { PlaceImageModal } from '../places/place-image.modal';
import { PastTripModal } from './past-trip.modal';
import { AddPhotosModal } from '../photos/add-photos.modal';
import { PhotoImgComponent } from '../photos/photo-img.component';
import { PhotoViewerModal } from '../photos/photo-viewer.modal';
import { TripLabels } from './trip-labels.service';

@Component({
  selector: 'app-trip-detail-modal',
  imports: [IonContent, IonIcon, TranslocoPipe, PhotoImgComponent, AuditLineComponent, TripPlanComponent],
  templateUrl: './trip-detail.modal.html',
  styleUrl: './trip-detail.modal.scss',
})
export class TripDetailModal implements OnInit {
  /** Entra por `componentProps` quando o ecrã é aberto. */
  @Input() tripId = '';

  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly trips = inject(TripsService);
  protected readonly draws = inject(DrawService);
  protected readonly photos = inject(PhotosService);
  protected readonly labels = inject(TripLabels);
  protected readonly deleting = signal(false);
  protected readonly expenses = inject(ExpensesService);
  private readonly language = inject(LanguageService).language;

  /** As despesas desta viagem, as mais recentes primeiro. */
  protected tripExpenses(): Expense[] {
    return this.expenses
      .items()
      .filter((item) => item.tripId === this.tripId)
      .sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
  }

  protected expensesTotal(): string {
    return formatCost(totalOf(this.tripExpenses()), this.language());
  }

  protected money(amount: number): string {
    return formatCost(amount, this.language());
  }

  protected async addExpense(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: ExpenseModal, componentProps: { tripId: this.tripId }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async editExpense(expense: Expense): Promise<void> {
    const modal = await this.modalCtrl.create({ component: ExpenseModal, componentProps: { tripId: this.tripId, expense }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async changeImage(trip: Trip): Promise<void> {
    const modal = await this.modalCtrl.create({ component: PlaceImageModal, componentProps: { placeId: trip.placeId }, cssClass: 'ct-modal' });
    await modal.present();
  }

  protected async edit(trip: Trip): Promise<void> {
    const modal = await this.modalCtrl.create({ component: PastTripModal, componentProps: { trip }, cssClass: 'ct-modal' });
    await modal.present();
  }

  constructor() {
    addIcons({ addOutline, closeOutline, createOutline, imageOutline, trashOutline });

    // Quando chegam fotos (as minhas ou as do outro), pedem-se os links das miniaturas e da capa.
    effect(() => {
      const list = this.photos.photosOf(this.tripId);
      untracked(() => this.prepare(list));
    });
  }

  ngOnInit(): void {
    this.prepare(this.photos.photosOf(this.tripId));
  }

  private prepare(list: readonly Photo[]): void {
    if (!list.length) return;
    void this.photos.ensureThumbs(this.tripId);
    void this.photos.ensureFull([list[0]]);
  }

  protected gallery(): Photo[] {
    return this.photos.photosOf(this.tripId);
  }

  /** A capa no topo do ecrã: a primeira foto, ou as cores do sítio enquanto não há fotos. */
  protected heroBackground(trip: Trip): string {
    const cover = this.photos.coverOf(trip.id);
    const url = cover && (this.photos.fullUrl(cover) ?? this.photos.thumbUrl(cover));
    return url ? `center / cover no-repeat url("${url}")` : this.labels.tile(trip.place);
  }

  protected hasCover(trip: Trip): boolean {
    const cover = this.photos.coverOf(trip.id);
    return (cover !== null && (this.photos.fullUrl(cover) ?? this.photos.thumbUrl(cover)) !== null) || this.labels.hasPlaceImage(trip.place);
  }

  protected async openPhoto(index: number): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: { tripId: this.tripId, startAt: index },
      cssClass: 'ct-modal',
    });
    await modal.present();
  }

  protected async addPhotos(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AddPhotosModal,
      componentProps: { tripId: this.tripId },
      cssClass: 'ct-modal',
    });
    await modal.present();
  }

  /** Procura sempre na lista atual, para refletir o que o outro alterar ou apagar. */
  protected get trip(): Trip | undefined {
    return this.trips.find(this.tripId);
  }

  /** Uma viagem que ainda não acabou (sorteada, a planear, preparada ou em curso): tem plano. */
  protected live(trip: Trip): boolean {
    return isLive(trip.status);
  }

  /** Quem vai, no futuro ("Vão os dois"). */
  protected liveWho(trip: Trip): { key: string; params?: Record<string, string> } {
    if (trip.withPartner) return { key: 'plan.who.together' };
    if (trip.createdBy && trip.createdBy === this.auth.userId()) return { key: 'plan.who.me' };
    const name = this.profile.nameOf(trip.createdBy);
    return name ? { key: 'plan.who.only', params: { name } } : { key: 'plan.who.one' };
  }

  /** Uma viagem sorteada que ainda não aconteceu: o que se pode fazer com ela é usar o veto. */
  protected isDrawn(trip: Trip): boolean {
    return trip.status === 'drawn';
  }

  protected drawSource(trip: Trip): 'wishlist' | 'suggestion' | null {
    return entrySource(trip.drawEntry);
  }

  protected async confirmVeto(trip: Trip): Promise<void> {
    if (this.draws.myVetoUsed()) return;
    const t = (key: string, params?: Record<string, string>) => this.transloco.translate(key, params);
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

  private async veto(trip: Trip): Promise<void> {
    this.deleting.set(true);
    let message = this.transloco.translate('draw.vetoDone');
    try {
      await this.draws.veto(trip);
      await this.modalCtrl.dismiss({ vetoed: true });
    } catch {
      message = this.transloco.translate('draw.vetoError');
      this.deleting.set(false);
    }
    const toast = await this.toasts.create({ message, duration: 2400, position: 'top' });
    await toast.present();
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async confirmDelete(trip: Trip): Promise<void> {
    const t = (key: string, params?: Record<string, string>) => this.transloco.translate(key, params);
    const alert = await this.alerts.create({
      header: t('trip.detail.deleteTitle'),
      message: t('trip.detail.deleteText', { place: trip.place.name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('trip.detail.delete'), role: 'destructive', handler: () => void this.delete(trip) },
      ],
    });
    await alert.present();
  }

  private async delete(trip: Trip): Promise<void> {
    this.deleting.set(true);
    let message = this.transloco.translate('trip.detail.deleted');
    try {
      await this.trips.remove(trip);
      await this.modalCtrl.dismiss({ deleted: true });
    } catch {
      message = this.transloco.translate('trip.detail.deleteError');
      this.deleting.set(false);
    }
    const toast = await this.toasts.create({ message, duration: 2200, position: 'top' });
    await toast.present();
  }
}
