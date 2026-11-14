import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { AllowanceChange, monthlyIncome } from './expenses.logic';
import { compressAvatar } from './image-compress';
import { Language, LanguageService } from './language.service';
import { SupabaseService } from './supabase.service';
import { ThemePreference, ThemeService } from './theme.service';

/** As duas pontas da raia. */
export type HomeKey = 'porto' | 'madrid';

export interface Profile {
  id: string;
  name: string;
  language: Language;
  theme: ThemePreference;
  /** Quanto cada um põe por mês, em euros. */
  monthly_allowance: number;
  /** Onde está a foto de perfil no bucket `avatars`, se a pessoa pôs uma. */
  avatar_path: string | null;
  /** Onde mora, se já escolheu. */
  home: HomeKey | null;
}

const BUCKET = 'avatars';
const URL_TTL_SECONDS = 12 * 60 * 60;

const COLUMNS = 'id, name, language, theme, monthly_allowance, avatar_path, home';

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
  /** Os links temporários das fotos de perfil, pelo id da pessoa. */
  private readonly avatarUrls = signal<ReadonlyMap<string, { path: string; url: string }>>(new Map());
  /** A outra pessoa, se já existe (no início só há uma conta). */
  /** O que entra por mês: a dotação dos dois (ou só a minha enquanto a outra pessoa não tem conta). */
  readonly monthlyTotal = computed(() => this.people().reduce((sum, person) => sum + Number(person.monthly_allowance), 0));

  /** Quando cada um mudou a sua dotação (a de antes da primeira mudança vem como "2000-01"). */
  readonly allowanceHistory = signal<AllowanceChange[]>([]);

  /** O que os dois punham num mês ("2026-11"): conta com as mudanças de dotação; sem histórico, a dotação de hoje. */
  incomeFor = (month: string): number =>
    monthlyIncome(this.allowanceHistory(), this.people().map((person) => person.id), month, this.monthlyTotal());
  readonly partner = computed(() => this.people().find((person) => person.id !== this.auth.userId()) ?? null);

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      if (userId) {
        void this.load(userId);
      } else {
        this.profile.set(null);
        this.people.set([]);
        this.allowanceHistory.set([]);
        this.avatarUrls.set(new Map());
      }
    });
  }

  /** O nome de uma pessoa, ou um texto vazio se ainda não tem nome. */
  nameOf(userId: string | null): string {
    return this.people().find((person) => person.id === userId)?.name ?? '';
  }

  /** O link da foto de perfil de uma pessoa, ou null se não tem (ou ainda está a chegar). */
  avatarUrl(userId: string | null): string | null {
    const entry = userId ? this.avatarUrls().get(userId) : undefined;
    const path = this.people().find((person) => person.id === userId)?.avatar_path;
    return entry && entry.path === path ? entry.url : null;
  }

  /** Muda a minha foto de perfil: recorta, comprime, envia e apaga a anterior. Devolve false se algo falhou. */
  async setAvatar(file: File): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    let blob: Blob;
    try {
      blob = await compressAvatar(file);
    } catch {
      return false;
    }
    const previous = this.profile()?.avatar_path ?? null;
    // Um nome novo de cada vez: assim o link antigo nunca mostra a foto errada em cache.
    const path = `${userId}/${Date.now()}.jpg`;
    const storage = this.supabase.storage.from(BUCKET);
    const upload = await storage.upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upload.error) return false;
    if (!(await this.saveAvatarPath(path))) {
      await storage.remove([path]);
      return false;
    }
    if (previous) await storage.remove([previous]);
    return true;
  }

  async removeAvatar(): Promise<boolean> {
    const previous = this.profile()?.avatar_path ?? null;
    if (!previous) return true;
    if (!(await this.saveAvatarPath(null))) return false;
    await this.supabase.storage.from(BUCKET).remove([previous]);
    return true;
  }

  private async saveAvatarPath(path: string | null): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', userId)
      .select(COLUMNS)
      .single<Profile>();
    if (error || !data) return false;
    this.profile.set(data);
    this.people.update((people) => people.map((person) => (person.id === data.id ? data : person)));
    await this.signAvatars();
    return true;
  }

  /** Pede links para as fotos de perfil que ainda não têm um (ou que mudaram). */
  private async signAvatars(): Promise<void> {
    const current = this.avatarUrls();
    const wanted = this.people().filter(
      (person): person is Profile & { avatar_path: string } => !!person.avatar_path && current.get(person.id)?.path !== person.avatar_path,
    );
    const next = new Map(current);
    for (const person of this.people()) {
      if (!person.avatar_path) next.delete(person.id);
    }
    if (wanted.length) {
      const { data } = await this.supabase.storage.from(BUCKET).createSignedUrls(
        wanted.map((person) => person.avatar_path),
        URL_TTL_SECONDS,
      );
      for (const item of data ?? []) {
        const owner = wanted.find((person) => person.avatar_path === item.path);
        if (owner && item.signedUrl) next.set(owner.id, { path: item.path!, url: item.signedUrl });
      }
    }
    this.avatarUrls.set(next);
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

  /** Diz onde moro (ou tira a escolha). Devolve false se a base de dados recusou. */
  async setHome(home: HomeKey | null): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ home })
      .eq('id', userId)
      .select(COLUMNS)
      .single<Profile>();
    if (error || !data) return false;
    this.profile.set(data);
    this.people.update((people) => people.map((person) => (person.id === data.id ? data : person)));
    return true;
  }

  /** Muda a minha dotação mensal. Devolve false se a base de dados recusou. */
  async setAllowance(amount: number): Promise<boolean> {
    const userId = this.auth.userId();
    if (!userId) return false;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ monthly_allowance: amount })
      .eq('id', userId)
      .select(COLUMNS)
      .single<Profile>();
    if (error || !data) return false;
    this.profile.set(data);
    this.people.update((people) => people.map((person) => (person.id === data.id ? data : person)));
    await this.loadAllowanceHistory();
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
    void this.loadAllowanceHistory();
    const mine = data.find((person) => person.id === userId);
    if (!mine) return;
    this.profile.set(mine);
    this.language.set(mine.language);
    this.theme.set(mine.theme);
    await this.signAvatars();
  }

  private async loadAllowanceHistory(): Promise<void> {
    const { data } = await this.supabase
      .from('allowance_history')
      .select('user_id, month, amount')
      .returns<{ user_id: string; month: string; amount: number | string }[]>();
    if (!data) return;
    this.allowanceHistory.set(data.map((row) => ({ userId: row.user_id, month: row.month, amount: Number(row.amount) })));
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
