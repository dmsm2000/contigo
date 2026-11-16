import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, chevronBackOutline, chevronForwardOutline, closeOutline, createOutline, sparklesOutline } from 'ionicons/icons';
import {
  formatWeekdays,
  formatWindow,
  monthGrid,
  monthTitle,
  rangeDays,
  shiftMonth,
  ShiftType,
  shortClock,
  todayIso,
  weekdayNames,
} from '../../core/availability.logic';
import { AvailabilityService } from '../../core/availability.service';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { formatTripDate } from '../../core/trips.logic';
import { Meeting, meetingSpan } from '../../core/meetings.logic';
import { MeetingsService } from '../../core/meetings.service';
import { TripFlowService } from '../../features/trips/trip-flow.service';
import { ShiftTypeModal } from '../../features/availability/shift-type.modal';

/** Quantos meses para a frente se pode marcar (a app só guarda em memória pouco mais de um ano). */
const MONTHS_AHEAD = 12;
/** Quantas janelas em comum se mostram. */
const WINDOWS_SHOWN = 6;

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
  past: boolean;
  today: boolean;
  selected: boolean;
  /** O meu tipo de turno neste dia. */
  mine: ShiftType | null;
  /** O tipo do outro neste dia: aparece como um ponto. */
  partner: ShiftType | null;
  /** Os dois estão livres. */
  shared: boolean;
}

@Component({
  selector: 'app-dates',
  imports: [IonContent, IonIcon, TranslocoPipe],
  templateUrl: './dates.page.html',
  styleUrl: './dates.page.scss',
})
export class DatesPage {
  private readonly modals = inject(ModalController);
  private readonly flow = inject(TripFlowService);
  protected readonly meetings = inject(MeetingsService);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly profile = inject(ProfileService);
  protected readonly availability = inject(AvailabilityService);

  protected readonly today = todayIso();
  private readonly current = { year: Number(this.today.slice(0, 4)), month: Number(this.today.slice(5, 7)) };
  protected readonly view = signal({ ...this.current });

  /** O primeiro dia tocado e, se houver, o último do intervalo. */
  protected readonly anchor = signal<string | null>(null);
  protected readonly end = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const anchor = this.anchor();
    return anchor ? rangeDays(anchor, this.end() ?? anchor) : [];
  });

  protected readonly title = computed(() => monthTitle(this.view().year, this.view().month, this.language()));
  protected readonly weekdays = computed(() => weekdayNames(this.language()));
  protected readonly canGoBack = computed(() => this.view().year * 12 + this.view().month > this.current.year * 12 + this.current.month);
  protected readonly canGoForward = computed(
    () => this.view().year * 12 + this.view().month < this.current.year * 12 + this.current.month + MONTHS_AHEAD,
  );

  protected readonly partnerName = computed(() => this.profile.partner()?.name || '');
  protected readonly hasPartner = computed(() => this.profile.partner() !== null);

  /** O calendário do mês, com o que cada dia mostra. */
  protected readonly weeks = computed<Cell[][]>(() => {
    const { year, month } = this.view();
    const mine = this.availability.myDays();
    const theirs = this.availability.partnerDays();
    const selected = new Set(this.selected());
    const shared = new Set<string>();
    for (const window of this.availability.windows()) {
      for (const day of rangeDays(window.start, window.end)) shared.add(day);
    }
    return monthGrid(year, month).map((week) =>
      week.map((day) => ({
        iso: day.iso,
        day: day.day,
        inMonth: day.inMonth,
        past: day.iso < this.today,
        today: day.iso === this.today,
        selected: selected.has(day.iso),
        mine: this.availability.typeOf(mine.get(day.iso)),
        partner: this.availability.typeOf(theirs.get(day.iso)),
        shared: shared.has(day.iso),
      })),
    );
  });

  protected readonly windows = computed(() =>
    this.availability.windows().slice(0, WINDOWS_SHOWN).map((window) => ({
      ...window,
      label: formatWindow(window, this.language()),
      weekdays: formatWeekdays(window, this.language()),
    })),
  );

  protected readonly selectionLabel = computed(() => {
    const days = this.selected();
    if (!days.length) return '';
    return formatWindow({ start: days[0], end: days[days.length - 1] }, this.language());
  });

  private swipeStart: { x: number; y: number } | null = null;

  constructor() {
    addIcons({ add, chevronBackOutline, chevronForwardOutline, closeOutline, createOutline, sparklesOutline });
  }

  protected go(step: number): void {
    const { year, month } = this.view();
    const next = shiftMonth(year, month, step);
    const index = next.year * 12 + next.month;
    const first = this.current.year * 12 + this.current.month;
    if (index < first || index > first + MONTHS_AHEAD) return;
    this.view.set(next);
    this.clearSelection();
  }

  protected touchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    this.swipeStart = { x: touch.clientX, y: touch.clientY };
  }

  /** Deslizar para o lado muda de mês. */
  protected touchEnd(event: TouchEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) this.go(dx < 0 ? 1 : -1);
  }

  /** Tocar num dia seleciona-o; tocar noutro estende a seleção até lá; um terceiro toque começa de novo. */
  protected tap(cell: Cell): void {
    if (cell.past) return;
    const anchor = this.anchor();
    if (anchor === null || this.end() !== null) {
      this.anchor.set(cell.iso);
      this.end.set(null);
    } else if (anchor === cell.iso) {
      this.anchor.set(null);
    } else {
      this.end.set(cell.iso);
    }
  }

  protected clearSelection(): void {
    this.anchor.set(null);
    this.end.set(null);
  }

  protected time(type: ShiftType): string {
    return type.startsAt && type.endsAt ? `${shortClock(type.startsAt)}–${shortClock(type.endsAt)}` : '';
  }

  protected toneClass(type: ShiftType | null): string {
    return type ? `tone-${type.kind === 'free' ? 'free' : type.tone}` : '';
  }

  protected async applyType(typeId: string | null): Promise<void> {
    const days = this.selected();
    if (!days.length) return;
    try {
      await this.availability.apply(days, typeId);
      this.clearSelection();
    } catch {
      await this.toast('dates.errors.save');
    }
  }

  protected async openType(type: ShiftType | null): Promise<void> {
    const modal = await this.modals.create({ component: ShiftTypeModal, componentProps: { type }, cssClass: 'ct-modal' });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ typeId?: string; created?: boolean }>();
    // Um tipo acabado de criar com dias selecionados aplica-se logo a esses dias.
    if (data?.created && data.typeId && this.selected().length) await this.applyType(data.typeId);
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2200, position: 'top' });
    await toast.present();
  }

  protected meetingDate(meeting: Meeting): string {
    const date = formatTripDate(meetingSpan(meeting), this.language());
    return meeting.startTime ? `${date} · ${meeting.startTime}` : date;
  }

  protected openMeeting(id: string | null): void {
    void this.flow.openMeeting(id);
  }
}
