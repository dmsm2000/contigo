import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { bulbOutline, cameraOutline, chevronForwardOutline, heartOutline, settingsOutline, walletOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { relativeTime } from '../../core/audit.logic';
import { todayIso } from '../../core/availability.logic';
import { togetherStats } from '../../core/meetings.logic';
import { MeetingsService } from '../../core/meetings.service';
import { TripsService } from '../../core/trips.service';
import { LanguageService } from '../../core/language.service';
import { IdeasService } from '../../core/ideas.service';
import { ProfileService } from '../../core/profile.service';
import { LastUpdateComponent } from '../../features/audit/last-update.component';
import { AvatarComponent } from '../../features/profile/avatar.component';

/** Nós: os dois, e a porta para o que é dos dois. O que se configura está em /settings. */
@Component({
  selector: 'app-us',
  imports: [LastUpdateComponent, IonContent, IonIcon, RouterLink, TranslocoPipe, AvatarComponent],
  templateUrl: './us.page.html',
  styleUrl: './us.page.scss',
})
export class UsPage {
  protected readonly auth = inject(AuthService);
  protected readonly profile = inject(ProfileService);
  protected readonly ideas = inject(IdeasService);
  private readonly language = inject(LanguageService).language;
  private readonly meetings = inject(MeetingsService);
  private readonly trips = inject(TripsService);

  protected readonly year = new Date().getFullYear();
  /** Os dias juntos este ano e há quanto tempo foi o último encontro. */
  protected readonly together = computed(() => togetherStats(this.meetings.items(), this.trips.trips(), todayIso()));

  /** Quando o outro entrou pela última vez: "há 2 horas", ou "agora" se foi há menos de 2 minutos. */
  protected readonly partnerSeen = computed(() => {
    const at = this.profile.partner()?.last_seen_at;
    if (!at) return null;
    const online = Date.now() - new Date(at).getTime() < 2 * 60 * 1000;
    return { online, ago: relativeTime(at, this.language()), exact: new Date(at).toLocaleString(this.language()) };
  });

  protected readonly avatarBusy = signal(false);
  protected readonly avatarFailed = signal(false);

  constructor() {
    addIcons({ bulbOutline, cameraOutline, chevronForwardOutline, heartOutline, settingsOutline, walletOutline });
    // A hora a que o outro entrou muda enquanto estás aqui: lê-se ao abrir Nós, e volta a ler-se de minuto a minuto.
    void this.profile.refreshPeople();
    const timer = setInterval(() => void this.profile.refreshPeople(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** A foto escolhida (da galeria ou da câmara) passa a ser a minha foto de perfil. */
  protected async pickAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarBusy.set(true);
    this.avatarFailed.set(!(await this.profile.setAvatar(file)));
    this.avatarBusy.set(false);
  }

  protected async removeAvatar(): Promise<void> {
    this.avatarBusy.set(true);
    this.avatarFailed.set(!(await this.profile.removeAvatar()));
    this.avatarBusy.set(false);
  }
}
