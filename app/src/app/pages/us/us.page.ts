import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { bulbOutline, chevronForwardOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { IdeasService } from '../../core/ideas.service';
import { Language, LANGUAGES, LanguageService } from '../../core/language.service';
import { cleanName, MAX_NAME_LENGTH } from '../../core/profile.logic';
import { ProfileService } from '../../core/profile.service';
import { ThemePreference, ThemeService } from '../../core/theme.service';

export const MIN_PASSWORD_LENGTH = 8;

type NameStatus = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

type PasswordStatus = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

@Component({
  selector: 'app-us',
  imports: [IonContent, IonIcon, FormsModule, RouterLink, TranslocoPipe],
  templateUrl: './us.page.html',
  styleUrl: './us.page.scss',
})
export class UsPage {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly profile = inject(ProfileService);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly ideas = inject(IdeasService);

  protected readonly languages = LANGUAGES;
  protected readonly themes: readonly ThemePreference[] = ['system', 'light', 'dark'];
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly initial = computed(() =>
    (this.profile.profile()?.name || this.auth.email() || '?').charAt(0).toUpperCase(),
  );

  protected readonly maxNameLength = MAX_NAME_LENGTH;
  protected readonly nameBusy = signal(false);
  protected readonly nameStatus = signal<NameStatus>({ kind: 'idle' });
  protected name = '';
  private nameTouched = false;

  protected readonly passwordBusy = signal(false);
  protected readonly passwordStatus = signal<PasswordStatus>({ kind: 'idle' });
  protected newPassword = '';
  protected confirmPassword = '';

  constructor() {
    addIcons({ bulbOutline, chevronForwardOutline, logOutOutline });

    // Mostra o nome que já está guardado, enquanto a pessoa não começar a escrever.
    effect(() => {
      const saved = this.profile.profile()?.name ?? '';
      untracked(() => {
        if (!this.nameTouched) this.name = saved;
      });
    });
  }

  protected setLanguage(language: Language): void {
    void this.profile.setLanguage(language);
  }

  protected setTheme(theme: ThemePreference): void {
    void this.profile.setTheme(theme);
  }

  protected onName(): void {
    this.nameTouched = true;
    this.nameStatus.set({ kind: 'idle' });
  }

  protected async saveName(): Promise<void> {
    const name = cleanName(this.name);
    if (name === 'empty') return this.nameStatus.set({ kind: 'error', message: 'us.nameErrors.empty' });
    if (name === 'tooLong') return this.nameStatus.set({ kind: 'error', message: 'us.nameErrors.tooLong' });
    this.nameBusy.set(true);
    const ok = await this.profile.setName(name);
    this.nameBusy.set(false);
    if (ok) {
      this.name = name;
      this.nameTouched = false;
      this.nameStatus.set({ kind: 'saved' });
    } else {
      this.nameStatus.set({ kind: 'error', message: 'us.nameErrors.generic' });
    }
  }

  protected clearPasswordStatus(): void {
    this.passwordStatus.set({ kind: 'idle' });
  }

  protected async savePassword(): Promise<void> {
    if (this.newPassword.length < MIN_PASSWORD_LENGTH) {
      this.passwordStatus.set({ kind: 'error', message: 'us.passwordErrors.tooShort' });
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordStatus.set({ kind: 'error', message: 'us.passwordErrors.mismatch' });
      return;
    }
    this.passwordBusy.set(true);
    try {
      await this.auth.changePassword(this.newPassword);
      this.newPassword = '';
      this.confirmPassword = '';
      this.passwordStatus.set({ kind: 'saved' });
    } catch (error) {
      const message = (error as { code?: string } | null)?.code === 'same_password'
        ? 'us.passwordErrors.same'
        : 'us.passwordErrors.generic';
      this.passwordStatus.set({ kind: 'error', message });
    } finally {
      this.passwordBusy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
