// Quão pronto está um sítio por ir para o sorteio: o que falta preencher e como o mês da viagem cai na altura ideal.
import type { WishlistItem } from './wishlist.logic';

export type WishMissing = 'duration' | 'stars' | 'months' | 'location';

/**
 * O que ainda falta num sítio: a duração mínima, as estrelas de cada pessoa que vai, a altura ideal e a localização.
 * O custo estimado é opcional e nunca conta.
 */
export function wishMissing(item: WishlistItem, userIds: readonly string[]): WishMissing[] {
  const missing: WishMissing[] = [];
  if (item.minStay === null) missing.push('duration');
  if (userIds.length ? userIds.some((id) => !item.stars[id]) : Object.keys(item.stars).length === 0) missing.push('stars');
  if (item.bestMonths === null) missing.push('months');
  if (item.place.lat === null || item.place.lng === null) missing.push('location');
  return missing;
}

export const isComplete = (item: WishlistItem, userIds: readonly string[]) => wishMissing(item, userIds).length === 0;

/** Os ids dos sítios por completar. */
export function incompleteIds(items: readonly WishlistItem[], userIds: readonly string[]): Set<string> {
  return new Set(items.filter((item) => !isComplete(item, userIds)).map((item) => item.place.id));
}

/** O mês (1 a 12) de uma data "2026-12-02". */
export const monthOf = (isoDate: string): number => Number(isoDate.slice(5, 7));

/** A viagem cai na altura ideal? `null` quando o sítio ainda não tem altura ideal (não se sabe). */
export function fitsMonth(bestMonths: readonly number[] | null, month: number): boolean | null {
  return bestMonths === null ? null : bestMonths.includes(month);
}

export const ALL_MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function monthName(month: number, language: string, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(language, { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 15)));
}

/**
 * Escreve a altura ideal: "o ano todo" quando são os 12 meses; senão, os intervalos seguidos
 * ("abril a junho, setembro"). Um intervalo pode atravessar o fim do ano ("novembro a fevereiro").
 */
export function formatMonths(months: readonly number[], language: string, allYear: string, to: string): string {
  const set = new Set(months);
  if (set.size >= 12) return allYear;
  if (!set.size) return '';
  // Começa num mês cujo anterior não está no conjunto, para o intervalo que atravessa dezembro ficar inteiro.
  const starts = ALL_MONTHS.filter((month) => set.has(month) && !set.has(month === 1 ? 12 : month - 1));
  const parts = starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return end === start ? monthName(start, language) : `${monthName(start, language)} ${to} ${monthName(end, language)}`;
  });
  return parts.join(', ');
}
