import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { AlertController, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  closeOutline,
  ellipseOutline,
  eyeOutline,
  mapOutline,
  navigateOutline,
  restaurantOutline,
  sparklesOutline,
  walkOutline,
} from 'ionicons/icons';
import { dayDate, costSummary, groupByDay, ItineraryCategory, ItineraryItem } from '../../../core/itinerary.logic';
import { ItineraryService } from '../../../core/itinerary.service';
import { LanguageService } from '../../../core/language.service';
import { formatCost, LOCALES, Trip } from '../../../core/trips.logic';
import { ItineraryImportModal, ItineraryRequestModal } from './itinerary-modals';

const ICONS: Record<ItineraryCategory, string> = {
  see: 'eye-outline',
  eat: 'restaurant-outline',
  do: 'walk-outline',
  move: 'navigate-outline',
  rest: 'bed-outline',
  other: 'ellipse-outline',
};

/**
 * O roteiro da viagem: pede-se a um chat (o pedido compõe-se aqui), cola-se a resposta como rascunho, revê-se e aceita-se.
 * Os custos estimados do roteiro aceite podem passar para o orçamento.
 */
@Component({
  selector: 'app-trip-itinerary',
  imports: [IonIcon, NgTemplateOutlet, TranslocoPipe],
  templateUrl: './trip-itinerary.component.html',
  styleUrl: './trip-itinerary.component.scss',
})
export class TripItineraryComponent {
  readonly trip = input.required<Trip>();

  private readonly itineraries = inject(ItineraryService);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;

  protected readonly loaded = this.itineraries.loaded;
  protected readonly draft = computed(() => this.itineraries.of(this.trip().id).draft);
  protected readonly accepted = computed(() => this.itineraries.of(this.trip().id).accepted);
  protected readonly draftDays = computed(() => groupByDay(this.draft()?.items ?? []));
  protected readonly acceptedDays = computed(() => groupByDay(this.accepted()?.items ?? []));
  protected readonly draftCost = computed(() => costSummary(this.draft()?.items ?? []));
  protected readonly cost = computed(() => costSummary(this.accepted()?.items ?? []));
  protected readonly budgetRows = computed(() => {
    const { byCategory } = this.cost();
    return (['food', 'activities', 'transport', 'other'] as const)
      .filter((category) => byCategory[category] !== undefined)
      .map((category) => ({ category, text: formatCost(byCategory[category] ?? 0, this.language()) }));
  });

  constructor() {
    addIcons({ bedOutline, closeOutline, ellipseOutline, eyeOutline, mapOutline, navigateOutline, restaurantOutline, sparklesOutline, walkOutline });
  }

  protected icon(category: ItineraryCategory): string {
    return ICONS[category];
  }

  protected money(value: number): string {
    return formatCost(value, this.language());
  }

  /** "sex., 5 dez." quando se sabe quando a viagem começa; senão, nada (fica só "Dia 2"). */
  protected dateOf(day: number): string | null {
    const trip = this.trip();
    const iso = trip.datesConfirmed && trip.datePrecision === 'day' ? dayDate(trip.startDate, day) : null;
    if (!iso) return null;
    const [year, month, number] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALES[this.language()], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, number)),
    );
  }

  protected time(item: ItineraryItem): string {
    return item.startTime ? (item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime) : '';
  }

  /** Procura o sítio no mapa (abre fora da app, só quando se toca). */
  protected mapUrl(item: ItineraryItem): string | null {
    const query = [item.placeName, item.address].filter(Boolean).join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} ${this.trip().place.name}`)}` : null;
  }

  protected async request(): Promise<void> {
    const modal = await this.modals.create({ component: ItineraryRequestModal, componentProps: { tripId: this.trip().id }, cssClass: 'ct-modal' });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ next?: string }>();
    if (data?.next === 'import') await this.import();
  }

  protected async import(): Promise<void> {
    const modal = await this.modals.create({ component: ItineraryImportModal, componentProps: { tripId: this.trip().id }, cssClass: 'ct-modal' });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ saved?: boolean; skipped?: number }>();
    if (data?.saved) await this.toast(data.skipped ? 'itinerary.savedSkipped' : 'itinerary.saved', { count: data.skipped ?? 0 });
  }

  protected async accept(): Promise<void> {
    const replace = !!this.accepted();
    const ok = replace
      ? await this.confirm('itinerary.replaceTitle', 'itinerary.replaceText', 'itinerary.accept')
      : true;
    if (!ok) return;
    await this.run(() => this.itineraries.accept(this.trip().id), 'itinerary.accepted');
  }

  protected async discard(): Promise<void> {
    if (await this.confirm('itinerary.discardTitle', 'itinerary.discardText', 'itinerary.discard')) {
      await this.run(() => this.itineraries.discardDraft(this.trip().id));
    }
  }

  protected async removeAccepted(): Promise<void> {
    if (await this.confirm('itinerary.removeTitle', 'itinerary.removeText', 'itinerary.remove')) {
      await this.run(() => this.itineraries.removeAccepted(this.trip().id));
    }
  }

  protected async removeItem(item: ItineraryItem): Promise<void> {
    await this.run(() => this.itineraries.removeItem(item.id));
  }

  protected async useInBudget(): Promise<void> {
    if (await this.confirm('itinerary.budgetTitle', 'itinerary.budgetText', 'itinerary.useInBudget')) {
      await this.run(() => this.itineraries.useInBudget(this.trip().id), 'itinerary.budgetDone');
    }
  }

  private async run(action: () => Promise<void>, doneKey?: string): Promise<void> {
    try {
      await action();
      if (doneKey) await this.toast(doneKey);
    } catch {
      await this.toast('itinerary.errors.save');
    }
  }

  private async confirm(title: string, message: string, action: string): Promise<boolean> {
    const t = (key: string) => this.transloco.translate(key);
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alerts.create({
        header: t(title),
        message: t(message),
        buttons: [
          { text: t('itinerary.keep'), role: 'cancel', handler: () => resolve(false) },
          { text: t(action), role: 'destructive', handler: () => resolve(true) },
        ],
      });
      alert.onDidDismiss().then(() => resolve(false));
      await alert.present();
    });
  }

  private async toast(key: string, params: Record<string, number> = {}): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key, params), duration: 2600, position: 'bottom' });
    await toast.present();
  }
}
