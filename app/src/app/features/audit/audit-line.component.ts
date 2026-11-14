import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth.service';
import { AuditInput, describeAudit, relativeTime } from '../../core/audit.logic';
import { LanguageService } from '../../core/language.service';
import { ProfileService } from '../../core/profile.service';
import { AvatarComponent } from '../profile/avatar.component';

/** "Registado por Lucía · há 3 dias" e, se alguém mexeu depois, "Atualizado por Tu · ontem". */
@Component({
  selector: 'app-audit-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, AvatarComponent],
  template: `
    @let a = audit();
    <p class="line">
      @if (a.created.by) {
        <app-avatar [userId]="a.created.by" [size]="16" />
      }
      <span>{{ createdKey() | transloco: { name: name(a.created.by), when: when(a.created.at) } }}</span>
    </p>
    @if (a.updated; as u) {
      <p class="line">
        @if (u.by) {
          <app-avatar [userId]="u.by" [size]="16" />
        }
        <span>{{ 'audit.updated' | transloco: { name: name(u.by), when: when(u.at) } }}</span>
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
      color: var(--ct-mu);
      font-size: 12px;
      line-height: 1.4;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 2px 0;
    }
  `,
})
export class AuditLineComponent {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;

  readonly data = input.required<AuditInput>();
  /** 'added' para o que se regista ("Registado por"), 'written' para o que se escreve ("Escrita por"). */
  readonly kind = input<'added' | 'written'>('added');

  protected readonly audit = computed(() => describeAudit(this.data()));
  protected readonly createdKey = computed(() => (this.kind() === 'written' ? 'audit.written' : 'audit.added'));

  protected name(userId: string | null): string {
    if (!userId) return this.transloco.translate('audit.someone');
    if (userId === this.auth.userId()) return this.transloco.translate('wish.you');
    return this.profile.nameOf(userId) || this.transloco.translate('wish.theOther');
  }

  protected when(iso: string): string {
    return relativeTime(iso, this.language());
  }
}
