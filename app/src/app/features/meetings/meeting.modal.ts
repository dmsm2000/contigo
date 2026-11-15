import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { todayIso } from '../../core/availability.logic';
import { MeetingPlace } from '../../core/meetings.logic';
import { MeetingsService } from '../../core/meetings.service';

const PLACES: MeetingPlace[] = ['porto', 'madrid', 'other'];

/** Marcar (ou mudar) um encontro: os dias em que os dois estão juntos sem ser uma viagem. */
@Component({
  selector: 'app-meeting-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './meeting.modal.html',
  styleUrl: './meeting.modal.scss',
})
export class MeetingModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly transloco = inject(TranslocoService);
  private readonly meetings = inject(MeetingsService);

  /** O encontro a mudar; sem id, é um novo. */
  @Input() meetingId: string | null = null;

  protected readonly places = PLACES;
  protected readonly today = todayIso();
  protected readonly place = signal<MeetingPlace>('porto');
  protected start = '';
  protected end = '';
  protected note = '';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const existing = this.meetingId ? this.meetings.byId(this.meetingId) : null;
    if (!existing) return;
    this.place.set(existing.place);
    this.start = existing.startDate;
    this.end = existing.endDate ?? '';
    this.note = existing.note ?? '';
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected onStart(): void {
    if (this.end && this.end < this.start) this.end = this.start;
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    if (!this.start) {
      this.error.set('meeting.errors.start');
      return;
    }
    const input = {
      startDate: this.start,
      endDate: this.end && this.end > this.start ? this.end : null,
      place: this.place(),
      note: this.note.trim() || null,
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.meetingId) await this.meetings.update(this.meetingId, input);
      else await this.meetings.add(input);
      await this.modalCtrl.dismiss();
    } catch {
      this.saving.set(false);
      this.error.set('meeting.errors.save');
    }
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.meetingId;
    if (!id) return;
    const t = (key: string) => this.transloco.translate(key);
    const alert = await this.alerts.create({
      header: t('meeting.deleteTitle'),
      message: t('meeting.deleteText'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('meeting.delete'),
          role: 'destructive',
          handler: () => {
            void this.meetings.remove(id).then(
              () => this.modalCtrl.dismiss(),
              () => this.error.set('meeting.errors.save'),
            );
          },
        },
      ],
    });
    await alert.present();
  }
}
