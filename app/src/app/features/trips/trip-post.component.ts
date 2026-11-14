import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { heart, heartOutline, imagesOutline } from 'ionicons/icons';
import { PhotosService } from '../../core/photos.service';
import { ProfileService } from '../../core/profile.service';
import { AuthService } from '../../core/auth.service';
import { Trip } from '../../core/trips.logic';
import { AvatarComponent } from '../profile/avatar.component';
import { PhotoImgComponent } from '../photos/photo-img.component';
import { TripLabels } from './trip-labels.service';

/**
 * Uma viagem como um post de feed: quem registou e onde, as fotos num carrossel que se desliza,
 * o coração de "voltávamos" e a nota como legenda. Tocar na foto ou na legenda abre a viagem.
 */
@Component({
  selector: 'app-trip-post',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, TranslocoPipe, AvatarComponent, PhotoImgComponent],
  templateUrl: './trip-post.component.html',
  styleUrl: './trip-post.component.scss',
})
export class TripPostComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  protected readonly photosService = inject(PhotosService);
  protected readonly labels = inject(TripLabels);
  private observer: IntersectionObserver | null = null;

  readonly trip = input.required<Trip>();
  readonly open = output<void>();

  protected readonly page = signal(0);
  protected readonly photos = computed(() => this.photosService.photosOf(this.trip().id));
  protected readonly dots = computed(() => (this.photos().length > 1 ? this.photos().map((_, i) => i) : []));

  /** Quem registou a viagem ("Tu" para quem está a usar a app). */
  protected readonly author = computed(() => {
    const by = this.trip().createdBy;
    if (!by) return this.transloco.translate('audit.someone');
    if (by === this.auth.userId()) return this.transloco.translate('wish.you');
    return this.profile.nameOf(by) || this.transloco.translate('wish.theOther');
  });

  constructor() {
    addIcons({ heart, heartOutline, imagesOutline });
  }

  ngAfterViewInit(): void {
    // As fotos grandes só se pedem quando o post está quase à vista: o feed longo não gasta dados à toa.
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.observer?.disconnect();
        void this.photosService.warm(this.photos());
      },
      { rootMargin: '600px 0px' },
    );
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.page.set(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }
}
