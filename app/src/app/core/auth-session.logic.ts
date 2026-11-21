// A sessão guardada no browser. Sem rede o Supabase não consegue renová-la (o token dura 1 h) e dá-a como inexistente;
// aqui lê-se a cópia, para a app abrir na mesma e a renovar quando a rede voltar.
import type { Session } from '@supabase/supabase-js';

/** A chave onde o Supabase guarda a sessão: a mesma que ele usa sozinho, para ninguém ter de voltar a entrar. */
export function authStorageKey(supabaseUrl: string): string {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return 'contigo-auth-token';
  }
}

/** A sessão guardada, se estiver inteira (tokens e utilizador); nulo se não há ou está estragada. */
export function parseStoredSession(raw: string | null): Session | null {
  try {
    const value: Partial<Session> | null = raw ? JSON.parse(raw) : null;
    return value &&
      typeof value.access_token === 'string' &&
      typeof value.refresh_token === 'string' &&
      typeof value.user?.id === 'string'
      ? (value as Session)
      : null;
  } catch {
    return null;
  }
}
