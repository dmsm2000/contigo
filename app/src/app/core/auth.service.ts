import { computed, inject, Injectable, signal } from '@angular/core';
import { isAuthRetryableFetchError, Session } from '@supabase/supabase-js';
import { parseStoredSession } from './auth-session.logic';
import { clearOfflineData } from './offline-store';
import { SupabaseService } from './supabase.service';

/**
 * Quanto se espera pelo Supabase antes de arrancar com a sessão guardada. Sem rede, ele tenta renovar o token durante
 * uns 24 s antes de desistir, e a app não pode ficar esse tempo no ecrã de abertura.
 */
const SESSION_WAIT_MS = 3000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  private readonly sessionState = signal<Session | null>(null);
  private readonly staleState = signal(false);
  private readonly recoveredState = signal(0);

  readonly session = this.sessionState.asReadonly();
  readonly userId = computed(() => this.sessionState()?.user.id ?? null);
  readonly email = computed(() => this.sessionState()?.user.email ?? '');
  /**
   * Verdadeiro quando a sessão é só a cópia guardada no telemóvel, porque o Supabase não a conseguiu renovar (sem rede).
   * Enquanto durar, não se vai à rede (os pedidos iriam como anónimos e voltariam vazios): mostram-se as cópias locais.
   */
  readonly stale = this.staleState.asReadonly();
  /** Sobe quando a sessão se renova depois de ter estado assim: é a altura de ir buscar os dados outra vez. */
  readonly recovered = this.recoveredState.asReadonly();
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.start();
    this.supabase.auth.onAuthStateChange((event, session) => {
      // Sem rede, o primeiro evento diz "sem sessão" só porque não houve como renová-la: fica a cópia.
      if (event === 'INITIAL_SESSION' && !session && this.staleState()) return;
      // Ninguém deve ver, no mesmo telemóvel, o que ficou guardado de uma sessão que acabou.
      if (event === 'SIGNED_OUT') void clearOfflineData();
      if (session) this.receive(session);
      else this.sessionState.set(null);
    });
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

  /**
   * Sai. Sem rede não dá: o Supabase só termina a sessão falando com o servidor, e sair sem poder voltar a entrar
   * deixava os dois sem a app. Devolve falso nesse caso (a sessão fica como estava).
   */
  async signOut(): Promise<boolean> {
    if (!navigator.onLine) return false;
    const { error } = await this.supabase.auth.signOut();
    return !(error && isAuthRetryableFetchError(error));
  }

  /** Uma sessão boa, vinda do Supabase: se estávamos com a cópia, passa a valer a nova. */
  private receive(session: Session): void {
    if (this.staleState()) {
      this.staleState.set(false);
      this.recoveredState.update((count) => count + 1);
    }
    this.sessionState.set(session);
  }

  /** Procura a sessão. Se o Supabase não responde a tempo (ou não há rede), arranca com a que está guardada. */
  private async start(): Promise<void> {
    const stored = parseStoredSession(this.read());
    const fresh = this.supabase.auth.getSession();
    // Com sessão guardada, não se espera por um Supabase que não vai responder (modo avião) nem se espera muito (rede fraca).
    const wait = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), navigator.onLine ? SESSION_WAIT_MS : 0),
    );
    const first = stored ? await Promise.race([fresh, wait]) : await fresh;

    if (first?.data.session) {
      this.sessionState.set(first.data.session);
      return;
    }
    // O Supabase respondeu mesmo: não há sessão, ou foi recusada.
    if (first && !(first.error && isAuthRetryableFetchError(first.error))) {
      this.sessionState.set(null);
      return;
    }
    if (!stored) {
      this.sessionState.set(null);
      return;
    }
    // Sem rede (ou demorou demais): vale a sessão guardada, e renova-se sozinha quando a rede voltar.
    this.staleState.set(true);
    this.sessionState.set(stored);
    void fresh.then(
      ({ data }) => {
        if (data.session) this.receive(data.session);
      },
      () => undefined,
    );
  }

  private read(): string | null {
    try {
      return localStorage.getItem(this.supabaseService.storageKey);
    } catch {
      return null;
    }
  }
}
