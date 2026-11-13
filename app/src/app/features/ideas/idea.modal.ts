import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, ModalController, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { cleanIdeaText, Idea, MAX_IDEA_LENGTH } from '../../core/ideas.logic';
import { IdeasService } from '../../core/ideas.service';

/** Escrever uma ideia nova ou mudar uma que já escreveste. */
@Component({
  selector: 'app-idea-modal',
  imports: [IonContent, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './idea.modal.html',
  styleUrl: './idea.modal.scss',
})
export class IdeaModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly ideas = inject(IdeasService);

  /** A ideia a mudar; sem ela, escreve-se uma nova. */
  @Input() idea: Idea | null = null;

  protected body = '';
  protected readonly maxLength = MAX_IDEA_LENGTH;
  protected readonly length = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    addIcons({ closeOutline });
  }

  ngOnInit(): void {
    if (this.idea) {
      this.body = this.idea.body;
      this.length.set(this.body.length);
    }
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }

  protected onInput(): void {
    this.length.set(this.body.length);
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    const text = cleanIdeaText(this.body);
    if (text === 'empty') return this.error.set('ideas.form.errors.empty');
    if (text === 'tooLong') return this.error.set('ideas.form.errors.tooLong');

    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.idea) await this.ideas.edit(this.idea.id, text);
      else await this.ideas.add(text);
    } catch {
      this.saving.set(false);
      return this.error.set('ideas.form.errors.save');
    }
    await this.modalCtrl.dismiss({ saved: true });
    const toast = await this.toasts.create({
      message: this.transloco.translate(this.idea ? 'ideas.form.updated' : 'ideas.form.saved'),
      duration: 2200,
      position: 'top',
    });
    await toast.present();
  }
}
