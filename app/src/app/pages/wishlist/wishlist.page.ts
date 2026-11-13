import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronBackOutline, linkOutline, locationOutline, sparklesOutline, trashOutline } from 'ionicons/icons';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { Suggestion } from '../../core/suggestions';
import { initialOf, placeSubtitle, tileColors } from '../../core/trips.logic';
import { nearestOrigin, WishlistItem } from '../../core/wishlist.logic';
import { Stars, WishlistService } from '../../core/wishlist.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { StarsComponent } from '../../features/wishlist/stars.component';

/** Quantas sugestões se mostram antes de "ver mais". */
const SUGGESTIONS_SHOWN = 6;

@Component({
  selector: 'app-wishlist',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe, StarsComponent],
  templateUrl: './wishlist.page.html',
  styleUrl: './wishlist.page.scss',
})
export class WishlistPage {
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly flow = inject(TripFlowService);
  private readonly language = inject(LanguageService).language;
  protected readonly wishlist = inject(WishlistService);
  protected readonly profile = inject(ProfileService);

  protected readonly showAll = signal(false);

  /** As sugestões mais perto de casa primeiro: são as que cabem mais vezes numa janela. */
  private readonly nearestFirst = computed(() =>
    [...this.wishlist.suggestions()].sort(
      (a, b) => nearestOrigin([a.lng, a.lat]).km - nearestOrigin([b.lng, b.lat]).km || a.name.localeCompare(b.name, 'pt'),
    ),
  );
  protected readonly suggestions = computed(() =>
    this.showAll() ? this.nearestFirst() : this.nearestFirst().slice(0, SUGGESTIONS_SHOWN),
  );
  protected readonly hiddenCount = computed(() => Math.max(0, this.nearestFirst().length - SUGGESTIONS_SHOWN));

  constructor() {
    addIcons({ add, chevronBackOutline, linkOutline, locationOutline, sparklesOutline, trashOutline });
  }

  protected add(): void {
    void this.flow.openAddWish();
  }

  protected tile(name: string): string {
    const { from, to } = tileColors(name);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  protected initial(name: string): string {
    return initialOf(name);
  }

  protected addSuggestion(suggestion: Suggestion): void {
    void this.flow.openAddWish(suggestion);
  }

  protected setSwitch(): void {
    this.wishlist.setIncludeSuggestions(!this.wishlist.includeSuggestions());
  }

  protected subtitle(item: WishlistItem): string {
    return placeSubtitle(item.place, this.language());
  }

  protected suggestionSubtitle(suggestion: Suggestion): string {
    return placeSubtitle({ admin1: suggestion.admin1, countryCode: suggestion.countryCode }, this.language());
  }

  protected distance(item: WishlistItem): { origin: string; km: number } | null {
    const { lat, lng } = item.place;
    return lat !== null && lng !== null ? nearestOrigin([lng, lat]) : null;
  }

  protected suggestionDistance(suggestion: Suggestion): { origin: string; km: number } {
    return nearestOrigin([suggestion.lng, suggestion.lat]);
  }

  protected partnerStars(item: WishlistItem): number {
    const partner = this.profile.partner();
    return (partner && item.stars[partner.id]) || 0;
  }

  protected async setStars(item: WishlistItem, stars: Stars): Promise<void> {
    if (this.wishlist.myStars(item) === stars) return;
    try {
      await this.wishlist.setMyStars(item, stars);
    } catch {
      await this.toast('wish.errors.save');
    }
  }

  protected async confirmRemove(item: WishlistItem): Promise<void> {
    const t = (key: string, params?: Record<string, unknown>) => this.transloco.translate(key, params);
    const partner = this.profile.partner();
    const othersStay = partner !== null && this.partnerStars(item) > 0;
    const alert = await this.alerts.create({
      header: t('wish.removeTitle'),
      message: othersStay
        ? t('wish.removeShared', { place: item.place.name, name: partner.name || t('wish.theOther') })
        : t('wish.removeAlone', { place: item.place.name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('wish.removeConfirm'), role: 'destructive', handler: () => void this.remove(item) },
      ],
    });
    await alert.present();
  }

  private async remove(item: WishlistItem): Promise<void> {
    try {
      await this.wishlist.removeMine(item);
      await this.toast('wish.removed');
    } catch {
      await this.toast('wish.errors.remove');
    }
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2200, position: 'top' });
    await toast.present();
  }
}
