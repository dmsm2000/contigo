import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Photo } from '../../core/photos.logic';
import { PhotosService } from '../../core/photos.service';

/**
 * Uma foto da viagem sem "saltos": enquanto não há nada, um brilho a correr; quando chega a miniatura, aparece
 * desfocada; quando chega a foto grande, ela surge por cima com um fade. Emite `settled` quando a foto grande
 * acaba de carregar (ou falha), para quem quiser esperar por ela (as histórias).
 */
@Component({
  selector: 'app-photo-img',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="wrap" [class.is-ready]="ready()">
      @if (thumb(); as url) {
        <img class="layer blur" [src]="url" alt="" aria-hidden="true" draggable="false" />
      }
      @if (full(); as url) {
        <img
          class="layer main"
          [class.on]="ready()"
          [src]="url"
          [alt]="alt()"
          [style.object-fit]="fit()"
          draggable="false"
          (load)="settle()"
          (error)="settle()"
        />
      }
    </span>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .wrap {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, var(--ct-sf, #222) 25%, var(--ct-ln, #333) 50%, var(--ct-sf, #222) 75%);
      background-size: 200% 100%;
      animation: ct-shimmer 1.4s linear infinite;
    }
    .wrap.is-ready {
      animation: none;
      background: transparent;
    }
    .layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      user-select: none;
      pointer-events: none;
    }
    .blur {
      filter: blur(14px);
      transform: scale(1.08);
    }
    .main {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .main.on {
      opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .wrap {
        animation: none;
      }
      .main {
        transition: none;
      }
    }
  `,
})
export class PhotoImgComponent {
  private readonly photos = inject(PhotosService);

  readonly photo = input.required<Photo>();
  /** `cover` enche o espaço (grelhas); `contain` mostra a foto inteira (histórias e visualizador). */
  readonly fit = input<'cover' | 'contain'>('cover');
  /** Com `full` desligado só se usa a miniatura (grelhas): poupa dados. */
  readonly useFull = input(true);
  readonly alt = input('');
  readonly settled = output<void>();

  protected readonly thumb = computed(() => this.photos.thumbUrl(this.photo()));
  protected readonly full = computed(() => (this.useFull() ? this.photos.fullUrl(this.photo()) : this.thumb()));
  private readonly loadedUrl = signal<string | null>(null);
  protected readonly ready = computed(() => this.loadedUrl() !== null && this.loadedUrl() === this.full());

  constructor() {
    // Uma foto nova (ou outro link) volta ao início: a anterior não conta como carregada.
    effect(() => {
      this.full();
      untracked(() => this.loadedUrl.set(null));
    });
  }

  protected settle(): void {
    this.loadedUrl.set(this.full());
    this.settled.emit();
  }
}
