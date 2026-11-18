import { AfterViewInit, Component, ElementRef, inject, Input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { parseAmount } from '../../../core/expenses.logic';
import { DateOption, formatDuration, Leg, LEG_DIRECTIONS, LEG_MODES, LegDirection, LegMode, parseDuration, Stay } from '../../../core/trip-plan.logic';
import { TripPlanService } from '../../../core/trip-plan.service';

/** Os campos de texto de um euro (opcionais): vazio é nulo, inválido é 'invalid'. */
function optionalAmount(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const value = parseAmount(text);
  return value === 'invalid' ? 'invalid' : value;
}

const euros = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));

// ---------------------------------------------------------------- opção de datas

/** Uma opção de datas em avaliação ("2 a 4 de dezembro, a preferida"). */
@Component({
  selector: 'app-date-option-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ (option ? 'plan.dates.editTitle' : 'plan.dates.addTitle') | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>
        <form id="date-form" (ngSubmit)="save()" novalidate>
          <section class="block">
            <div class="row-2">
              <label class="field">
                <span class="field-label">{{ 'plan.form.from' | transloco }}</span>
                <input name="start" type="date" [(ngModel)]="start" (ngModelChange)="onStart()" />
              </label>
              <label class="field">
                <span class="field-label">{{ 'plan.form.to' | transloco }}</span>
                <input name="end" type="date" [min]="start" [(ngModel)]="end" (ngModelChange)="error.set(null)" />
              </label>
            </div>
          </section>
          <section class="block">
            <label class="label" for="date-note">{{ 'plan.note' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></label>
            <input id="date-note" name="note" type="text" maxlength="200" autocomplete="off" [placeholder]="'plan.dates.notePlaceholder' | transloco" [(ngModel)]="note" />
          </section>
          @if (error(); as key) {<p class="error" role="alert">{{ key | transloco }}</p>}
          @if (option) {
            <button class="ct-btn ct-btn--ghost danger" type="button" (click)="remove()"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon>{{ 'plan.remove' | transloco }}</button>
          }
        </form>
      </div>
    </ion-content>
    <ion-footer class="form-footer"><button class="ct-btn save" type="submit" form="date-form" [disabled]="saving()">{{ 'plan.save' | transloco }}</button></ion-footer>
  `,
  styleUrl: './plan-forms.scss',
})
export class DateOptionModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly plan = inject(TripPlanService);
  @Input() tripId = '';
  @Input() option: DateOption | null = null;
  protected start = '';
  protected end = '';
  protected note = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    if (!this.option) return;
    this.start = this.option.startDate;
    this.end = this.option.endDate;
    this.note = this.option.note ?? '';
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected onStart(): void {
    if (!this.end || this.end < this.start) this.end = this.start;
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    if (!this.start) return this.error.set('plan.dates.errors.start');
    const input = { start: this.start, end: this.end && this.end >= this.start ? this.end : this.start, note: this.note.trim() || null };
    this.saving.set(true);
    try {
      if (this.option) await this.plan.updateDateOption(this.option.id, input);
      else await this.plan.addDateOption(this.tripId, input);
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.saving.set(false);
      this.error.set('plan.errors.save');
    }
  }

  protected async remove(): Promise<void> {
    if (!this.option) return;
    try {
      await this.plan.removeDateOption(this.option.id);
      await this.modalCtrl.dismiss({ removed: true });
    } catch {
      this.error.set('plan.errors.save');
    }
  }
}

// ---------------------------------------------------------------- alojamento

/** Uma opção de alojamento: nome, preço total, nota (parking, cancelamento…) e ligação. */
@Component({
  selector: 'app-stay-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ (stay ? 'plan.stays.editTitle' : 'plan.stays.addTitle') | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>
        <form id="stay-form" (ngSubmit)="save()" novalidate>
          <section class="block">
            <label class="label" for="stay-name">{{ 'plan.stays.name' | transloco }}</label>
            <input #field id="stay-name" name="name" type="text" maxlength="120" autocomplete="off" [placeholder]="'plan.stays.namePlaceholder' | transloco" [(ngModel)]="name" (ngModelChange)="error.set(null)" />
          </section>
          <section class="block">
            <div class="row-2">
              <label class="field">
                <span class="field-label">{{ 'plan.stays.price' | transloco }}</span>
                <input name="price" type="text" inputmode="decimal" autocomplete="off" placeholder="0" [(ngModel)]="price" (ngModelChange)="error.set(null)" />
              </label>
              <label class="field">
                <span class="field-label">{{ 'plan.stays.rating' | transloco }}</span>
                <input name="rating" type="text" inputmode="decimal" autocomplete="off" placeholder="8,5" [(ngModel)]="rating" (ngModelChange)="error.set(null)" />
              </label>
            </div>
            <p class="hint">{{ 'plan.stays.priceHint' | transloco }}</p>
          </section>
          <section class="block">
            <label class="label" for="stay-note">{{ 'plan.note' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></label>
            <textarea id="stay-note" name="note" rows="3" maxlength="500" [placeholder]="'plan.stays.notePlaceholder' | transloco" [(ngModel)]="note"></textarea>
          </section>
          <section class="block">
            <label class="label" for="stay-link">{{ 'wish.form.link' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></label>
            <input id="stay-link" name="link" type="url" inputmode="url" autocomplete="off" autocapitalize="none" placeholder="https://" [(ngModel)]="link" />
          </section>
          @if (error(); as key) {<p class="error" role="alert">{{ key | transloco }}</p>}
          @if (stay) {
            <button class="ct-btn ct-btn--ghost danger" type="button" (click)="remove()"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon>{{ 'plan.remove' | transloco }}</button>
          }
        </form>
      </div>
    </ion-content>
    <ion-footer class="form-footer"><button class="ct-btn save" type="submit" form="stay-form" [disabled]="saving()">{{ 'plan.save' | transloco }}</button></ion-footer>
  `,
  styleUrl: './plan-forms.scss',
})
export class StayModal implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly plan = inject(TripPlanService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  @Input() tripId = '';
  @Input() stay: Stay | null = null;
  protected name = '';
  protected price = '';
  protected rating = '';
  protected note = '';
  protected link = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const stay = this.stay;
    if (!stay) return;
    this.name = stay.name;
    this.price = euros(stay.priceEur);
    this.rating = stay.rating === null ? '' : String(stay.rating).replace('.', ',');
    this.note = stay.note ?? '';
    this.link = stay.link ?? '';
  }

  ngAfterViewInit(): void {
    if (!this.stay) setTimeout(() => this.field()?.nativeElement.focus(), 450);
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) return this.error.set('plan.stays.errors.name');
    const priceEur = optionalAmount(this.price);
    if (priceEur === 'invalid') return this.error.set('plan.errors.amount');
    const ratingText = this.rating.trim().replace(',', '.');
    const rating = ratingText ? Number(ratingText) : null;
    if (rating !== null && !(rating >= 0 && rating <= 10)) return this.error.set('plan.stays.errors.rating');
    const link = this.link.trim();
    if (link && !/^https?:\/\//i.test(link)) return this.error.set('wish.form.errors.link');
    this.saving.set(true);
    try {
      await this.plan.saveStay(this.tripId, { id: this.stay?.id, name, priceEur, rating, note: this.note.trim() || null, link: link || null });
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.saving.set(false);
      this.error.set('plan.errors.save');
    }
  }

  protected async remove(): Promise<void> {
    if (!this.stay) return;
    try {
      await this.plan.removeStay(this.stay.id);
      await this.modalCtrl.dismiss({ removed: true });
    } catch {
      this.error.set('plan.errors.save');
    }
  }
}

// ---------------------------------------------------------------- como chegar

/** Como se chega de uma origem (Porto, Madrid…): meio, duração, preço e nota. */
@Component({
  selector: 'app-leg-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ (leg ? 'plan.legs.editTitle' : 'plan.legs.addTitle') | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>
        <form id="leg-form" (ngSubmit)="save()" novalidate>
          <section class="block">
            <label class="label" for="leg-origin">{{ 'plan.legs.origin' | transloco }}</label>
            <input #field id="leg-origin" name="origin" type="text" maxlength="60" autocomplete="off" [placeholder]="'plan.legs.originPlaceholder' | transloco" [(ngModel)]="origin" (ngModelChange)="error.set(null)" />
            <p class="hint">{{ 'plan.legs.originHint' | transloco }}</p>
          </section>
          <section class="block">
            <span class="label" id="leg-direction">{{ 'plan.legs.direction' | transloco }}</span>
            <div class="pills" role="group" aria-labelledby="leg-direction">
              @for (option of directions; track option) {
                <button class="pill" type="button" [class.on]="directionSignal() === option" [attr.aria-pressed]="directionSignal() === option" (click)="directionSignal.set(option)">{{ 'plan.legs.directions.' + option | transloco }}</button>
              }
            </div>
          </section>
          <section class="block">
            <span class="label" id="leg-mode">{{ 'plan.legs.mode' | transloco }}</span>
            <div class="pills wrap" role="group" aria-labelledby="leg-mode">
              @for (option of modes; track option) {
                <button class="pill" type="button" [class.on]="mode() === option" [attr.aria-pressed]="mode() === option" (click)="mode.set(option)">{{ 'plan.legs.modes.' + option | transloco }}</button>
              }
            </div>
          </section>
          <section class="block">
            <label class="field">
              <span class="field-label">{{ 'plan.legs.day' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></span>
              <input name="departsOn" type="date" [(ngModel)]="departsOn" />
            </label>
            <div class="row-2">
              <label class="field">
                <span class="field-label">{{ 'plan.legs.departs' | transloco }}</span>
                <input name="departsTime" type="time" [(ngModel)]="departsTime" />
              </label>
              <label class="field">
                <span class="field-label">{{ 'plan.legs.arrives' | transloco }}</span>
                <input name="arrivesTime" type="time" [(ngModel)]="arrivesTime" />
              </label>
            </div>
          </section>
          <section class="block">
            <div class="row-2">
              <label class="field">
                <span class="field-label">{{ 'plan.legs.duration' | transloco }}</span>
                <input name="duration" type="text" autocomplete="off" placeholder="3h30" [(ngModel)]="duration" (ngModelChange)="error.set(null)" />
              </label>
              <label class="field">
                <span class="field-label">{{ 'plan.legs.price' | transloco }}</span>
                <input name="price" type="text" inputmode="decimal" autocomplete="off" placeholder="0" [(ngModel)]="price" (ngModelChange)="error.set(null)" />
              </label>
            </div>
            <p class="hint">{{ 'plan.legs.priceHint' | transloco }}</p>
          </section>
          <section class="block">
            <label class="label" for="leg-note">{{ 'plan.note' | transloco }} <em>({{ 'trip.form.optional' | transloco }})</em></label>
            <textarea id="leg-note" name="note" rows="3" maxlength="300" [placeholder]="'plan.legs.notePlaceholder' | transloco" [(ngModel)]="note"></textarea>
          </section>
          @if (error(); as key) {<p class="error" role="alert">{{ key | transloco }}</p>}
          @if (leg) {
            <button class="ct-btn ct-btn--ghost danger" type="button" (click)="remove()"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon>{{ 'plan.remove' | transloco }}</button>
          }
        </form>
      </div>
    </ion-content>
    <ion-footer class="form-footer"><button class="ct-btn save" type="submit" form="leg-form" [disabled]="saving()">{{ 'plan.save' | transloco }}</button></ion-footer>
  `,
  styleUrl: './plan-forms.scss',
})
export class LegModal implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly plan = inject(TripPlanService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  @Input() tripId = '';
  @Input() leg: Leg | null = null;
  /** O sentido de partida ao juntar uma deslocação nova (a ida ou a volta). */
  @Input() set direction(value: LegDirection) { this.directionSignal.set(value); }
  protected readonly modes = LEG_MODES;
  protected readonly directions = LEG_DIRECTIONS;
  private readonly directionSignal = signal<LegDirection>('out');
  protected readonly mode = signal<LegMode>('car');
  protected origin = '';
  protected duration = '';
  protected price = '';
  protected note = '';
  protected departsOn = '';
  protected departsTime = '';
  protected arrivesTime = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const leg = this.leg;
    if (!leg) return;
    this.origin = leg.origin;
    this.mode.set(leg.mode);
    this.directionSignal.set(leg.direction);
    this.duration = leg.minutes === null ? '' : formatDuration(leg.minutes);
    this.price = euros(leg.priceEur);
    this.note = leg.note ?? '';
    this.departsOn = leg.departsOn ?? '';
    this.departsTime = leg.departsTime ?? '';
    this.arrivesTime = leg.arrivesTime ?? '';
  }

  ngAfterViewInit(): void {
    if (!this.leg) setTimeout(() => this.field()?.nativeElement.focus(), 450);
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async save(): Promise<void> {
    const origin = this.origin.trim();
    const minutes = parseDuration(this.duration);
    if (minutes === 'invalid') return this.error.set('plan.legs.errors.duration');
    const priceEur = optionalAmount(this.price);
    if (priceEur === 'invalid') return this.error.set('plan.errors.amount');
    this.saving.set(true);
    try {
      await this.plan.saveLeg(this.tripId, { id: this.leg?.id, origin, direction: this.directionSignal(), mode: this.mode(), departsOn: this.departsOn || null, departsTime: this.departsTime || null, arrivesTime: this.arrivesTime || null, minutes, priceEur, note: this.note.trim() || null });
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.saving.set(false);
      this.error.set('plan.errors.save');
    }
  }

  protected async remove(): Promise<void> {
    if (!this.leg) return;
    try {
      await this.plan.removeLeg(this.leg.id);
      await this.modalCtrl.dismiss({ removed: true });
    } catch {
      this.error.set('plan.errors.save');
    }
  }
}
