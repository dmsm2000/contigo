import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Language, LanguageService } from './language.service';
import { SupabaseService } from './supabase.service';
import { ThemePreference, ThemeService } from './theme.service';

export interface Profile {
  id: string;
  name: string;
  language: Language;
  theme: ThemePreference;
}

const COLUMNS = 'id, name, language, theme';

/** O perfil de quem está a usar a app. A língua e o tema seguem a pessoa entre dispositivos. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  readonly profile = signal<Profile | null>(null);
  /** Os dois perfis, para mostrar quem fez o quê. */
  readonly people = signal<Profile[]>([]);
  /** A outra pessoa, se já existe (no início só há uma conta). */
  readonly partner = computed(() => this.people().find((person) => person.id !== this.auth.userId()) ?? null);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) {
        void this.load(userId);
      } else {
        this.profile.set(null);
        this.people.set([]);
      }
    });
  }

  /** O nome de uma pessoa, ou um texto vazio se ainda não tem nome. */
  nameOf(userId: string | null): string {
    return this.people().find((person) => person.id === userId)?.name ?? '';
  }

  setLanguage(language: Language): Promise<void> {
    this.language.set(language);
    return this.save({ language });
  }

  /** Muda o meu nome. Devolve false se a base de dados recusou. */
  async setName(name: string): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ name })
      .eq('id', userId)
      .select(COLUMNS)
      .single<Profile>();
    if (error || !data) return false;
    this.profile.set(data);
    this.people.update((people) => people.map((person) => (person.id === data.id ? data : person)));
    return true;
  }

  setTheme(theme: ThemePreference): Promise<void> {
    this.theme.set(theme);
    return this.save({ theme });
  }

  private async load(userId: string): Promise<void> {
    const { data } = await this.supabase.from('profiles').select(COLUMNS).returns<Profile[]>();
    if (!data) return;
    this.people.set(data);
    const mine = data.find((person) => person.id === userId);
    if (!mine) return;
    this.profile.set(mine);
    this.language.set(mine.language);
    this.theme.set(mine.theme);
  }

  private async save(changes: Partial<Pick<Profile, 'name' | 'language' | 'theme'>>): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const { data } = await this.supabase
      .from('profiles')
      .update(changes)
      .eq('id', userId)
      .select(COLUMNS)
      .single<Profile>();
    if (data) {
      this.profile.set(data);
      this.people.update((people) => people.map((person) => (person.id === data.id ? data : person)));
    }
  }
}
