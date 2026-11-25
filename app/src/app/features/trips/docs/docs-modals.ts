import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonFooter, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, openOutline, trashOutline } from 'ionicons/icons';
import { DOC_NAME_MAX, DOC_NOTE_MAX, nextColor, NOTE_COLORS, NOTE_MAX, NoteColor } from '../../../core/trip-docs.logic';
import { TripDocsService } from '../../../core/trip-docs.service';
import { TripPlanService } from '../../../core/trip-plan.service';

/** Pergunta se se quer mesmo apagar; devolve `true` só se disserem que sim. */
async function confirmDelete(alerts: AlertController, transloco: TranslocoService, title: string, message: string): Promise<boolean> {
  const t = (key: string) => transloco.translate(key);
  return new Promise<boolean>(async (resolve) => {
    const alert = await alerts.create({
      header: t(title),
      message: t(message),
      buttons: [
        { text: t('docs.keep'), role: 'cancel', handler: () => resolve(false) },
        { text: t('docs.delete'), role: 'destructive', handler: () => resolve(true) },
      ],
    });
    alert.onDidDismiss().then(() => resolve(false));
    await alert.present();
  });
}

// ---------------------------------------------------------------- post-it

/** Escreve ou edita um post-it: o texto, a cor e se fica fixado no topo. */
@Component({
  selector: 'app-note-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ (noteId ? 'docs.note.editTitle' : 'docs.note.newTitle') | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>

        <section class="block">
          <label class="label" for="note-body">{{ 'docs.note.label' | transloco }}</label>
          <textarea id="note-body" class="note-text" rows="6" name="body" [attr.maxlength]="max" [placeholder]="'docs.note.placeholder' | transloco" [ngModel]="body()" (ngModelChange)="body.set($event)"></textarea>
        </section>

        <section class="block">
          <span class="label" id="color-label">{{ 'docs.note.color' | transloco }}</span>
          <div class="colors" role="group" aria-labelledby="color-label">
            @for (option of colors; track option) {
              <button class="dot" type="button" [class]="'dot c-' + option" [class.on]="color() === option" [attr.aria-pressed]="color() === option" [attr.aria-label]="'docs.color.' + option | transloco" (click)="color.set(option)"></button>
            }
          </div>
        </section>

        <section class="block">
          <div class="pills">
            <button class="pill" type="button" [class.on]="pinned()" [attr.aria-pressed]="pinned()" (click)="pinned.set(!pinned())">{{ 'docs.note.pin' | transloco }}</button>
          </div>
          <p class="hint">{{ 'docs.note.pinHint' | transloco }}</p>
        </section>

        @if (noteId) {
          <button class="danger" type="button" (click)="remove()"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon>{{ 'docs.note.delete' | transloco }}</button>
        }
        @if (failed()) {
          <p class="error" role="alert">{{ 'docs.saveFailed' | transloco }}</p>
        }
      </div>
    </ion-content>
    <ion-footer class="form-footer">
      <button class="ct-btn save" type="button" [disabled]="saving() || !body().trim()" (click)="save()">{{ (saving() ? 'trip.form.saving' : 'docs.save') | transloco }}</button>
    </ion-footer>
  `,
  styleUrl: './docs-modals.scss',
})
export class NoteModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly docs = inject(TripDocsService);
  private readonly alerts = inject(AlertController);
  private readonly transloco = inject(TranslocoService);

  @Input() tripId = '';
  @Input() noteId = '';

  protected readonly colors = NOTE_COLORS;
  protected readonly max = NOTE_MAX;
  protected readonly body = signal('');
  protected readonly color = signal<NoteColor>('yellow');
  protected readonly pinned = signal(false);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const existing = this.noteId ? this.docs.notesOf(this.tripId).find((note) => note.id === this.noteId) : null;
    if (existing) {
      this.body.set(existing.body);
      this.color.set(existing.color);
      this.pinned.set(existing.pinned);
    } else {
      // Os post-its novos saem de cores diferentes, para se distinguirem à primeira vista.
      this.color.set(nextColor(this.docs.notesOf(this.tripId).length));
    }
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.body().trim()) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      const input = { body: this.body(), color: this.color(), pinned: this.pinned() };
      if (this.noteId) await this.docs.updateNote(this.noteId, input);
      else await this.docs.addNote(this.tripId, input);
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (!(await confirmDelete(this.alerts, this.transloco, 'docs.note.deleteTitle', 'docs.note.deleteText'))) return;
    try {
      await this.docs.removeNote(this.noteId);
      await this.modalCtrl.dismiss({ removed: true });
    } catch {
      this.failed.set(true);
    }
  }
}

// ---------------------------------------------------------------- ficheiro

/** Muda o nome e a nota de um ficheiro, abre-o ou apaga-o. */
@Component({
  selector: 'app-doc-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  template: `
    <ion-content>
      <div class="sheet">
        <header class="head">
          <h1 class="ct-display title">{{ 'docs.file.title' | transloco }}</h1>
          <button class="ct-icon-btn" type="button" (click)="close()" [attr.aria-label]="'common.close' | transloco"><ion-icon name="close-outline" aria-hidden="true"></ion-icon></button>
        </header>

        <section class="block">
          <label class="label" for="doc-name">{{ 'docs.file.name' | transloco }}</label>
          <input id="doc-name" type="text" name="name" [attr.maxlength]="nameMax" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        </section>

        <section class="block">
          <label class="label" for="doc-note">{{ 'docs.file.note' | transloco }} <em>({{ 'docs.optional' | transloco }})</em></label>
          <textarea id="doc-note" rows="3" name="note" [attr.maxlength]="noteMax" [placeholder]="'docs.file.notePlaceholder' | transloco" [ngModel]="note()" (ngModelChange)="note.set($event)"></textarea>
        </section>

        @if (legOptions().length) {
          <section class="block">
            <label class="label" for="doc-leg">{{ 'docs.file.leg' | transloco }} <em>({{ 'docs.optional' | transloco }})</em></label>
            <select id="doc-leg" name="leg" [ngModel]="legId()" (ngModelChange)="legId.set($event)">
              <option value="">{{ 'docs.file.noLeg' | transloco }}</option>
              @for (option of legOptions(); track option.id) {
                <option [value]="option.id">{{ option.label }}</option>
              }
            </select>
            <p class="hint">{{ 'docs.file.legHint' | transloco }}</p>
          </section>
        }

        <section class="block">
          <button class="ct-btn ct-btn--ghost open" type="button" [disabled]="opening()" (click)="open()"><ion-icon name="open-outline" aria-hidden="true"></ion-icon>{{ 'docs.file.open' | transloco }}</button>
        </section>

        <button class="danger" type="button" (click)="remove()"><ion-icon name="trash-outline" aria-hidden="true"></ion-icon>{{ 'docs.file.delete' | transloco }}</button>
        @if (failed()) {
          <p class="error" role="alert">{{ failedKey() | transloco }}</p>
        }
      </div>
    </ion-content>
    <ion-footer class="form-footer">
      <button class="ct-btn save" type="button" [disabled]="saving() || !name().trim()" (click)="save()">{{ (saving() ? 'trip.form.saving' : 'docs.save') | transloco }}</button>
    </ion-footer>
  `,
  styleUrl: './docs-modals.scss',
})
export class DocModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly docs = inject(TripDocsService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly plan = inject(TripPlanService);

  @Input() tripId = '';
  @Input() docId = '';

  protected readonly nameMax = DOC_NAME_MAX;
  protected readonly noteMax = DOC_NOTE_MAX;
  protected readonly name = signal('');
  protected readonly note = signal('');
  protected readonly legId = signal('');
  /** As deslocações da viagem, para ligar o bilhete a uma: "Ida · Desde Porto · Comboio". */
  protected readonly legOptions = computed(() =>
    this.plan.legsOf(this.tripId).map((leg) => ({
      id: leg.id,
      label: [
        this.transloco.translate(`plan.legs.directions.${leg.direction}`),
        leg.origin ? this.transloco.translate('plan.legs.from', { origin: leg.origin }) : this.transloco.translate('plan.legs.everyone'),
        this.transloco.translate(`plan.legs.modes.${leg.mode}`),
      ].join(' · '),
    })),
  );
  protected readonly saving = signal(false);
  protected readonly opening = signal(false);
  protected readonly failed = signal(false);
  protected readonly failedKey = signal('docs.saveFailed');

  constructor() {
    addIcons({ closeOutline, openOutline, trashOutline });
  }

  ngOnInit(): void {
    const doc = this.docs.docsOf(this.tripId).find((item) => item.id === this.docId);
    if (doc) {
      this.name.set(doc.name);
      this.note.set(doc.note ?? '');
      this.legId.set(doc.legId ?? '');
    }
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async open(): Promise<void> {
    const doc = this.docs.docsOf(this.tripId).find((item) => item.id === this.docId);
    if (!doc) return;
    this.opening.set(true);
    const result = await this.docs.open(doc);
    this.opening.set(false);
    if (result !== 'opened') {
      const toast = await this.toasts.create({ message: this.transloco.translate(result === 'offline' ? 'docs.openOffline' : 'docs.openFailed'), duration: 2600, position: 'bottom' });
      await toast.present();
    }
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.name().trim()) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.docs.updateDoc(this.docId, { name: this.name(), note: this.note(), legId: this.legId() || null });
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.failedKey.set('docs.saveFailed');
      this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const doc = this.docs.docsOf(this.tripId).find((item) => item.id === this.docId);
    if (!doc || !(await confirmDelete(this.alerts, this.transloco, 'docs.file.deleteTitle', 'docs.file.deleteText'))) return;
    try {
      await this.docs.removeDoc(doc);
      await this.modalCtrl.dismiss({ removed: true });
    } catch {
      this.failedKey.set('docs.deleteFailed');
      this.failed.set(true);
    }
  }
}
