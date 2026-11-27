import { inject, Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Expense } from '../../core/expenses.logic';
import { Idea } from '../../core/ideas.logic';
import { Suggestion } from '../../core/suggestions';
import { DepositModal } from '../deposits/deposit.modal';
import { MeetingModal } from '../meetings/meeting.modal';
import { DrawModal } from '../draw/draw.modal';
import { ExpenseModal } from '../expenses/expense.modal';
import { IdeaModal } from '../ideas/idea.modal';
import { AddPhotosModal } from '../photos/add-photos.modal';
import { PhotoViewerModal } from '../photos/photo-viewer.modal';
import { StoriesModal } from '../stories/stories.modal';
import { AddWishModal } from '../wishlist/add-wish.modal';
import { CompleteWishesModal } from '../wishlist/complete-wishes.modal';
import { PlaceImageModal } from '../places/place-image.modal';
import { PastTripModal } from './past-trip.modal';
import { PlanTripModal } from './plan-trip.modal';
import { TripDetailModal } from './trip-detail.modal';

/** Abre os ecrãs das viagens e da lista "Por ir", para o menu + e as páginas usarem a mesma coisa. */
@Injectable({ providedIn: 'root' })
export class TripFlowService {
  private readonly modals = inject(ModalController);
  private opening = false;

  /** Marcar um encontro (ou, com o id, mudar um que já existe). */
  async openMeeting(meetingId: string | null = null): Promise<void> {
    await this.present(() => this.modals.create({ component: MeetingModal, componentProps: { meetingId }, cssClass: 'ct-modal' }));
  }

  /** Pôr dinheiro na cebola (ou, com o id, mudar um depósito). */
  async openDeposit(depositId: string | null = null): Promise<void> {
    await this.present(() => this.modals.create({ component: DepositModal, componentProps: { depositId }, cssClass: 'ct-modal' }));
  }

  async openPastTrip(): Promise<void> {
    await this.present(() => this.modals.create({ component: PastTripModal, cssClass: 'ct-modal' }));
  }

  /** O assistente "Preencher": completa o que falta nos sítios por ir (ou só num, se se der o id). */
  async openCompleteWishes(placeId?: string): Promise<void> {
    await this.present(() => this.modals.create({ component: CompleteWishesModal, componentProps: { placeId: placeId ?? null }, cssClass: 'ct-modal' }));
  }

  /** Escolher a imagem de um sítio (as sugestões, uma foto vossa ou nenhuma). */
  async openPlaceImage(placeId: string): Promise<void> {
    await this.present(() => this.modals.create({ component: PlaceImageModal, componentProps: { placeId }, cssClass: 'ct-modal' }));
  }

  /** Planear uma viagem à mão. Ao criar, abre logo o plano dela. */
  async openPlanTrip(): Promise<void> {
    await this.present(async () => {
      const modal = await this.modals.create({ component: PlanTripModal, cssClass: 'ct-modal' });
      void modal.onDidDismiss<{ tripId?: string }>().then(({ data }) => {
        if (data?.tripId) void this.openDetail(data.tripId);
      });
      return modal;
    });
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

  /** Registar uma despesa; com `tripId`, a viagem já vem escolhida. */
  async openExpense(tripId: string | null = null, expense: Expense | null = null): Promise<void> {
    await this.present(() => this.modals.create({ component: ExpenseModal, componentProps: { tripId, expense }, cssClass: 'ct-modal' }));
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
