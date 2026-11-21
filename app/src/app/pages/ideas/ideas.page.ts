import { Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { add, bulbOutline, chevronBackOutline, createOutline, trashOutline } from 'ionicons/icons';
import { filterIdeas, Idea, IDEA_STATUSES, IdeaFilter, IdeaStatus } from '../../core/ideas.logic';
import { IdeasService } from '../../core/ideas.service';
import { shortenLinks } from '../../core/links.logic';
import { AuditLineComponent } from '../../features/audit/audit-line.component';
import { TripFlowService } from '../../features/trips/trip-flow.service';

import { BackDirective } from '../../shared/back.directive';
import { LinkChipsComponent } from '../../shared/link-chips.component';
@Component({
  selector: 'app-ideas',
  imports: [BackDirective, IonContent, IonIcon, TranslocoPipe, AuditLineComponent, LinkChipsComponent],
  templateUrl: './ideas.page.html',
  styleUrl: './ideas.page.scss',
})
export class IdeasPage {
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly flow = inject(TripFlowService);
  protected readonly ideas = inject(IdeasService);

  /** O texto de uma ideia com as ligações trocadas pelo nome do site (os botões "Abrir" ficam por baixo). */
  protected readonly short = shortenLinks;
  protected readonly statuses = IDEA_STATUSES;
  protected readonly filters: readonly IdeaFilter[] = ['all', ...IDEA_STATUSES];
  protected readonly filter = signal<IdeaFilter>('all');
  protected readonly shown = computed(() => filterIdeas(this.ideas.sorted(), this.filter()));
  protected readonly total = computed(() => this.ideas.items().length);

  constructor() {
    addIcons({ add, bulbOutline, chevronBackOutline, createOutline, trashOutline });
  }

  protected count(filter: IdeaFilter): number {
    return filter === 'all' ? this.total() : this.ideas.counts()[filter];
  }

  protected add(): void {
    void this.flow.openIdea(null);
  }

  protected edit(idea: Idea): void {
    void this.flow.openIdea(idea);
  }

  protected async setStatus(idea: Idea, status: IdeaStatus): Promise<void> {
    if (idea.status === status) return;
    try {
      await this.ideas.setStatus(idea.id, status);
    } catch {
      await this.toast('ideas.errors.save');
    }
  }

  protected async confirmRemove(idea: Idea): Promise<void> {
    const t = (key: string) => this.transloco.translate(key);
    const alert = await this.alerts.create({
      header: t('ideas.removeTitle'),
      message: t('ideas.removeText'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('ideas.remove'), role: 'destructive', handler: () => void this.remove(idea) },
      ],
    });
    await alert.present();
  }

  private async remove(idea: Idea): Promise<void> {
    try {
      await this.ideas.remove(idea.id);
      await this.toast('ideas.removed');
    } catch {
      await this.toast('ideas.errors.remove');
    }
  }

  private async toast(key: string): Promise<void> {
    const toast = await this.toasts.create({ message: this.transloco.translate(key), duration: 2200, position: 'top' });
    await toast.present();
  }
}
