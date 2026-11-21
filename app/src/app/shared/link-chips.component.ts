import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { openOutline } from 'ionicons/icons';
import { extractLinks, linkHost } from '../core/links.logic';

/**
 * Um botão "Abrir booking.com" para cada ligação que há num texto (e para a ligação própria de um registo, se tiver).
 * Põe-se ao lado do texto, nunca dentro de um botão (um botão dentro de outro não funciona bem).
 */
@Component({
  selector: 'app-link-chips',
  imports: [IonIcon, TranslocoPipe],
  template: `
    @for (item of links(); track item.url) {
      <a
        class="chip"
        [href]="item.url"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-label]="('links.open' | transloco) + ' ' + item.host"
        (click)="$event.stopPropagation()"
      >
        <ion-icon name="open-outline" aria-hidden="true"></ion-icon>
        <span class="chip-text"
          >{{ 'links.open' | transloco }} <b>{{ item.host }}</b></span
        >
      </a>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    :host(:empty) {
      display: none;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 20px;
      background: var(--ct-acs);
      color: var(--ct-act);
      font: 600 14px var(--ion-font-family);
      text-decoration: none;
      -webkit-tap-highlight-color: transparent;

      &:focus-visible {
        outline: 2px solid var(--ct-ac);
        outline-offset: 2px;
      }

      ion-icon {
        flex: none;
        font-size: 18px;
      }
    }

    .chip-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class LinkChipsComponent {
  /** O texto onde procurar ligações. */
  readonly text = input<string | null | undefined>(null);
  /** Uma ligação já conhecida (por exemplo, a do alojamento): aparece primeiro. */
  readonly link = input<string | null | undefined>(null);

  protected readonly links = computed(() => {
    const urls = [this.link(), ...extractLinks(this.text())].filter((url): url is string => !!url);
    return [...new Set(urls)].map((url) => ({ url, host: linkHost(url) }));
  });

  constructor() {
    addIcons({ openOutline });
  }
}
