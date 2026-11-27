import { Component, ElementRef, inject, Input, OnInit, signal, viewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { todayIso } from '../../core/availability.logic';
import { checkDeposit, DEPOSIT_NOTE_MAX } from '../../core/deposits.logic';
import { DepositsService } from '../../core/deposits.service';

/** Pôr dinheiro na cebola (ou mudar um depósito): vale para o mês do dia escolhido, além da dotação mensal. */
@Component({
  selector: 'app-deposit-modal',
  imports: [IonContent, IonFooter, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './deposit.modal.html',
  styleUrl: './deposit.modal.scss',
})
export class DepositModal implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly transloco = inject(TranslocoService);
  private readonly deposits = inject(DepositsService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** O depósito a mudar; sem id, é um novo. */
  @Input() depositId: string | null = null;

  protected readonly today = todayIso();
  protected readonly noteMax = DEPOSIT_NOTE_MAX;
  protected amount = '';
  protected day = this.today;
  protected note = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline, trashOutline });
  }

  ngOnInit(): void {
    const existing = this.depositId ? this.deposits.byId(this.depositId) : null;
    if (!existing) return;
    this.amount = String(existing.amount).replace('.', ',');
    this.day = existing.madeOn;
    this.note = existing.note ?? '';
  }

  ngAfterViewInit(): void {
    if (!this.depositId) setTimeout(() => this.field()?.nativeElement.focus(), 450);
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected async save(): Promise<void> {
    const check = checkDeposit(this.amount, this.day, this.today);
    if (!check.ok) {
      this.error.set(`deposit.errors.${check.error}`);
      return;
    }
    const input = { amount: check.amount, madeOn: this.day, note: this.note.trim() || null };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.depositId) await this.deposits.update(this.depositId, input);
      else await this.deposits.add(input);
      await this.modalCtrl.dismiss({ saved: true });
    } catch {
      this.saving.set(false);
      this.error.set('deposit.errors.save');
    }
  }

  protected async confirmDelete(): Promise<void> {
    const id = this.depositId;
    if (!id) return;
    const t = (key: string) => this.transloco.translate(key);
    const alert = await this.alerts.create({
      header: t('deposit.deleteTitle'),
      message: t('deposit.deleteText'),
      buttons: [
        { text: t('deposit.keep'), role: 'cancel' },
        {
          text: t('deposit.delete'),
          role: 'destructive',
          handler: () => {
            void this.deposits.remove(id).then(
              () => this.modalCtrl.dismiss({ removed: true }),
              () => this.error.set('deposit.errors.save'),
            );
          },
        },
      ],
    });
    await alert.present();
  }
}
