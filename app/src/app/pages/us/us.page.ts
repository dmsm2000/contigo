import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { bulbOutline, cameraOutline, chevronForwardOutline, heartOutline, settingsOutline, walletOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
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

  protected readonly avatarBusy = signal(false);
  protected readonly avatarFailed = signal(false);

  constructor() {
    addIcons({ bulbOutline, cameraOutline, chevronForwardOutline, heartOutline, settingsOutline, walletOutline });
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
