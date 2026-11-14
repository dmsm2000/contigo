import { describe, expect, it } from 'vitest';
import { countryOf, normalize, parseSearch } from './country.logic';

describe('countryOf', () => {
  it('reconhece o país em português, espanhol e inglês, com ou sem acentos', () => {
    expect(countryOf('Espanha')).toBe('ES');
    expect(countryOf('españa')).toBe('ES');
    expect(countryOf('Spain')).toBe('ES');
    expect(countryOf('FRANÇA')).toBe('FR');
    expect(countryOf('Alemanha')).toBe('DE');
    expect(countryOf('EUA')).toBe('US');
    expect(countryOf('Holanda')).toBe('NL');
  });

  it('o que não é país dá nulo', () => {
    expect(countryOf('Braga')).toBeNull();
    expect(countryOf('')).toBeNull();
  });
});

describe('parseSearch', () => {
  it('"cidade, país" e "cidade país"', () => {
    expect(parseSearch('Madrid, Espanha')).toEqual({ city: 'Madrid', countryCode: 'ES', countryOnly: false });
    expect(parseSearch('Madrid Espanha')).toEqual({ city: 'Madrid', countryCode: 'ES', countryOnly: false });
    expect(parseSearch('Munique Alemanha')).toEqual({ city: 'Munique', countryCode: 'DE', countryOnly: false });
  });

  it('o país primeiro também serve', () => {
    expect(parseSearch('Espanha, Sevilha')).toEqual({ city: 'Sevilha', countryCode: 'ES', countryOnly: false });
    expect(parseSearch('Itália Roma')).toEqual({ city: 'Roma', countryCode: 'IT', countryOnly: false });
  });

  it('só o país: marca-o para a pesquisa mostrar a capital', () => {
    expect(parseSearch('Espanha')).toEqual({ city: 'Espanha', countryCode: 'ES', countryOnly: true });
    expect(parseSearch('  portugal ')).toMatchObject({ countryCode: 'PT', countryOnly: true });
  });

  it('países com mais do que uma palavra', () => {
    expect(parseSearch('Cidade Rio de Janeiro Brasil')).toMatchObject({ countryCode: 'BR', city: 'Cidade Rio de Janeiro' });
    expect(parseSearch('Londres Reino Unido')).toEqual({ city: 'Londres', countryCode: 'GB', countryOnly: false });
  });

  it('sem país fica como está', () => {
    expect(parseSearch('Sintra')).toEqual({ city: 'Sintra', countryCode: null, countryOnly: false });
    expect(parseSearch('Madrid, Comunidade de Madrid')).toEqual({ city: 'Madrid, Comunidade de Madrid', countryCode: null, countryOnly: false });
  });
});

describe('normalize', () => {
  it('tira acentos, maiúsculas e espaços a mais', () => {
    expect(normalize('  São  Tomé ')).toBe('sao tome');
  });
});
