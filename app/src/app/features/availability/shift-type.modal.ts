import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { AvailabilityService } from '../../core/availability.service';
import { normalizeClock, SHIFT_TONES, ShiftKind, ShiftTone, ShiftType } from '../../core/availability.logic';

interface Preset {
  key: 'free' | 'vacation' | 'unavailable';
  kind: ShiftKind;
}

/** Criar ou mudar um tipo de turno ("Manhã 7h–15h", "Folga", "Sai às 15h"…). Fica guardado para usar noutros dias. */
@Component({
  selector: 'app-shift-type-modal',
  imports: [IonContent, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './shift-type.modal.html',
  styleUrl: './shift-type.modal.scss',
})
export class ShiftTypeModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly transloco = inject(TranslocoService);
  private readonly availability = inject(AvailabilityService);

  /** O tipo a mudar; sem ele, cria-se um novo. */
  @Input() type: ShiftType | null = null;

  protected name = '';
  protected startsAt = '';
  protected endsAt = '';
  protected readonly kind = signal<ShiftKind>('busy');
  protected readonly tone = signal<ShiftTone>('morning');
  protected readonly kinds: readonly ShiftKind[] = ['busy', 'free'];
  protected readonly tones = SHIFT_TONES;
  protected readonly presets: readonly Preset[] = [
    { key: 'free', kind: 'free' },
    { key: 'vacation', kind: 'free' },
    { key: 'unavailable', kind: 'busy' },
  ];

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const type = this.type;
    if (!type) return;
    this.name = type.name;
    this.kind.set(type.kind);
    this.tone.set(type.tone);
    this.startsAt = type.startsAt ?? '';
    this.endsAt = type.endsAt ?? '';
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected usePreset(preset: Preset): void {
    this.name = this.transloco.translate(`shift.presets.${preset.key}`);
    this.kind.set(preset.kind);
    this.startsAt = '';
    this.endsAt = '';
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    const name = this.name.trim();
    if (!name) return this.fail('shift.form.errors.name');

    const startsAt = this.startsAt ? normalizeClock(this.startsAt) : null;
    const endsAt = this.endsAt ? normalizeClock(this.endsAt) : null;
    if ((this.startsAt && !startsAt) || (this.endsAt && !endsAt) || Boolean(startsAt) !== Boolean(endsAt)) {
      return this.fail('shift.form.errors.times');
    }

    this.saving.set(true);
    this.error.set(null);
    const input = { name, kind: this.kind(), startsAt, endsAt, tone: this.tone() };
    try {
      if (this.type) {
        await this.availability.updateType(this.type.id, input);
        await this.modalCtrl.dismiss({ typeId: this.type.id });
      } else {
        const created = await this.availability.createType(input);
        await this.modalCtrl.dismiss({ typeId: created.id, created: true });
      }
    } catch {
      this.saving.set(false);
      this.fail('shift.form.errors.save');
    }
  }

  protected async confirmDelete(): Promise<void> {
    const type = this.type;
    if (!type) return;
    const t = (key: string, params?: Record<string, unknown>) => this.transloco.translate(key, params);
    const count = this.availability.daysUsing(type.id);
    const alert = await this.alerts.create({
      header: t('shift.deleteTitle'),
      message:
        count === 0
          ? t('shift.deleteTextNone', { name: type.name })
          : t(count === 1 ? 'shift.deleteText_one' : 'shift.deleteText_other', { name: type.name, count }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('shift.delete'), role: 'destructive', handler: () => void this.remove(type) },
      ],
    });
    await alert.present();
  }

  private async remove(type: ShiftType): Promise<void> {
    try {
      await this.availability.deleteType(type.id);
    } catch {
      return this.fail('shift.form.errors.delete');
    }
    await this.modalCtrl.dismiss({ deleted: true });
  }

  private fail(key: string): void {
    this.error.set(key);
  }
}
