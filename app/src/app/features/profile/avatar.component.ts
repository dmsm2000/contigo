import { ChangeDetectionStrategy, Component, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { ProfileService } from '../../core/profile.service';

/** A foto de perfil de uma pessoa num círculo; sem foto, a inicial do nome sobre o gradiente da marca. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [style.--size.px]="size()" [style.font-size.px]="size() * 0.42" aria-hidden="true">
      @if (url(); as src) {
        <img [class.on]="loaded()" [src]="src" alt="" draggable="false" (load)="loaded.set(true)" (error)="loaded.set(false)" />
      }
      @if (!loaded()) {
        <span class="initial">{{ initial() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    .avatar {
      position: relative;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      overflow: hidden;
      background: var(--ct-grad);
      color: #ffffff;
      font-family: var(--ct-font-display);
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    img.on {
      opacity: 1;
    }
  `,
})
export class AvatarComponent {
  private readonly profile = inject(ProfileService);

  /** A pessoa; sem valor, é quem está a usar a app. */
  readonly userId = input<string | null>(null);
  readonly size = input(40);

  protected readonly loaded = signal(false);
  private readonly person = computed(() => {
    const id = this.userId();
    return id ? (this.profile.people().find((person) => person.id === id) ?? null) : this.profile.profile();
  });
  protected readonly url = computed(() => this.profile.avatarUrl(this.person()?.id ?? null));
  protected readonly initial = computed(() => (this.person()?.name || '?').charAt(0).toUpperCase());

  constructor() {
    // Outra foto volta ao início: mostra a inicial até a nova chegar.
    effect(() => {
      this.url();
      untracked(() => this.loaded.set(false));
    });
  }
}
