// Preferências guardadas no browser. O armazenamento pode não existir (modo privado), por isso tudo é tolerante a falhas.

export function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento: a preferência vale só para esta sessão.
  }
}
