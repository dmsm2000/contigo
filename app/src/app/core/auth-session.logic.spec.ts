import { describe, expect, it } from 'vitest';
import { authStorageKey, parseStoredSession } from './auth-session.logic';

describe('authStorageKey', () => {
  it('é a chave que o Supabase usa sozinho (primeira parte do endereço)', () => {
    expect(authStorageKey('http://127.0.0.1:55321')).toBe('sb-127-auth-token');
    expect(authStorageKey('https://abcd1234.supabase.co')).toBe('sb-abcd1234-auth-token');
  });

  it('com um endereço que não é válido, ainda dá uma chave', () => {
    expect(authStorageKey('__SUPABASE_URL__')).toBe('contigo-auth-token');
  });
});

describe('parseStoredSession', () => {
  const valid = {
    access_token: 'a',
    refresh_token: 'r',
    expires_at: 1,
    user: { id: 'u1', email: 'x@y.z' },
  };

  it('lê uma sessão inteira', () => {
    expect(parseStoredSession(JSON.stringify(valid))?.user.id).toBe('u1');
  });

  it('não aceita sessões a que falta alguma coisa', () => {
    expect(parseStoredSession(JSON.stringify({ ...valid, refresh_token: undefined }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...valid, access_token: 3 }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...valid, user: undefined }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ ...valid, user: {} }))).toBeNull();
  });

  it('sem nada guardado, ou com lixo, dá nulo', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('')).toBeNull();
    expect(parseStoredSession('{não é json')).toBeNull();
    expect(parseStoredSession('"texto"')).toBeNull();
    expect(parseStoredSession('null')).toBeNull();
  });
});
