import { describe, expect, it } from 'vitest';
import { SUGGESTIONS } from './suggestions';
import { drawPool, entrySource, expandVetoes, monthKey, nextMonthStart, reelDelays, reelFrames, summarizePool, tripDatesFor } from './draw.logic';
import { WishlistItem } from './wishlist.logic';

const item = (id: string, name: string, total: number, minStay: WishlistItem['minStay'] = null): WishlistItem => ({
  place: { id, name, admin1: null, countryCode: 'PT', lat: 41, lng: -8, osmRef: null },
  note: null,
  link: null,
  minStay,
  stars: {},
  total,
});

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const base = { includeSuggestions: true, vetoed: new Set<string>() };

describe('monthKey e nextMonthStart', () => {
  it('é o primeiro dia do mês', () => {
    expect(monthKey('2026-11-13')).toBe('2026-11-01');
    expect(monthKey('2026-01-31')).toBe('2026-01-01');
  });

  it('o mês seguinte começa no dia 1, também a passar o ano', () => {
    expect(nextMonthStart('2026-11-13')).toBe('2026-12-01');
    expect(nextMonthStart('2026-12-31')).toBe('2027-01-01');
    expect(nextMonthStart('2026-01-31')).toBe('2026-02-01');
  });
});

describe('drawPool', () => {
  const wishlist = [item('1', 'Évora', 6, 'weekend'), item('2', 'Braga', 4, 'day'), item('3', 'Gerês', 5, 'long')];
  const suggestions = SUGGESTIONS.slice(0, 6);

  it('sem janela, entram todos os sítios da lista', () => {
    const pool = drawPool(wishlist, suggestions, { ...base, window: null });
    expect(pool.filter((entry) => entry.kind === 'wishlist')).toHaveLength(3);
  });

  it('numa janela de um dia só cabem os sítios de um dia (ou sem duração)', () => {
    const pool = drawPool([...wishlist, item('4', 'Porto', 2)], [], { ...base, window: { days: 1 } });
    expect(pool.map((entry) => entry.name).sort()).toEqual(['Braga', 'Porto']);
  });

  it('num fim de semana cabem os de um dia e os de fim de semana, mas não os longos', () => {
    const pool = drawPool(wishlist, [], { ...base, window: { days: 2 } });
    expect(pool.map((entry) => entry.name).sort()).toEqual(['Braga', 'Évora']);
  });

  it('as sugestões também respeitam a janela', () => {
    const pool = drawPool([], SUGGESTIONS, { ...base, window: { days: 1 } });
    const allowed = new Set(SUGGESTIONS.filter((s) => s.minStay === 'day').map((s) => `suggestion:${s.id}`));
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((entry) => allowed.has(entry.id))).toBe(true);
  });

  it('o que foi vetado este mês fica de fora, na lista e nas sugestões', () => {
    const vetoed = new Set(['wish:2', `suggestion:${suggestions[0].id}`]);
    const pool = drawPool(wishlist, suggestions, { ...base, window: null, vetoed });
    expect(pool.some((entry) => entry.id === 'wish:2')).toBe(false);
    expect(pool.some((entry) => entry.id === `suggestion:${suggestions[0].id}`)).toBe(false);
  });

  it('com as surpresas desligadas só entra a lista', () => {
    const pool = drawPool(wishlist, suggestions, { ...base, window: null, includeSuggestions: false });
    expect(pool.every((entry) => entry.kind === 'wishlist')).toBe(true);
  });

  it('as probabilidades somam 1, com 25% para as surpresas por defeito', () => {
    const pool = drawPool(wishlist, suggestions, { ...base, window: null });
    expect(pool.reduce((sum, entry) => sum + entry.weight, 0)).toBeCloseTo(1, 10);
    expect(summarizePool(pool)).toMatchObject({ wishes: 3, surprises: 6 });
    expect(summarizePool(pool).surpriseChance).toBeCloseTo(0.25, 10);
  });

  it('sem nada que caiba, a rotação fica vazia', () => {
    expect(drawPool([], [], { ...base, window: null })).toEqual([]);
  });
});

