import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { chevronBackOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { MAX_EXPENSE, parseAmount } from '../../core/expenses.logic';
import { ExpensesService } from '../../core/expenses.service';
import { Language, LANGUAGES, LanguageService } from '../../core/language.service';
import { cleanName, MAX_NAME_LENGTH } from '../../core/profile.logic';
import { HomeKey, ProfileService } from '../../core/profile.service';
import { PlaceImageBackfillService } from '../../core/place-image-backfill.service';
import { SettingsService, STORY_SECONDS, StorySeconds } from '../../core/settings.service';
import { ThemePreference, ThemeService } from '../../core/theme.service';
import { LastUpdateComponent } from '../../features/audit/last-update.component';

export const MIN_PASSWORD_LENGTH = 8;

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** As definições da app: o que se escolhe uma vez e raramente se volta a mexer. */
import { BackDirective } from '../../shared/back.directive';
@Component({
  selector: 'app-settings',
  imports: [BackDirective, LastUpdateComponent, IonContent, IonIcon, FormsModule, TranslocoPipe],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly expenses = inject(ExpensesService);
  protected readonly profile = inject(ProfileService);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly settings = inject(SettingsService);
  protected readonly backfill = inject(PlaceImageBackfillService);

  protected readonly languages = LANGUAGES;
  protected readonly themes: readonly ThemePreference[] = ['system', 'light', 'dark'];
  protected readonly homes: readonly HomeKey[] = ['porto', 'madrid'];
  protected readonly storyOptions = STORY_SECONDS;
  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly maxNameLength = MAX_NAME_LENGTH;

  protected readonly nameBusy = signal(false);
  protected readonly nameStatus = signal<Status>({ kind: 'idle' });
  protected name = '';
  private nameTouched = false;

  protected readonly allowanceBusy = signal(false);
  protected readonly allowanceStatus = signal<Status>({ kind: 'idle' });
  protected allowance = '';
  private allowanceTouched = false;
  /** A dotação da outra pessoa, só para ler. */
  protected readonly partnerAllowance = computed(() => Number(this.profile.partner()?.monthly_allowance ?? 0));

  protected readonly signOutBusy = signal(false);
  /** A última tentativa de sair falhou por falta de rede. */
  protected readonly signOutOffline = signal(false);

  protected readonly passwordBusy = signal(false);
  protected readonly passwordStatus = signal<Status>({ kind: 'idle' });
  protected newPassword = '';
  protected confirmPassword = '';

  constructor() {
    addIcons({ chevronBackOutline, logOutOutline });
    void this.backfill.count();

    // Mostra o que já está guardado, enquanto a pessoa não começar a escrever.
    effect(() => {
      const me = this.profile.profile();
      untracked(() => {
        if (!this.nameTouched) this.name = me?.name ?? '';
        if (!this.allowanceTouched && me) this.allowance = String(Number(me.monthly_allowance)).replace('.', ',');
      });
    });
  }

  protected money(amount: number): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);
  }

  protected findImages(redo = false): void {
    void this.backfill.run(redo);
  }

  protected setLanguage(language: Language): void {
    void this.profile.setLanguage(language);
  }

  protected setTheme(theme: ThemePreference): void {
    void this.profile.setTheme(theme);
  }

  protected setHome(home: HomeKey): void {
    void this.profile.setHome(this.profile.profile()?.home === home ? null : home);
  }

  protected setStorySeconds(value: StorySeconds): void {
    this.settings.setStorySeconds(value);
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

  protected onAllowance(): void {
    this.allowanceTouched = true;
    this.allowanceStatus.set({ kind: 'idle' });
  }

  protected async saveAllowance(): Promise<void> {
    // O zero é válido (pausa as dotações), por isso não passa só pelo parseAmount, que exige mais do que zero.
    const text = this.allowance.trim();
    const value = text === '0' ? 0 : parseAmount(text);
    if (value === 'invalid' || value > MAX_EXPENSE) return this.allowanceStatus.set({ kind: 'error', message: 'settings.allowanceError' });
    this.allowanceBusy.set(true);
    const ok = await this.profile.setAllowance(value);
    this.allowanceBusy.set(false);
    if (ok) {
      this.allowanceTouched = false;
      this.allowanceStatus.set({ kind: 'saved' });
    } else {
      this.allowanceStatus.set({ kind: 'error', message: 'settings.allowanceError' });
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
      const message = (error as { code?: string } | null)?.code === 'same_password' ? 'us.passwordErrors.same' : 'us.passwordErrors.generic';
      this.passwordStatus.set({ kind: 'error', message });
    } finally {
      this.passwordBusy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signOutBusy()) return;
    this.signOutBusy.set(true);
    this.signOutOffline.set(false);
    try {
      // Antes de sair, envia-se o que ficou guardado sem rede (despesas); o que não seguir fica à espera da próxima entrada.
      await this.expenses.flush();
      // Sem rede não se sai (ver AuthService.signOut): fica na app e diz porquê.
      if (await this.auth.signOut()) await this.router.navigateByUrl('/login', { replaceUrl: true });
      else this.signOutOffline.set(true);
    } finally {
      this.signOutBusy.set(false);
    }
  }
}
