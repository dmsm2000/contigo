import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth.service';
import { latestChange, relativeTime } from '../../core/audit.logic';
import { ExpensesService } from '../../core/expenses.service';
import { IdeasService } from '../../core/ideas.service';
import { LanguageService } from '../../core/language.service';
import { PhotosService } from '../../core/photos.service';
import { ProfileService } from '../../core/profile.service';
import { TripsService } from '../../core/trips.service';

/** "Informação atualizada pela última vez em 14 de novembro, 19:03, por Lucía": a alteração mais recente de tudo o que a app guarda. */
@Component({
  selector: 'app-last-update',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    @if (change(); as c) {
      <p class="last">{{ 'audit.last' | transloco: { when: when(c.at), name: name(c.by), ago: ago(c.at) } }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .last {
      margin: 24px 0 8px;
      text-align: center;
      font-size: 12px;
      line-height: 1.5;
      color: var(--ct-mu);
    }
  `,
})
export class LastUpdateComponent {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly trips = inject(TripsService);
  private readonly expenses = inject(ExpensesService);
  private readonly ideas = inject(IdeasService);
  private readonly photos = inject(PhotosService);

  protected readonly change = computed(() =>
    latestChange([
      ...this.trips.trips().map((trip) => ({ by: trip.updatedBy ?? trip.createdBy, at: trip.updatedAt ?? trip.createdAt })),
      ...this.expenses.items().map((item) => ({ by: item.updatedBy ?? item.userId, at: item.updatedAt })),
      ...this.ideas.items().map((idea) => ({ by: idea.updatedBy ?? idea.userId, at: idea.updatedAt })),
      ...this.photos.photos().map((photo) => ({ by: photo.userId, at: photo.createdAt })),
    ]),
  );

  protected when(iso: string): string {
    const locale = { pt: 'pt-PT', es: 'es-ES', en: 'en-GB' }[this.language()];
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  protected ago(iso: string): string {
    return relativeTime(iso, this.language());
  }

  protected name(userId: string | null): string {
    if (!userId) return this.transloco.translate('audit.someone');
    if (userId === this.auth.userId()) return this.transloco.translate('audit.you');
    return this.profile.nameOf(userId) || this.transloco.translate('wish.theOther');
  }
}
