import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronForwardOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { daysUntil, formatWeekdays, formatWindow, leafParts, monthInitials, todayIso } from '../../core/availability.logic';
import { AvailabilityService } from '../../core/availability.service';
import { DrawService } from '../../core/draw.service';
import { clockParts, Meeting, meetingCountdown, meetingSpan, nextEncounter } from '../../core/meetings.logic';
import { MeetingsService } from '../../core/meetings.service';
import { ExpensesService } from '../../core/expenses.service';
import { LanguageService } from '../../core/language.service';
import { StoriesService } from '../../core/stories.service';
import { ProfileService } from '../../core/profile.service';
import { ThemeService } from '../../core/theme.service';
import { byRecentlyAdded, formatCost, formatTripDate, placeSubtitle, tileColors, Trip, tripCountdown, yearStats } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { Suggestion } from '../../core/suggestions';
import { averageStars, nearestOrigin, WishlistItem } from '../../core/wishlist.logic';
import { WishlistService } from '../../core/wishlist.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { TripLabels } from '../../features/trips/trip-labels.service';
import { AvatarComponent } from '../../features/profile/avatar.component';
import { StarsComponent } from '../../features/wishlist/stars.component';

/** Quantas histórias cabem no topo, e quantas memórias na lista, antes do "Ver todas". */
const STORIES_SHOWN = 8;
const MEMORIES_SHOWN = 8;

import { LastUpdateComponent } from '../../features/audit/last-update.component';
/** Quantos sítios por ir se mostram no carrossel do Início. */
const WISHES_SHOWN = 5;
/** Quantas ideias para descobrir se mostram quando a lista é curta. */
const DISCOVER_SHOWN = 8;

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
  private readonly meetings = inject(MeetingsService);
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
  /** O passo da viagem que vem aí, para o cartão ("Preparada", "Em curso"); a sorteada não leva etiqueta. */
  protected stageKey(trip: { status: string }): string | null {
    return trip.status === 'planned' ? 'plan.stage.planning' : trip.status === 'prepared' ? 'plan.stage.prepared' : trip.status === 'ongoing' ? 'plan.stage.ongoing' : null;
  }

  /** O próximo momento em que estão juntos: um encontro ou a viagem sorteada (se já tem datas). */
  /** "Agora", para o contador: avança de segundo a segundo quando faltam horas para um encontro, e de minuto a minuto no resto. */
  private readonly now = signal(Date.now());
  protected readonly encounter = computed(() => nextEncounter(this.meetings.items(), this.draws.active(), todayIso(new Date(this.now()))));

  protected readonly heroDate = computed(() => {
    const encounter = this.encounter();
    const active = this.draws.active();
    // A folha é a contagem: os dias que faltam (ou, num encontro com hora a menos de 24 h, as horas), ou o dia do encontro/da viagem.
    if (encounter) {
      const now = new Date(this.now());
      const count = encounter.kind === 'meeting' ? meetingCountdown(encounter.meeting, now) : tripCountdown(encounter.trip, todayIso(now));
      if (count.phase === 'soon') {
        const { h, m, s } = clockParts(count.ms);
        const two = (value: number) => String(value).padStart(2, '0');
        return {
          leaf: { month: 'home.leafClock', day: h >= 1 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`, translate: true, clock: true },
          countdown: { key: h >= 1 ? 'home.inHours' : 'home.inMinutes', params: { h, m } },
          live: true,
        };
      }
      if (count.phase === 'before') {
        const key = count.days === 1 ? 'home.tomorrow' : 'home.inDays_other';
        return {
          leaf: { month: count.days === 1 ? 'home.leafDay_one' : 'home.leafDay_other', day: count.days, translate: true, clock: false },
          countdown: { key, params: { count: count.days } },
          live: false,
        };
      }
      if (count.phase === 'during') {
        return {
          leaf: { month: 'home.leafDay_one', day: `${count.day}/${count.total}`, translate: true, clock: false },
          countdown: { key: 'home.dayOf', params: { day: count.day, total: count.total } },
          live: false,
        };
      }
    }
    // Uma viagem com as datas ainda em avaliação não tem dia para contar: fica o "?".
    if (active && !active.datesConfirmed) {
      return { leaf: { month: 'home.leafDay_other', day: '?', translate: true, clock: false }, countdown: { key: 'plan.dates.pendingShort', params: {} }, live: false };
    }
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
    return { leaf: { ...leafParts(start, this.language()), translate: false, clock: false }, countdown, live: false };
  });
  /** Os 12 meses do ano: a viagem desse mês (se houve), para o cartão do ano mostrar as capas. */
  protected readonly yearMonths = computed(() => {
    const initials = monthInitials(this.language());
    return initials.map((initial, index) => ({
      initial,
      trip: this.trips.done().find((trip) => trip.startDate.startsWith(`${this.year}-${String(index + 1).padStart(2, '0')}`)) ?? null,
    }));
  });
  /** Os sítios por ir mais desejados (até {@link WISHES_SHOWN}). */
  protected readonly topWishes = computed(() => this.wishlist.sorted().slice(0, WISHES_SHOWN));
  /**
   * Quando a lista tem menos de {@link WISHES_SHOWN} sítios, um segundo carrossel, à parte, com ideias para descobrir
   * (as sugestões mais perto de casa), para haver sempre o que ver e juntar com um toque.
   */
  protected readonly discover = computed(() =>
    this.wishlist.sorted().length >= WISHES_SHOWN
      ? []
      : [...this.wishlist.suggestions()]
          .sort((a, b) => nearestOrigin([a.lng, a.lat]).km - nearestOrigin([b.lng, b.lat]).km || a.name.localeCompare(b.name, 'pt'))
          .slice(0, DISCOVER_SHOWN),
  );

  constructor() {
    addIcons({ add, chevronForwardOutline, heartOutline, imagesOutline, moonOutline, sunnyOutline });
    // O relógio do contador: de segundo a segundo só quando há horas a contar; senão, de minuto a minuto (para a data virar à meia-noite).
    let lastMinute = 0;
    const timer = setInterval(() => {
      const t = Date.now();
      if (this.heroDate()?.live || t - lastMinute >= 60_000) {
        lastMinute = t;
        this.now.set(t);
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected toggleTheme(): void {
    void this.profile.setTheme(this.theme.isDark() ? 'light' : 'dark');
  }

  protected addSuggestion(suggestion: Suggestion): void {
    void this.flow.openAddWish(suggestion);
  }

  protected suggestionWhere(suggestion: Suggestion): string {
    return placeSubtitle(suggestion, this.language());
  }

  protected suggestionTile(name: string): string {
    const { from, to } = tileColors(name);
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  protected meetingDate(meeting: Meeting): string {
    const date = formatTripDate(meetingSpan(meeting), this.language());
    return meeting.startTime ? `${date} · ${meeting.startTime}` : date;
  }

  protected addMeeting(): void {
    void this.flow.openMeeting();
  }

  protected openMeeting(id: string): void {
    void this.flow.openMeeting(id);
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
