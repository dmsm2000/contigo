import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { star, starOutline } from 'ionicons/icons';

/** De 1 a 3 estrelas: quanto se quer ir a um sítio. Só se mexe quando `editable`. */
@Component({
  selector: 'app-stars',
  imports: [IonIcon, TranslocoPipe],
  template: `
    @if (editable()) {
      <div class="stars" role="group">
        @for (n of levels; track n) {
          <button
            class="star"
            type="button"
            [class.on]="n <= value()"
            [attr.aria-pressed]="n === value()"
            [attr.aria-label]="'wish.stars.' + n | transloco"
            (click)="picked.emit(n)"
          >
            <ion-icon [name]="n <= value() ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
          </button>
        }
      </div>
    } @else {
      <span class="stars" role="img" [attr.aria-label]="value() ? ('wish.stars.' + value() | transloco) : null">
        @for (n of levels; track n) {
          <span class="star static" [class.on]="n <= value()">
            <ion-icon [name]="n <= value() ? 'star' : 'star-outline'" aria-hidden="true"></ion-icon>
          </span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .stars {
      display: inline-flex;
      gap: 2px;
    }

    .star {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--ct-ring);
      font-size: 22px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        color var(--ct-dur-fast),
        transform var(--ct-dur-fast) var(--ct-ease);

      // Com o dedo, o alvo tem de ter pelo menos 44 px.
      width: 44px;
      height: 44px;

      &.static {
        width: auto;
        height: auto;
        font-size: 15px;
        cursor: default;
      }

      &.on {
        color: #f4a62a;
      }

      &:active:not(.static) {
        transform: scale(0.85);
      }

      &:focus-visible {
        outline: 2px solid var(--ct-ac);
        border-radius: 12px;
      }

      &.on:not(.static) ion-icon {
        animation: ct-pop var(--ct-dur) var(--ct-ease-spring) both;
      }
    }
  `,
})
export class StarsComponent {
  readonly value = input(0);
  readonly editable = input(false);
  readonly picked = output<1 | 2 | 3>();

  protected readonly levels = [1, 2, 3] as const;

  constructor() {
    addIcons({ star, starOutline });
  }
}
