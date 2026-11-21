import { describe, expect, it } from 'vitest';
import { extractLinks, linkHost, MAX_LINKS, shortenLinks } from './links.logic';

describe('extractLinks', () => {
  it('encontra as ligações de um texto, pela ordem', () => {
    expect(
      extractLinks('Reservar https://www.booking.com/hotel/mercado e ver http://exemplo.pt/a?b=1'),
    ).toEqual(['https://www.booking.com/hotel/mercado', 'http://exemplo.pt/a?b=1']);
  });

  it('aceita endereços começados por www. e põe-lhes https', () => {
    expect(extractLinks('ver www.renfe.com/bilhetes')).toEqual(['https://www.renfe.com/bilhetes']);
  });

  it('tira a pontuação que acompanha o endereço na frase', () => {
    expect(extractLinks('Vê https://a.pt/x, depois (https://b.pt/y). E https://c.pt/z!')).toEqual([
      'https://a.pt/x',
      'https://b.pt/y',
      'https://c.pt/z',
    ]);
  });

  it('um parêntese que faz parte do endereço fica', () => {
    expect(extractLinks('https://pt.wikipedia.org/wiki/Salamanca_(Espanha)')).toEqual([
      'https://pt.wikipedia.org/wiki/Salamanca_(Espanha)',
    ]);
  });

  it('não repete a mesma ligação', () => {
    expect(extractLinks('https://a.pt/x e outra vez https://a.pt/x')).toEqual(['https://a.pt/x']);
  });

  it('só mostra algumas, para não encher o ecrã', () => {
    const many = Array.from({ length: 9 }, (_, i) => `https://s${i}.pt`).join(' ');
    expect(extractLinks(many)).toHaveLength(MAX_LINKS);
  });

  it('sem ligações, ou com texto que só parece, não encontra nada', () => {
    expect(extractLinks(null)).toEqual([]);
    expect(extractLinks('')).toEqual([]);
    expect(extractLinks('3,5 km, Sr.Jose, hotel.mercado sem http')).toEqual([]);
    expect(extractLinks('só www. e http:// soltos')).toEqual([]);
  });

  it('só aceita http e https (nada de javascript: ou outros)', () => {
    expect(extractLinks('javascript:alert(1) ftp://x.pt data:text/html,x')).toEqual([]);
  });
});

describe('linkHost', () => {
  it('dá o nome do site, sem www', () => {
    expect(linkHost('https://www.booking.com/hotel/x?a=1')).toBe('booking.com');
    expect(linkHost('http://mapas.google.com/')).toBe('mapas.google.com');
    expect(linkHost('www.renfe.com/x')).toBe('renfe.com');
  });
});

describe('shortenLinks', () => {
  it('troca cada ligação pelo nome do site e deixa o resto do texto', () => {
    expect(
      shortenLinks('Reservar https://www.booking.com/hotel/x?aid=123456, antes de sexta.'),
    ).toBe('Reservar booking.com, antes de sexta.');
  });

  it('não mexe num texto sem ligações', () => {
    expect(shortenLinks('Levar o carregador')).toBe('Levar o carregador');
    expect(shortenLinks(null)).toBe('');
  });
});
