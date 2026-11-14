import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronForwardOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { daysUntil, formatWeekdays, formatWindow, leafParts, monthInitials, todayIso } from '../../core/availability.logic';
import { AvailabilityService } from '../../core/availability.service';
import { DrawService } from '../../core/draw.service';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { StoriesService } from '../../core/stories.service';
import { ProfileService } from '../../core/profile.service';
import { ThemeService } from '../../core/theme.service';
import { byRecentlyAdded, formatCost, Trip, yearStats } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { averageStars, WishlistItem } from '../../core/wishlist.logic';
import { WishlistService } from '../../core/wishlist.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';
import { AvatarComponent } from '../../features/profile/avatar.component';
import { StarsComponent } from '../../features/wishlist/stars.component';

/** Quantas histórias cabem no topo, e quantas memórias na lista, antes do "Ver todas". */
const STORIES_SHOWN = 8;
const MEMORIES_SHOWN = 8;

import { LastUpdateComponent } from '../../features/audit/last-update.component';
@Component({
  selector: 'app-home',
  imports: [LastUpdateComponent, IonContent, IonIcon, RouterLink, TranslocoPipe, StarsComponent, AvatarComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly profile = inject(ProfileService);
  protected readonly people = computed(() => this.profile.people());
  private readonly flow = inject(TripFlowService);
  protected readonly theme = inject(ThemeService);
  protected readonly trips = inject(TripsService);
  protected readonly labels = inject(TripLabels);
  protected readonly wishlist = inject(WishlistService);
  protected readonly stories = inject(StoriesService);
  protected readonly expenses = inject(ExpensesService);
  private readonly availability = inject(AvailabilityService);
  protected readonly draws = inject(DrawService);
  private readonly language = inject(LanguageService).language;

  protected readonly year = new Date().getFullYear();
  /** Os sítios diferentes do ano e os meses em que houve viagem. */
  protected readonly stats = computed(() => yearStats(this.trips.done(), this.year));
  /** As viagens mais recentes aparecem como "histórias"; as outras ficam na página "Ver todas". */
  protected readonly recent = computed(() => byRecentlyAdded(this.trips.done()).slice(0, STORIES_SHOWN));
  /** O cartão grande espera pelo sorteio e pela disponibilidade, para não mostrar "sem janelas" antes de saber. */
  protected readonly heroLoading = computed(
    () => !(this.draws.loaded() && (this.availability.loaded() || this.availability.loadFailed())),
  );
  /** A cebola com sinal ("+140 €"); sem despesas, "+0 €". */
  protected readonly cebolaText = computed(() => {
    const { amount } = this.expenses.cebola();
    return `${amount < 0 ? '−' : '+'}${formatCost(Math.abs(amount), this.language())}`;
  });
  /** O que se pode gastar este mês (dotação + cebola − o que já saiu), formatado. */
  protected readonly availableText = computed(() => formatCost(Math.max(0, this.expenses.cebola().available), this.language()));
  /** A parte do que se pode gastar que já se gastou, de 0 a 1: enche a barra. */
  protected readonly spentShare = computed(() => {
    const { available, spentThisMonth } = this.expenses.cebola();
    const total = spentThisMonth + Math.max(0, available);
    return total > 0 ? Math.min(1, spentThisMonth / total) : 0;
  });
  protected readonly hasMore = computed(() => this.trips.done().length > STORIES_SHOWN);
  /** As memórias que se veem no Início; as outras abrem-se em "Ver tudo". */
  protected readonly memories = computed(() => this.trips.done().slice(0, MEMORIES_SHOWN));
  /** A próxima janela em que os dois estão livres, se já houver. */
  protected readonly nextWindow = computed(() => {
    const next = this.availability.next();
    return next
      ? { label: formatWindow(next, this.language()), weekdays: formatWeekdays(next, this.language()), days: next.days }
      : null;
  });
  /** A data a que o cartão grande conta: a viagem sorteada ou o início da próxima janela livre. */
  protected readonly heroDate = computed(() => {
    const active = this.draws.active();
    const start = active ? active.startDate : this.availability.next()?.start;
    if (!start) return null;
    const days = daysUntil(start, todayIso());
    const count = Math.max(0, days);
    const countdown =
      count === 0
        ? { key: 'home.today', params: {} }
        : count === 1
          ? { key: 'home.tomorrow', params: {} }
          : { key: 'home.inDays_other', params: { count } };
    return { leaf: leafParts(start, this.language()), countdown };
  });
  /** Os 12 meses do ano: a viagem desse mês (se houve), para o cartão do ano mostrar as capas. */
  protected readonly yearMonths = computed(() => {
    const initials = monthInitials(this.language());
    return initials.map((initial, index) => ({
      initial,
      trip: this.trips.done().find((trip) => trip.startDate.startsWith(`${this.year}-${String(index + 1).padStart(2, '0')}`)) ?? null,
    }));
  });
  /** Os três sítios por ir mais desejados. */
  protected readonly topWishes = computed(() => this.wishlist.sorted().slice(0, 3));

  constructor() {
    addIcons({ add, chevronForwardOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline });
  }

  protected toggleTheme(): void {
    void this.profile.setTheme(this.theme.isDark() ? 'light' : 'dark');
  }

  protected addPastTrip(): void {
    void this.flow.openPastTrip();
  }

  /** Abre as histórias a começar na viagem tocada; passam por todas as que estão no topo. */
  protected openStory(index: number): void {
    void this.flow.openStories(this.recent().map((trip) => trip.id), index);
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
