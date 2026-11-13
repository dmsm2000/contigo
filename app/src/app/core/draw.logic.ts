// Lógica pura do sorteio do mês: sem Angular nem rede, para se testar facilmente.
import { addDays, FreeWindow, fitsWindow } from './availability.logic';
import { Suggestion } from './suggestions';
import { buildPool, DEFAULT_SURPRISE_SHARE, normalize, PoolEntry, WishlistItem } from './wishlist.logic';

/** O primeiro dia do mês de `today` ("2026-11-13" → "2026-11-01"): é a chave dos vetos, um por pessoa e por mês. */
export function monthKey(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/**
 * As opções vetadas, com os "gémeos": uma sugestão vetada que entretanto foi para a wishlist continua a ser o mesmo
 * sítio, por isso a sua versão da wishlist também fica de fora (e vice-versa).
 */
export function expandVetoes(
  vetoed: ReadonlySet<string>,
  wishlist: readonly WishlistItem[],
  suggestions: readonly Suggestion[],
): Set<string> {
  const all = new Set(vetoed);
  for (const id of vetoed) {
    if (id.startsWith('suggestion:')) {
      const suggestion = suggestions.find((item) => `suggestion:${item.id}` === id);
      if (!suggestion) continue;
      for (const item of wishlist) if (normalize(item.place.name) === normalize(suggestion.name)) all.add(`wish:${item.place.id}`);
    } else if (id.startsWith('wish:')) {
      const item = wishlist.find((candidate) => `wish:${candidate.place.id}` === id);
      if (!item) continue;
      for (const suggestion of suggestions) if (normalize(suggestion.name) === normalize(item.place.name)) all.add(`suggestion:${suggestion.id}`);
    }
  }
  return all;
}

export interface DrawOptions {
  /** A janela para que se sorteia; sem ela, qualquer sítio serve. */
  window: Pick<FreeWindow, 'days'> | null;
  includeSuggestions: boolean;
  /** As opções já vetadas este mês (por qualquer um dos dois). */
  vetoed: ReadonlySet<string>;
  surpriseShare?: number;
}

/**
 * A rotação do sorteio: a wishlist e as sugestões que cabem na janela (pela duração mínima), sem as vetadas.
 * Cada fonte leva a sua fatia da probabilidade (ver `buildPool`).
 */
export function drawPool(wishlist: readonly WishlistItem[], suggestions: readonly Suggestion[], options: DrawOptions): PoolEntry[] {
  const days = options.window?.days ?? null;
  const fits = (minStay: Parameters<typeof fitsWindow>[0]) => days === null || fitsWindow(minStay, days);
  return buildPool(
    wishlist.filter((item) => fits(item.minStay)),
    suggestions.filter((item) => fits(item.minStay)),
    {
      includeSuggestions: options.includeSuggestions,
      exclude: options.vetoed,
      surpriseShare: options.surpriseShare ?? DEFAULT_SURPRISE_SHARE,
    },
  );
}

export interface PoolSummary {
  wishes: number;
  surprises: number;
  /** A probabilidade de sair uma surpresa, de 0 a 1. */
  surpriseChance: number;
}

export function summarizePool(pool: readonly PoolEntry[]): PoolSummary {
  let wishes = 0;
  let surprises = 0;
  let surpriseChance = 0;
  for (const entry of pool) {
    if (entry.kind === 'wishlist') {
      wishes += 1;
    } else {
      surprises += 1;
      surpriseChance += entry.weight;
    }
  }
  return { wishes, surprises, surpriseChance };
}

/** De onde saiu uma viagem sorteada, pelo que ficou guardado nela. */
export function entrySource(entry: string | null): 'wishlist' | 'suggestion' | null {
  if (entry?.startsWith('wish:')) return 'wishlist';
  if (entry?.startsWith('suggestion:')) return 'suggestion';
  return null;
}

export interface TripDates {
  start: string;
  end: string | null;
  precision: 'day' | 'month';
}

/** As datas da viagem sorteada: as da janela, ou (sem janela) o mês que vem, só com o mês. */
export function tripDatesFor(window: Pick<FreeWindow, 'start' | 'end'> | null, today: string): TripDates {
  if (window) return { start: window.start, end: window.end === window.start ? null : window.end, precision: 'day' };
  const [year, month] = today.split('-').map(Number);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { start: `${next.year}-${String(next.month).padStart(2, '0')}-01`, end: null, precision: 'month' };
}

/**
 * Os nomes que passam no ecrã durante a cerimónia, a acabar no sorteado. Nunca repete o mesmo nome em frames
 * seguidos (se houver mais do que um). `random` devolve um número em [0, 1): serve para testar.
 */
export function reelFrames(names: readonly string[], winner: string, count: number, random: () => number = Math.random): string[] {
  const others = [...new Set(names.filter((name) => name !== winner))];
  const frames: string[] = [];
  for (let index = 0; index < count - 1; index++) {
    const choices = others.length ? others : [winner];
    const previous = frames[frames.length - 1];
    const usable = choices.length > 1 ? choices.filter((name) => name !== previous) : choices;
    frames.push(usable[Math.floor(random() * usable.length)]);
  }
  // O último frame antes do sorteado não pode ser ele próprio, para a revelação ter surpresa.
  frames.push(winner);
  return frames;
}

/** Quanto tempo cada frame fica no ecrã, em ms: começa depressa e abranda até ao fim (a roleta a parar). */
export function reelDelays(count: number, fastest = 60, slowest = 460): number[] {
  if (count <= 1) return [slowest];
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    return Math.round(fastest + (slowest - fastest) * progress ** 2.4);
  });
}

/** O dia a partir do qual se pode sortear outra vez: nada a esperar, só serve para o texto dos vetos. */
export function nextMonthStart(today: string): string {
  return addDays(monthKey(today), 32).slice(0, 7) + '-01';
}
