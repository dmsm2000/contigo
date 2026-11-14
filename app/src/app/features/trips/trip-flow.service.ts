import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Idea } from '../../core/ideas.logic';
import { Suggestion } from '../../core/suggestions';
import { DrawModal } from '../draw/draw.modal';
import { IdeaModal } from '../ideas/idea.modal';
import { AddPhotosModal } from '../photos/add-photos.modal';
import { PhotoViewerModal } from '../photos/photo-viewer.modal';
import { StoriesModal } from '../stories/stories.modal';
import { AddWishModal } from '../wishlist/add-wish.modal';
import { PastTripModal } from './past-trip.modal';
import { TripDetailModal } from './trip-detail.modal';

/** Abre os ecrãs das viagens e da lista "Por ir", para o menu + e as páginas usarem a mesma coisa. */
@Injectable({ providedIn: 'root' })
export class TripFlowService {
  private readonly modals = inject(ModalController);
  private opening = false;

  async openPastTrip(): Promise<void> {
    await this.present(() => this.modals.create({ component: PastTripModal, cssClass: 'ct-modal' }));
  }

  async openDetail(tripId: string): Promise<void> {
    await this.present(() =>
      this.modals.create({ component: TripDetailModal, componentProps: { tripId }, cssClass: 'ct-modal' }),
    );
  }

  /** Juntar fotos a uma viagem; sem `tripId`, escolhe-se a viagem no ecrã. */
  async openAddPhotos(tripId: string | null = null): Promise<void> {
    await this.present(() => this.modals.create({ component: AddPhotosModal, componentProps: { tripId }, cssClass: 'ct-modal' }));
  }

  /** As fotos de uma viagem em ecrã inteiro, a começar na foto `startAt`. */
  async openPhotos(tripId: string, startAt: number): Promise<void> {
    await this.present(() =>
      this.modals.create({ component: PhotoViewerModal, componentProps: { tripId, startAt }, cssClass: 'ct-modal' }),
    );
  }

  /** As viagens como histórias em ecrã inteiro, a começar na `startAt`. */
  async openStories(tripIds: string[], startAt: number): Promise<void> {
    await this.present(() =>
      this.modals.create({ component: StoriesModal, componentProps: { tripIds, startAt }, cssClass: 'ct-modal' }),
    );
  }

  /** Escrever uma ideia nova, ou mudar uma que já escreveste. */
  async openIdea(idea: Idea | null = null): Promise<void> {
    await this.present(() => this.modals.create({ component: IdeaModal, componentProps: { idea }, cssClass: 'ct-modal' }));
  }

  /** O sorteio do mês. */
  async openDraw(): Promise<void> {
    await this.present(() => this.modals.create({ component: DrawModal, cssClass: 'ct-modal' }));
  }

  /** Juntar um sítio à lista "Por ir"; com uma sugestão, abre já preenchido. */
  async openAddWish(suggestion: Suggestion | null = null): Promise<void> {
    await this.present(() =>
      this.modals.create({ component: AddWishModal, componentProps: { suggestion }, cssClass: 'ct-modal' }),
    );
  }

  /** Evita abrir dois ecrãs por cima um do outro com um duplo toque. */
  private async present(create: () => Promise<HTMLIonModalElement>): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      const modal = await create();
      await modal.present();
    } finally {
      this.opening = false;
    }
  }
}
