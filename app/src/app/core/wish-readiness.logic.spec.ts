import { describe, expect, it } from 'vitest';
import { drawPool } from './draw.logic';
import { fitsMonth, formatMonths, incompleteIds, monthOf, wishMissing } from './wish-readiness.logic';
import { WishlistItem } from './wishlist.logic';

const item = (id: string, over: Partial<WishlistItem> = {}, lat: number | null = 41): WishlistItem => ({
  place: { id, name: id, admin1: null, countryCode: 'PT', lat, lng: lat === null ? null : -8, osmRef: null, imagePath: null },
  note: null,
  link: null,
  minStay: 'day',
  bestMonths: [4, 5, 6],
  stars: { a: 2, b: 3 },
  total: 5,
  ...over,
});

describe('o que falta num sítio', () => {
  it('um sítio com tudo está pronto', () => {
    expect(wishMissing(item('x'), ['a', 'b'])).toEqual([]);
  });

  it('diz o que falta: duração, estrelas de cada um, altura ideal e localização', () => {
    expect(wishMissing(item('x', { minStay: null }), ['a', 'b'])).toEqual(['duration']);
    expect(wishMissing(item('x', { stars: { a: 2 }, total: 2 }), ['a', 'b'])).toEqual(['stars']);
    expect(wishMissing(item('x', { bestMonths: null }), ['a', 'b'])).toEqual(['months']);
    expect(wishMissing(item('x', {}, null), ['a', 'b'])).toEqual(['location']);
    expect(wishMissing(item('x', { minStay: null, bestMonths: null }, null), ['a', 'b'])).toEqual(['duration', 'months', 'location']);
  });

  it('sozinho, só contam as minhas estrelas', () => {
    expect(wishMissing(item('x', { stars: { a: 1 }, total: 1 }), ['a'])).toEqual([]);
  });

  it('lista os incompletos', () => {
    expect([...incompleteIds([item('ok'), item('falta', { minStay: null })], ['a', 'b'])]).toEqual(['falta']);
  });
});

describe('altura ideal', () => {
  it('lê o mês e vê se cabe; sem altura ideal não se sabe', () => {
    expect(monthOf('2026-12-02')).toBe(12);
    expect(fitsMonth([4, 5, 6], 5)).toBe(true);
    expect(fitsMonth([4, 5, 6], 12)).toBe(false);
    expect(fitsMonth(null, 12)).toBeNull();
  });

  it('escreve os meses seguidos como intervalos, e o ano todo', () => {
    expect(formatMonths([4, 5, 6], 'pt', 'o ano todo', 'a')).toBe('abril a junho');
    expect(formatMonths([4, 5, 6, 9], 'pt', 'o ano todo', 'a')).toBe('abril a junho, setembro');
    expect(formatMonths([11, 12, 1, 2], 'pt', 'o ano todo', 'a')).toBe('novembro a fevereiro');
    expect(formatMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'pt', 'o ano todo', 'a')).toBe('o ano todo');
  });
});

describe('sorteio equilibrado', () => {
  it('os incompletos saem com metade do peso, mas continuam na rotação', () => {
    const pool = drawPool([item('pronto'), item('incompleto', { minStay: null })], [], {
      window: null,
      includeSuggestions: false,
      vetoed: new Set(),
      userIds: ['a', 'b'],
    });
    const weight = (name: string) => pool.find((entry) => entry.name === name)!.weight;
    expect(pool).toHaveLength(2);
    expect(weight('pronto')).toBeCloseTo(2 * weight('incompleto'), 5);
    expect(weight('pronto') + weight('incompleto')).toBeCloseTo(1, 5);
  });
});
