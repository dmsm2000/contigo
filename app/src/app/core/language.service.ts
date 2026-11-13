import { effect, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { readStored, writeStored } from './storage';

export type Language = 'pt' | 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['pt', 'es', 'en'];

const STORAGE_KEY = 'contigo.language';
const HTML_LANG: Record<Language, string> = { pt: 'pt-PT', es: 'es-ES', en: 'en' };

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly language = signal<Language>(readStored(STORAGE_KEY, LANGUAGES, 'pt'));

  constructor() {
    effect(() => {
      const language = this.language();
      this.transloco.setActiveLang(language);
      document.documentElement.lang = HTML_LANG[language];
    });
  }

  set(language: Language): void {
    this.language.set(language);
    writeStored(STORAGE_KEY, language);
  }
}
