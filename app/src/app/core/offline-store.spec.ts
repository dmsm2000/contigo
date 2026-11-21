import { describe, expect, it } from 'vitest';
import { clearSnapshots, readSnapshot, writeSnapshot } from './offline-store';

/** Um armazenamento em memória, como o localStorage. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
    keys: () => [...data.keys()],
  };
}

describe('cópias locais', () => {
  it('guarda uma lista e lê a mesma lista', () => {
    const store = memory();
    writeSnapshot(
      'ana',
      'trips',
      [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
      ],
      store,
    );
    expect(readSnapshot('ana', 'trips', store)).toEqual([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
  });

  it('cada utilizador e cada lista têm a sua cópia', () => {
    const store = memory();
    writeSnapshot('ana', 'trips', [1], store);
    writeSnapshot('ana', 'docs', [2], store);
    expect(readSnapshot('ana', 'docs', store)).toEqual([2]);
    expect(readSnapshot('rui', 'trips', store)).toBeNull();
  });

  it('uma lista vazia é uma cópia válida (a viagem pode mesmo não ter nada)', () => {
    const store = memory();
    writeSnapshot('ana', 'trips', [], store);
    expect(readSnapshot('ana', 'trips', store)).toEqual([]);
  });

  it('sem cópia, ou com a cópia estragada, devolve nulo', () => {
    const store = memory();
    expect(readSnapshot('ana', 'trips', store)).toBeNull();
    writeSnapshot('ana', 'trips', [1], store);
    const [key] = store.keys();
    store.setItem(key, '{não é json');
    expect(readSnapshot('ana', 'trips', store)).toBeNull();
    store.setItem(key, '{"id":1}');
    expect(readSnapshot('ana', 'trips', store)).toBeNull();
  });

  it('apaga só as cópias da app, de qualquer utilizador', () => {
    const store = memory({ 'contigo.theme': 'dark', 'sb-127-auth-token': '{}' });
    writeSnapshot('ana', 'trips', [1], store);
    writeSnapshot('rui', 'docs', [2], store);
    clearSnapshots(store);
    expect(readSnapshot('ana', 'trips', store)).toBeNull();
    expect(readSnapshot('rui', 'docs', store)).toBeNull();
    expect(store.keys().sort()).toEqual(['contigo.theme', 'sb-127-auth-token']);
  });

  it('sem armazenamento, ou sem espaço, não rebenta', () => {
    expect(() => writeSnapshot('ana', 'trips', [1], null)).not.toThrow();
    expect(readSnapshot('ana', 'trips', null)).toBeNull();
    expect(() => clearSnapshots(null)).not.toThrow();
    const full = {
      ...memory(),
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
    };
    expect(() => writeSnapshot('ana', 'trips', [1], full)).not.toThrow();
  });
});
