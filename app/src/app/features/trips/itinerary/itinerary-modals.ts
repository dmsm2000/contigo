import { Component, computed, ElementRef, inject, Input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { clipboardOutline, closeOutline } from 'ionicons/icons';
import { buildRequest, ParseError, parseItinerary, Pace } from '../../../core/itinerary.logic';
import { ItineraryService } from '../../../core/itinerary.service';
import { LanguageService } from '../../../core/language.service';
import { TripPlanService } from '../../../core/trip-plan.service';
import { placeSubtitle } from '../../../core/trips.logic';
import { TripsService } from '../../../core/trips.service';
import { daysBetween } from './itinerary-days';

const PACES: Pace[] = ['relaxed', 'balanced', 'packed'];
/** O máximo de texto no campo "o que queremos" (cabem as notas da viagem inteiras). */
const NOTES_MAX = 1500;

// ---------------------------------------------------------------- pedir o roteiro

/**
 * Compõe o pedido (com tudo o que a app sabe da viagem) para se colar num chat. Não há IA na app: a resposta do chat
 * volta pelo outro ecrã, "Colar roteiro".
 */
@Component({
  selector: 'app-itinerary-request-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ 'itinerary.request.title' | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>
        <p class="hint intro">{{ 'itinerary.request.intro' | transloco }}</p>

        <section class="block">
          <span class="label" id="pace-label">{{ 'itinerary.request.pace' | transloco }}</span>
          <div class="pills wrap" role="group" aria-labelledby="pace-label">
            @for (option of paces; track option) {
              <button class="pill" type="button" [class.on]="pace() === option" [attr.aria-pressed]="pace() === option" (click)="pace.set(option)">{{ 'itinerary.pace.' + option | transloco }}</button>
            }
          </div>
        </section>

        <section class="block">
          <label class="label" for="itinerary-notes">{{ 'itinerary.request.notes' | transloco }}</label>
          <textarea id="itinerary-notes" class="wants" name="notes" rows="5" [attr.maxlength]="notesMax" [placeholder]="'itinerary.request.notesPlaceholder' | transloco" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
          <p class="hint">{{ 'itinerary.request.notesHint' | transloco }}</p>
        </section>

        <section class="block">
          <label class="label" for="itinerary-preview">{{ 'itinerary.request.preview' | transloco }}</label>
          <textarea #preview id="itinerary-preview" class="preview" rows="9" readonly [value]="request()"></textarea>
          <p class="hint">{{ 'itinerary.request.step' | transloco }}</p>
        </section>
      </div>
    </ion-content>
    <ion-footer class="form-footer">
      <button class="ct-btn save" type="button" (click)="copy()">
        <ion-icon name="clipboard-outline" aria-hidden="true"></ion-icon>
        {{ (copied() ? 'itinerary.request.copied' : 'itinerary.request.copy') | transloco }}
      </button>
      <button class="ct-btn ct-btn--ghost second" type="button" (click)="haveAnswer()">{{ 'itinerary.request.haveAnswer' | transloco }}</button>
    </ion-footer>
  `,
  styleUrl: './itinerary-modals.scss',
})
export class ItineraryRequestModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly trips = inject(TripsService);
  private readonly plan = inject(TripPlanService);
  private readonly language = inject(LanguageService).language;
  private readonly preview = viewChild<ElementRef<HTMLTextAreaElement>>('preview');

  @Input() tripId = '';

  protected readonly paces = PACES;
  protected readonly pace = signal<Pace>('balanced');
  protected readonly notesMax = NOTES_MAX;
  protected readonly notes = signal('');
  protected readonly copied = signal(false);

  protected readonly request = computed(() => {
    const trip = this.trips.trips().find((item) => item.id === this.tripId);
    if (!trip) return '';
    const lang = this.language();
    const stay = this.plan.staysOf(trip.id).find((item) => item.chosen);
    const origins = [...new Set(this.plan.legsOf(trip.id).map((leg) => leg.origin.trim()).filter(Boolean))];
    const wishes = this.plan
      .checklistOf(trip.id)
      .filter((item) => item.kind !== 'todo' && !item.done)
      .map((item) => item.text);
    const known = trip.datesConfirmed && trip.datePrecision === 'day';
    return buildRequest({
      place: [trip.place.name, placeSubtitle(trip.place, lang)].filter(Boolean).join(', '),
      startDate: known ? trip.startDate : null,
      endDate: known ? (trip.endDate ?? trip.startDate) : null,
      days: known ? daysBetween(trip.startDate, trip.endDate ?? trip.startDate) : null,
      people: 2,
      budgetCap: trip.budgetCapEur,
      origins,
      stay: stay?.name ?? null,
      wishes,
      pace: this.pace(),
      notes: this.notes(),
      // As notas do plano entram no campo "o que queremos" (já vem preenchido), por isso não vão duas vezes.
      planNote: null,
      language: lang,
    });
  });

  constructor() {
    addIcons({ clipboardOutline, closeOutline });
  }

  ngOnInit(): void {
    // O campo já vem com as notas da viagem; podem mudá-las à vontade antes de copiar.
    const note = this.trips.trips().find((item) => item.id === this.tripId)?.planNote;
    if (note?.trim()) this.notes.set(note.trim().slice(0, NOTES_MAX));
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected haveAnswer(): void {
    void this.modalCtrl.dismiss({ next: 'import' });
  }

  protected async copy(): Promise<void> {
    const request = this.request();
    let done = false;
    try {
      await navigator.clipboard.writeText(request);
      done = true;
    } catch {
      // Sem permissão (ou sem a API): seleciona-se a caixa e copia-se à antiga.
      const box = this.preview()?.nativeElement;
      if (box) {
        box.focus();
        box.select();
        done = document.execCommand('copy');
      }
    }
    this.copied.set(done);
    const toast = await this.toasts.create({
      message: this.transloco.translate(done ? 'itinerary.request.copiedToast' : 'itinerary.request.copyFailed'),
      duration: 2600,
      position: 'bottom',
    });
    await toast.present();
  }
}

// ---------------------------------------------------------------- colar a resposta

/** Cola a resposta do chat, valida-a e guarda-a como rascunho. */
@Component({
  selector: 'app-itinerary-import-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ 'itinerary.import.title' | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>
        <p class="hint intro">{{ 'itinerary.import.intro' | transloco }}</p>

        <section class="block">
          <label class="label" for="itinerary-answer">{{ 'itinerary.import.label' | transloco }}</label>
          <textarea id="itinerary-answer" class="answer" rows="12" [placeholder]="'itinerary.import.placeholder' | transloco" [ngModel]="answer()" (ngModelChange)="answer.set($event); error.set(null)"></textarea>
          <button class="paste" type="button" (click)="paste()">
            <ion-icon name="clipboard-outline" aria-hidden="true"></ion-icon>{{ 'itinerary.import.paste' | transloco }}
          </button>
        </section>

        @if (error(); as problem) {
          <p class="error" role="alert">{{ problem.key | transloco: problem.params }}</p>
        }
      </div>
    </ion-content>
    <ion-footer class="form-footer">
      <button class="ct-btn save" type="button" [disabled]="saving() || !answer().trim()" (click)="save()">
        {{ (saving() ? 'trip.form.saving' : 'itinerary.import.save') | transloco }}
      </button>
    </ion-footer>
  `,
  styleUrl: './itinerary-modals.scss',
})
export class ItineraryImportModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly itineraries = inject(ItineraryService);

  @Input() tripId = '';

  protected readonly answer = signal('');
  protected readonly error = signal<ParseError | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    addIcons({ clipboardOutline, closeOutline });
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async paste(): Promise<void> {
    try {
      this.answer.set(await navigator.clipboard.readText());
      this.error.set(null);
    } catch {
      // O iPhone pode recusar: cola-se à mão na caixa.
    }
  }

  protected async save(): Promise<void> {
    const result = parseItinerary(this.answer());
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.saving.set(true);
    try {
      await this.itineraries.importDraft(this.tripId, result.value);
      await this.modalCtrl.dismiss({ saved: true, skipped: result.skipped });
    } catch {
      this.saving.set(false);
      this.error.set({ key: 'itinerary.errors.save' });
    }
  }
}
