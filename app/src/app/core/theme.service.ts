import { computed, effect, Injectable, signal } from '@angular/core';
import { readStored, writeStored } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'contigo.theme';
const THEMES = ['system', 'light', 'dark'] as const;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);

  readonly preference = signal<ThemePreference>(readStored(STORAGE_KEY, THEMES, 'system'));
  readonly isDark = computed(
    () => this.preference() === 'dark' || (this.preference() === 'system' && this.systemDark()),
  );

  private started = false;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.media.addEventListener('change', (event) => this.systemDark.set(event.matches));

    effect(() => {
      const dark = this.isDark();
      const root = document.documentElement;
      // Só há transição suave nas trocas; ao arrancar a cor aplica-se logo, sem piscar.
      if (this.started) this.fadeColors(root);
      this.started = true;
      root.classList.toggle('ion-palette-dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0E0C11' : '#FFFFFF');
    });
  }

  private fadeColors(root: HTMLElement): void {
    root.classList.add('ct-theme-fade');
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => root.classList.remove('ct-theme-fade'), 450);
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    writeStored(STORAGE_KEY, preference);
  }
}
