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
    @if (compact()) {
      @let last = a.updated ?? a.created;
      <p class="line">
        @if (last.by) {
          <app-avatar [userId]="last.by" [size]="16" />
        }
        <span>{{ name(last.by, false) }} · {{ when(last.at) }}{{ a.updated ? ' · ' + ('audit.edited' | transloco) : '' }}</span>
      </p>
    } @else {
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
  /** Uma só linha, curta: "Diogo · há 6 horas" (com "editada" se alguém mexeu depois). */
  readonly compact = input(false);

  protected readonly audit = computed(() => describeAudit(this.data()));
  protected readonly createdKey = computed(() => (this.kind() === 'written' ? 'audit.written' : 'audit.added'));

  /** O nome depois de "por": "por ti" para quem está a usar a app; sozinho (versão curta) é "Tu". */
  protected name(userId: string | null, afterBy = true): string {
    if (!userId) return this.transloco.translate('audit.someone');
    if (userId === this.auth.userId()) return this.transloco.translate(afterBy ? 'audit.you' : 'wish.you');
    return this.profile.nameOf(userId) || this.transloco.translate('wish.theOther');
  }

  protected when(iso: string): string {
    return relativeTime(iso, this.language());
  }
}
