import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronForwardOutline, diceOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { formatWindow, windowKind } from '../../core/availability.logic';
import { AvailabilityService } from '../../core/availability.service';
import { DrawService } from '../../core/draw.service';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { ThemeService } from '../../core/theme.service';
import { Trip, yearStats } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { averageStars, WishlistItem } from '../../core/wishlist.logic';
import { WishlistService } from '../../core/wishlist.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';
import { StarsComponent } from '../../features/wishlist/stars.component';

@Component({
  selector: 'app-home',
  imports: [IonContent, IonIcon, RouterLink, TranslocoPipe, StarsComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly profile = inject(ProfileService);
  private readonly flow = inject(TripFlowService);
  protected readonly theme = inject(ThemeService);
  protected readonly trips = inject(TripsService);
  protected readonly labels = inject(TripLabels);
  protected readonly wishlist = inject(WishlistService);
  private readonly availability = inject(AvailabilityService);
  protected readonly draws = inject(DrawService);
  private readonly language = inject(LanguageService).language;

  protected readonly year = new Date().getFullYear();
  /** Os sítios diferentes do ano e os meses em que houve viagem. */
  protected readonly stats = computed(() => yearStats(this.trips.done(), this.year));
  /** As viagens mais recentes aparecem como "histórias". */
  protected readonly recent = computed(() => this.trips.done().slice(0, 8));
  /** A próxima janela em que os dois estão livres, se já houver. */
  protected readonly nextWindow = computed(() => {
    const next = this.availability.next();
    return next ? { label: formatWindow(next, this.language()), days: next.days, kind: windowKind(next.days) } : null;
  });
  /** Os três sítios por ir mais desejados. */
  protected readonly topWishes = computed(() => this.wishlist.sorted().slice(0, 3));

  constructor() {
    addIcons({ add, chevronForwardOutline, diceOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline });
  }

  protected toggleTheme(): void {
    void this.profile.setTheme(this.theme.isDark() ? 'light' : 'dark');
  }

  protected addPastTrip(): void {
    void this.flow.openPastTrip();
  }

  protected openDraw(): void {
    void this.flow.openDraw();
  }

  protected addWish(): void {
    void this.flow.openAddWish();
  }

  protected stars(item: WishlistItem): number {
    return averageStars(item);
  }

  protected open(trip: Trip): void {
    void this.flow.openDetail(trip.id);
  }
}
