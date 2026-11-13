import { describe, expect, it } from 'vitest';
import { SUGGESTIONS } from './suggestions';
import {
  averageStars,
  buildPool,
  DEFAULT_SURPRISE_SHARE,
  distanceKm,
  freshSuggestions,
  HOME_MADRID,
  HOME_PORTO,
  nearestOrigin,
  normalizeLink,
  pick,
  sortWishlist,
  toWishlistItem,
  WishlistItem,
  WishlistRow,
  wishPins,
} from './wishlist.logic';

const item = (id: string, name: string, total: number): WishlistItem => ({
  place: { id, name, admin1: null, countryCode: 'PT', lat: 41, lng: -8, osmRef: null },
  note: null,
  link: null,
  minStay: null,
  stars: {},
  total,
});

/** Um gerador de números simples e sempre igual, para testes que dependem de sorte. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('lista curada de sugestões', () => {
  it('não repete identificadores nem nomes', () => {
    const ids = SUGGESTIONS.map((suggestion) => suggestion.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = SUGGESTIONS.map((suggestion) => suggestion.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tem sítios dentro da Península Ibérica e dados válidos', () => {
    for (const suggestion of SUGGESTIONS) {
      expect(suggestion.name.trim().length).toBeGreaterThan(1);
      expect(suggestion.lat).toBeGreaterThan(36);
      expect(suggestion.lat).toBeLessThan(44);
      expect(suggestion.lng).toBeGreaterThan(-10);
      expect(suggestion.lng).toBeLessThan(4);
      expect(['PT', 'ES']).toContain(suggestion.countryCode);
      expect(['day', 'weekend', 'long']).toContain(suggestion.minStay);
      expect(suggestion.tags.length).toBeGreaterThan(0);
    }
  });

  it('é grande o suficiente para variar, e todos ficam a uma distância razoável', () => {
    expect(SUGGESTIONS.length).toBeGreaterThanOrEqual(40);
    for (const suggestion of SUGGESTIONS) {
      const nearest = Math.min(
        distanceKm(HOME_PORTO, [suggestion.lng, suggestion.lat]),
        distanceKm(HOME_MADRID, [suggestion.lng, suggestion.lat]),
      );
      expect(nearest).toBeLessThan(450);
    }
  });
});

describe('distanceKm', () => {
  it('Porto–Madrid são cerca de 420 km em linha reta', () => {
    expect(distanceKm(HOME_PORTO, HOME_MADRID)).toBeGreaterThan(400);
    expect(distanceKm(HOME_PORTO, HOME_MADRID)).toBeLessThan(440);
  });

  it('o mesmo ponto fica a zero e a distância é simétrica', () => {
    expect(distanceKm(HOME_PORTO, HOME_PORTO)).toBe(0);
    expect(distanceKm(HOME_PORTO, HOME_MADRID)).toBeCloseTo(distanceKm(HOME_MADRID, HOME_PORTO), 6);
  });
});

describe('normalizeLink', () => {
  it('aceita ligações com e sem https://', () => {
    expect(normalizeLink('https://exemplo.pt/sitio')).toBe('https://exemplo.pt/sitio');
    expect(normalizeLink('exemplo.pt/sitio')).toBe('https://exemplo.pt/sitio');
    expect(normalizeLink('  http://exemplo.pt  ')).toBe('http://exemplo.pt/');
  });

  it('vazio quer dizer sem ligação', () => {
    expect(normalizeLink('')).toBeNull();
    expect(normalizeLink('   ')).toBeNull();
  });

  it('recusa o que não é http(s)', () => {
    expect(normalizeLink('javascript:alert(1)')).toBe('invalid');
    expect(normalizeLink('data:text/html,x')).toBe('invalid');
    expect(normalizeLink('ftp://exemplo.pt')).toBe('invalid');
    expect(normalizeLink('não é uma ligação')).toBe('invalid');
    expect(normalizeLink('localhost')).toBe('invalid');
  });
});

describe('nearestOrigin', () => {
  it('Braga está perto do Porto e Toledo perto de Madrid', () => {
    expect(nearestOrigin([-8.42, 41.55]).origin).toBe('Porto');
    expect(nearestOrigin([-4.03, 39.86]).origin).toBe('Madrid');
  });

  it('arredonda a 5 km e nunca dá menos de 5', () => {
    expect(nearestOrigin([-8.611, 41.1496]).km).toBe(5);
    expect(nearestOrigin([-8.42, 41.55]).km % 5).toBe(0);
  });
});

describe('toWishlistItem e sortWishlist', () => {
  it('junta as estrelas dos dois', () => {
    const row = {
      id: 'p1', name: 'Salamanca', admin1: 'Salamanca', country_code: 'ES', lat: 40.9, lng: -5.6, osm_ref: null,
      note: 'a praça', link: null, min_stay: 'weekend',
      place_wishes: [{ place_id: 'p1', user_id: 'u1', stars: 3 }, { place_id: 'p1', user_id: 'u2', stars: 2 }],
    } as WishlistRow;
    const result = toWishlistItem(row);
    expect(result.stars).toEqual({ u1: 3, u2: 2 });
    expect(result.total).toBe(5);
    expect(result.minStay).toBe('weekend');
    expect(result.place.name).toBe('Salamanca');
  });

  it('ordena do mais desejado para o menos, e desempata pelo nome', () => {
    const sorted = sortWishlist([item('1', 'Viseu', 2), item('2', 'Évora', 5), item('3', 'Aveiro', 2)]);
    expect(sorted.map((entry) => entry.place.name)).toEqual(['Évora', 'Aveiro', 'Viseu']);
  });
});

describe('freshSuggestions', () => {
  const catalogue = SUGGESTIONS.filter((suggestion) => ['braga', 'guimaraes', 'aveiro', 'salamanca'].includes(suggestion.id));

  it('tira os sítios com o mesmo nome, mesmo com acentos e maiúsculas', () => {
    const result = freshSuggestions(catalogue, [{ name: 'GUIMARAES', lat: null, lng: null }]);
    expect(result.map((suggestion) => suggestion.id)).not.toContain('guimaraes');
    expect(result).toHaveLength(3);
  });

  it('tira os sítios que estão a menos de 6 km de um já conhecido', () => {
    const result = freshSuggestions(catalogue, [{ name: 'Centro histórico', lat: 41.551, lng: -8.428 }]);
    expect(result.map((suggestion) => suggestion.id)).not.toContain('braga');
  });

  it('não tira sítios longe nem sem coordenadas', () => {
    const result = freshSuggestions(catalogue, [{ name: 'Outro', lat: 38.7, lng: -9.1 }, { name: 'Sem sítio', lat: null, lng: null }]);
    expect(result).toHaveLength(4);
  });
});

describe('buildPool', () => {
  const wishlist = [item('1', 'Évora', 6), item('2', 'Viseu', 2)];
  const suggestions = SUGGESTIONS.slice(0, 20);
  const sum = (pool: { weight: number }[]) => pool.reduce((total, entry) => total + entry.weight, 0);

  it('as probabilidades somam 1', () => {
    expect(sum(buildPool(wishlist, suggestions))).toBeCloseTo(1, 10);
  });

  it('as sugestões levam a sua fatia, qualquer que seja o tamanho da wishlist', () => {
    const small = buildPool(wishlist, suggestions);
    const big = buildPool(Array.from({ length: 30 }, (_, i) => item(String(i), `Sítio ${i}`, 3)), suggestions);
    const share = (pool: ReturnType<typeof buildPool>) => sum(pool.filter((entry) => entry.kind === 'suggestion'));
    expect(share(small)).toBeCloseTo(DEFAULT_SURPRISE_SHARE, 10);
    expect(share(big)).toBeCloseTo(DEFAULT_SURPRISE_SHARE, 10);
  });

  it('dentro da wishlist, quem tem mais estrelas tem mais peso', () => {
    const pool = buildPool(wishlist, suggestions);
    const evora = pool.find((entry) => entry.id === 'wish:1')!;
    const viseu = pool.find((entry) => entry.id === 'wish:2')!;
    expect(evora.weight / viseu.weight).toBeCloseTo(3, 10);
  });

  it('o interruptor desliga as sugestões', () => {
    const pool = buildPool(wishlist, suggestions, { includeSuggestions: false });
    expect(pool.every((entry) => entry.kind === 'wishlist')).toBe(true);
    expect(sum(pool)).toBeCloseTo(1, 10);
  });

  it('sem wishlist, as sugestões levam tudo; sem sugestões, a wishlist leva tudo', () => {
    const onlySuggestions = buildPool([], suggestions);
    expect(onlySuggestions.every((entry) => entry.kind === 'suggestion')).toBe(true);
    expect(sum(onlySuggestions)).toBeCloseTo(1, 10);
    const onlyWishes = buildPool(wishlist, []);
    expect(onlyWishes.every((entry) => entry.kind === 'wishlist')).toBe(true);
    expect(sum(onlyWishes)).toBeCloseTo(1, 10);
  });

  it('deixa de fora as opções excluídas e volta a somar 1', () => {
    const pool = buildPool(wishlist, suggestions, { exclude: new Set(['wish:1', `suggestion:${suggestions[0].id}`]) });
    expect(pool.find((entry) => entry.id === 'wish:1')).toBeUndefined();
    expect(pool.find((entry) => entry.id === `suggestion:${suggestions[0].id}`)).toBeUndefined();
    expect(sum(pool)).toBeCloseTo(1, 10);
  });

  it('com tudo vazio não há opções', () => {
    expect(buildPool([], [])).toEqual([]);
  });

  it('um sítio sem estrelas ainda conta, com o peso mínimo', () => {
    const pool = buildPool([item('1', 'Sem estrelas', 0)], [], {});
    expect(pool).toHaveLength(1);
    expect(pool[0].weight).toBeCloseTo(1, 10);
  });
});

describe('pick', () => {
  const wishlist = [item('1', 'Évora', 3), item('2', 'Viseu', 3)];
  const suggestions = SUGGESTIONS.slice(0, 30);

  it('com a sorte no mínimo e no máximo sai a primeira e a última opção', () => {
    const pool = buildPool(wishlist, suggestions);
    expect(pick(pool, () => 0)?.id).toBe(pool[0].id);
    expect(pick(pool, () => 0.999999)?.id).toBe(pool[pool.length - 1].id);
  });

  it('sem opções não sai nada', () => {
    expect(pick([])).toBeNull();
  });

  it('ao longo de muitos sorteios, cerca de 25% são sugestões', () => {
    const pool = buildPool(wishlist, suggestions);
    const random = seeded(42);
    let surprises = 0;
    const draws = 20000;
    for (let i = 0; i < draws; i++) if (pick(pool, random)?.kind === 'suggestion') surprises += 1;
    expect(surprises / draws).toBeGreaterThan(0.22);
    expect(surprises / draws).toBeLessThan(0.28);
  });

  it('as sugestões também saem variadas, não sempre a mesma', () => {
    const pool = buildPool([], suggestions);
    const random = seeded(7);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(pick(pool, random)!.id);
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('wishPins', () => {
  const comCoordenadas = item('1', 'Évora', 4);
  const semCoordenadas: WishlistItem = { ...item('2', 'Um sítio sem localização', 2), place: { ...item('2', 'x', 2).place, name: 'Um sítio sem localização', lat: null, lng: null } };
  const jaVisitado = item('3', 'Braga', 3);

  it('faz um pin por sítio com coordenadas', () => {
    const pins = wishPins([comCoordenadas], new Set());
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ placeId: '1', name: 'Évora', initial: 'É', lng: -8, lat: 41 });
  });

  it('deixa de fora os sítios sem coordenadas', () => {
    expect(wishPins([semCoordenadas], new Set())).toEqual([]);
  });

  it('deixa de fora os sítios já visitados, que têm o pin de "já fomos"', () => {
    const pins = wishPins([comCoordenadas, jaVisitado], new Set(['3']));
    expect(pins.map((pin) => pin.placeId)).toEqual(['1']);
  });
});

describe('averageStars', () => {
  const withStars = (stars: Record<string, number>): WishlistItem => ({
    ...item('1', 'Évora', 0),
    stars,
    total: Object.values(stars).reduce((sum, value) => sum + value, 0),
  });

  it('sem estrelas é 0', () => {
    expect(averageStars(withStars({}))).toBe(0);
  });

  it('com uma pessoa é o que ela deu', () => {
    expect(averageStars(withStars({ a: 3 }))).toBe(3);
  });

  it('com duas pessoas é a média, arredondada', () => {
    expect(averageStars(withStars({ a: 3, b: 1 }))).toBe(2);
    expect(averageStars(withStars({ a: 3, b: 2 }))).toBe(3);
    expect(averageStars(withStars({ a: 1, b: 2 }))).toBe(2);
  });
});
