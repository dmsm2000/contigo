import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  bulbOutline,
  calendarOutline,
  cameraOutline,
  cashOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  createOutline,
  diceOutline,
  documentTextOutline,
  flagOutline,
  heartDislikeOutline,
  heartOutline,
  imagesOutline,
  airplaneOutline,
  mapOutline,
  navigateOutline,
  receiptOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { ActivityDay, ActivityEntry, groupByDay, iconOf, isUnread, messageKey, targetOf } from '../../core/activity.logic';
import { ActivityService } from '../../core/activity.service';
import { AuthService } from '../../core/auth.service';
import { todayIso } from '../../core/availability.logic';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { formatRange } from '../../core/trip-plan.logic';
import { formatCost, LOCALES } from '../../core/trips.logic';
import { TripsService } from '../../core/trips.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { BackDirective } from '../../shared/back.directive';

/** Novidades: o que o outro foi fazendo na app, do mais recente para o mais antigo, por dia. */
@Component({
  selector: 'app-activity',
  imports: [BackDirective, IonContent, IonIcon, TranslocoPipe],
  templateUrl: './activity.page.html',
  styleUrl: './activity.page.scss',
})
export class ActivityPage {
  protected readonly activity = inject(ActivityService);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly trips = inject(TripsService);
  private readonly flow = inject(TripFlowService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;

  /** O que já estava lido quando se abriu o ecrã: o que é mais novo fica destacado, mesmo depois de marcado como lido. */
  private readonly openedAt = signal<string | null | undefined>(undefined);
  protected readonly days = computed<ActivityDay[]>(() => groupByDay(this.activity.entries()));

  constructor() {
    addIcons({
      airplaneOutline, bedOutline, bulbOutline, calendarOutline, cameraOutline, cashOutline, checkmarkCircleOutline,
      chevronBackOutline, chevronForwardOutline, createOutline, diceOutline, documentTextOutline, flagOutline,
      heartDislikeOutline, heartOutline, imagesOutline, mapOutline, navigateOutline, receiptOutline, sparklesOutline,
    });
    effect(() => {
      if (!this.activity.loaded() || this.openedAt() !== undefined) return;
      this.openedAt.set(this.activity.readAt());
      // Dá-se um instante para se ver o que é novo antes de passar a lido.
      setTimeout(() => void this.activity.markRead(), 1500);
    });
  }

  protected isNew(entry: ActivityEntry): boolean {
    const opened = this.openedAt();
    return opened !== undefined && entry.items.some((item) => isUnread(item, this.auth.userId(), opened));
  }

  protected icon(entry: ActivityEntry): string {
    return iconOf(entry.latest.kind);
  }

  protected key(entry: ActivityEntry): string {
    return messageKey(entry);
  }

  /** "Hoje", "Ontem" ou "segunda-feira, 30 de novembro". */
  protected dayLabel(day: string): string {
    const today = todayIso();
    if (day === today) return this.transloco.translate('activity.today');
    const yesterday = new Date(`${today}T12:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    if (day === todayIso(yesterday)) return this.transloco.translate('activity.yesterday');
    const text = new Intl.DateTimeFormat(LOCALES[this.language()], { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected time(entry: ActivityEntry): string {
    return new Intl.DateTimeFormat(LOCALES[this.language()], { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.latest.createdAt));
  }

  /** Os valores que entram na frase: quem, a viagem, os euros, as datas… */
  protected params(entry: ActivityEntry): Record<string, unknown> {
    const t = (key: string) => this.transloco.translate(key);
    const item = entry.latest;
    const data = item.data;
    const lang = this.language();
    const person = this.profile.people().find((candidate) => candidate.id === item.actor);
    const trip = this.trips.trips().find((candidate) => candidate.id === item.tripId);
    const day = (value: unknown) => (typeof value === 'string' ? value : null);
    const start = day(data['start']);
    const end = day(data['end']);
    const category = String(data['category'] ?? 'other');
    return {
      who: person?.name || t('activity.theOther'),
      trip: trip?.place.name ?? t('activity.aTrip'),
      count: entry.count,
      amount: formatCost(entry.total ?? Number(data['amount'] ?? 0), lang),
      category: t(`expenses.category.${category}`).toLowerCase(),
      name: String(data['name'] ?? ''),
      body: String(data['body'] ?? ''),
      when: start ? formatRange(start, end ?? start, lang) : '',
      place: data['place'] ? t(`meeting.at.${String(data['place'])}`) : '',
      status: t(`activity.status.${String(data['status'] ?? '')}`),
      mode: t(`plan.legs.modes.${String(data['mode'] ?? 'other')}`).toLowerCase(),
      direction: t(`activity.direction.${String(data['direction'] ?? 'out')}`),
    };
  }

  protected open(entry: ActivityEntry): void {
    const target = targetOf(entry.latest);
    if (!target) return;
    if (target.type === 'trip') void this.flow.openDetail(target.tripId);
    else void this.router.navigateByUrl(target.path);
  }

  protected canOpen(entry: ActivityEntry): boolean {
    return targetOf(entry.latest) !== null;
  }
}
