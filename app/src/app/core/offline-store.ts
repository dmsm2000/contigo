// Cópias locais dos dados, para a app abrir e mostrar o roteiro mesmo sem rede.
// Ficam no browser, uma por utilizador, e saem quando a sessão acaba.

/** Sobe-se a versão quando o formato das cópias muda: as antigas deixam de ser lidas. */
const PREFIX = 'contigo.offline.v1';

/** O sítio onde ficam os ficheiros (bilhetes, reservas…) guardados no telemóvel. */
export const DOC_CACHE = 'contigo-docs-v1';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** O armazenamento pode não existir (modo privado), por isso tudo aqui é tolerante a falhas. */
function defaultStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function keyOf(userId: string, name: string): string {
  return `${PREFIX}:${userId}:${name}`;
}

/** A última cópia de uma lista de registos (tal como vieram do Supabase), ou nulo se não há ou está estragada. */
export function readSnapshot<T>(
  userId: string,
  name: string,
  storage: Store | null = defaultStore(),
): T[] | null {
  try {
    const raw = storage?.getItem(keyOf(userId, name));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? (value as T[]) : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(
  userId: string,
  name: string,
  rows: readonly unknown[],
  storage: Store | null = defaultStore(),
): void {
  try {
    storage?.setItem(keyOf(userId, name), JSON.stringify(rows));
  } catch {
    // Sem espaço ou sem armazenamento: fica só o que está em memória, como antes.
  }
}

/**
 * O que ainda não se enviou (por exemplo, despesas registadas sem rede). Fica à parte das cópias: as cópias apagam-se
 * quando a sessão acaba, mas isto é trabalho da pessoa que ainda não chegou ao servidor, e não se deve perder.
 */
const PENDING_PREFIX = 'contigo.pending.v1';

export function readPending<T>(
  userId: string,
  name: string,
  storage: Store | null = defaultStore(),
): T[] {
  try {
    const raw = storage?.getItem(`${PENDING_PREFIX}:${userId}:${name}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

/** Guarda o que falta enviar; uma lista vazia limpa a chave. Devolve falso se não coube (e a pessoa deve ser avisada). */
export function writePending(
  userId: string,
  name: string,
  rows: readonly unknown[],
  storage: Store | null = defaultStore(),
): boolean {
  try {
    const key = `${PENDING_PREFIX}:${userId}:${name}`;
    if (rows.length) storage?.setItem(key, JSON.stringify(rows));
    else storage?.removeItem(key);
    return !!storage;
  } catch {
    return false;
  }
}

/** Apaga todas as cópias (de qualquer utilizador). */
export function clearSnapshots(storage: Store | null = defaultStore()): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(`${PREFIX}:`)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Nada a fazer: se não se consegue ler, também não há o que apagar.
  }
}

/** Tudo o que a app guardou para uso sem rede: as cópias dos dados e os ficheiros. Chama-se quando a sessão acaba. */
export async function clearOfflineData(): Promise<void> {
  clearSnapshots();
  try {
    if (typeof caches !== 'undefined') await caches.delete(DOC_CACHE);
  } catch {
    // Sem Cache API não há ficheiros guardados.
  }
}