describe('entrySource', () => {
  it('diz de onde saiu a viagem', () => {
    expect(entrySource('wish:abc')).toBe('wishlist');
    expect(entrySource('suggestion:braga')).toBe('suggestion');
    expect(entrySource(null)).toBeNull();
    expect(entrySource('outro')).toBeNull();
  });
});

describe('tripDatesFor', () => {
  it('usa as datas da janela', () => {
    expect(tripDatesFor({ start: '2026-11-21', end: '2026-11-22' }, '2026-11-13')).toEqual({
      start: '2026-11-21',
      end: '2026-11-22',
      precision: 'day',
    });
  });

  it('uma janela de um dia não tem fim', () => {
    expect(tripDatesFor({ start: '2026-11-21', end: '2026-11-21' }, '2026-11-13')).toEqual({
      start: '2026-11-21',
      end: null,
      precision: 'day',
    });
  });

  it('sem janela, é o mês que vem, só com o mês', () => {
    expect(tripDatesFor(null, '2026-11-13')).toEqual({ start: '2026-12-01', end: null, precision: 'month' });
    expect(tripDatesFor(null, '2026-12-13')).toEqual({ start: '2027-01-01', end: null, precision: 'month' });
  });
});

describe('reelFrames', () => {
  const names = ['Évora', 'Braga', 'Gerês', 'Viseu'];

  it('acaba sempre no sorteado e tem o número de frames pedido', () => {
    const frames = reelFrames(names, 'Gerês', 12, seeded(7));
    expect(frames).toHaveLength(12);
    expect(frames[frames.length - 1]).toBe('Gerês');
  });

  it('não repete o mesmo nome em frames seguidos', () => {
    const frames = reelFrames(names, 'Gerês', 40, seeded(3));
    for (let i = 1; i < frames.length; i++) expect(frames[i]).not.toBe(frames[i - 1]);
  });

  it('o frame antes do sorteado nunca é o sorteado', () => {
    for (let seed = 1; seed < 30; seed++) {
      const frames = reelFrames(names, 'Gerês', 10, seeded(seed));
      expect(frames[frames.length - 2]).not.toBe('Gerês');
    }
  });

  it('só com um sítio, passa sempre esse', () => {
    expect(reelFrames(['Évora'], 'Évora', 5, seeded(1))).toEqual(['Évora', 'Évora', 'Évora', 'Évora', 'Évora']);
  });
});

describe('reelDelays', () => {
  it('abranda do princípio ao fim', () => {
    const delays = reelDelays(14);
    expect(delays).toHaveLength(14);
    expect(delays[0]).toBe(60);
    expect(delays[13]).toBe(460);
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
  });

  it('com um só frame, fica o mais lento', () => {
    expect(reelDelays(1)).toEqual([460]);
  });
});

describe('expandVetoes', () => {
  const braga = SUGGESTIONS.find((s) => s.id === 'braga')!;
  const wishlist = [item('7', 'Braga', 3), item('8', 'Évora', 2)];

  it('uma sugestão vetada que já está na wishlist também tira a versão da wishlist', () => {
    const all = expandVetoes(new Set(['suggestion:braga']), wishlist, SUGGESTIONS);
    expect(all.has('suggestion:braga')).toBe(true);
    expect(all.has('wish:7')).toBe(true);
    expect(all.has('wish:8')).toBe(false);
  });

  it('um sítio da wishlist vetado tira também a sugestão com o mesmo nome', () => {
    const all = expandVetoes(new Set(['wish:7']), wishlist, SUGGESTIONS);
    expect(all.has(`suggestion:${braga.id}`)).toBe(true);
  });

  it('ignora as diferenças de maiúsculas e acentos', () => {
    const all = expandVetoes(new Set(['suggestion:evora']), [item('8', 'EVORA', 2)], SUGGESTIONS);
    expect(all.has('wish:8')).toBe(true);
  });

  it('sem vetos não acrescenta nada, e não mexe no conjunto original', () => {
    const original = new Set<string>();
    expect(expandVetoes(original, wishlist, SUGGESTIONS).size).toBe(0);
    const one = new Set(['suggestion:braga']);
    expandVetoes(one, wishlist, SUGGESTIONS);
    expect(one.size).toBe(1);
  });
});
