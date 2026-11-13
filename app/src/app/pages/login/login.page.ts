import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { Language, LANGUAGES, LanguageService } from '../../core/language.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  imports: [IonContent, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly language = inject(LanguageService);

  protected readonly languages = LANGUAGES;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected email = '';
  protected password = '';

  constructor() {
    addIcons({ eyeOffOutline, eyeOutline });
  }

  protected setLanguage(language: Language): void {
    this.language.set(language);
  }

  protected clearError(): void {
    this.error.set(null);
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected async signIn(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      this.error.set('login.errors.invalidEmail');
      return;
    }
    if (!this.password) {
      this.error.set('login.errors.passwordRequired');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn(email, this.password);
      this.password = '';
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } catch (error) {
      this.error.set(isWrongCredentials(error) ? 'login.errors.wrongCredentials' : 'login.errors.generic');
    } finally {
      this.busy.set(false);
    }
  }
}

function isWrongCredentials(error: unknown): boolean {
  const details = error as { code?: string; message?: string; status?: number } | null;
  return (
    details?.code === 'invalid_credentials' ||
    /invalid login credentials/i.test(details?.message ?? '') ||
    details?.status === 400
  );
}
