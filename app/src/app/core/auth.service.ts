import { computed, inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly sessionState = signal<Session | null>(null);

  readonly session = this.sessionState.asReadonly();
  readonly userId = computed(() => this.sessionState()?.user.id ?? null);
  readonly email = computed(() => this.sessionState()?.user.email ?? '');
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.supabase.auth.getSession().then(({ data }) => {
      this.sessionState.set(data.session);
    });
    this.supabase.auth.onAuthStateChange((_event, session) => this.sessionState.set(session));
  }

  /** Entra com email e palavra-passe. As contas são criadas por convite; não há registo público. */
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async changePassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
