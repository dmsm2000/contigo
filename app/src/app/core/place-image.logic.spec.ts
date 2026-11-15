import { describe, expect, it } from 'vitest';
import { pickWikidataImage, creditOf, isWikimediaUrl, nameWords, pickCommons, pickImage, WikiPage, CommonsFile } from './place-image.logic';

const photo = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}.jpg`;
const page = (title: string, image: string | null, lat?: number, lon?: number, index = 1): WikiPage => ({
  title,
  index,
  thumbnail: image ? { source: image } : undefined,
  coordinates: lat === undefined ? undefined : [{ lat, lon: lon as number }],
});
const sintra = { name: 'Sintra', lat: 38.8, lng: -9.38 };

describe('pickImage', () => {
  it('escolhe o artigo com o nome do sítio e perto dele', () => {
    const pages = [page('Sintra (Brasil)', photo('Outra'), -3, -60, 1), page('Sintra', photo('Pena'), 38.8, -9.38, 2)];
    expect(pickImage(pages, sintra)).toBe(photo('Pena'));
  });

  it('ignora artigos de outro sítio com o mesmo nome (longe)', () => {
    expect(pickImage([page('Sintra', photo('Longe'), -3, -60)], sintra)).toBeNull();
  });

  it('nunca devolve uma bandeira, um brasão ou um mapa', () => {
    const pages = [page('Sintra', 'https://upload.wikimedia.org/wikipedia/commons/x/Flag_of_Sintra.svg.png', 38.8, -9.38)];
    expect(pickImage(pages, sintra)).toBeNull();
  });

  it('nunca devolve bandeiras, brasões ou mapas em português ou espanhol', () => {
    for (const file of ['Bandera_de_Cáceres.svg.png', 'Bandeira_de_Braga.png', 'Escudo_de_Aveiro.png', 'Provincia_Cáceres.png', 'Mapa_de_Sintra.png', 'Sintra_locator_map.png']) {
      expect(pickImage([page('Sintra', photo(file), 38.8, -9.38)], sintra)).toBeNull();
    }
  });

  it('com coordenadas, um artigo sem coordenadas e com o mesmo nome (a província) não serve', () => {
    expect(pickImage([page('Sintra (província)', photo('Foto'))], sintra)).toBeNull();
  });

  it('sem coordenadas, serve o artigo cujo título é o nome', () => {
    expect(pickImage([page('Braga', photo('Se'))], { name: 'braga', lat: null, lng: null })).toBe(photo('Se'));
  });

  it('ignora o texto entre parênteses do título', () => {
    expect(pickImage([page('Madrid (cidade)', photo('Madrid'), 40.4, -3.7)], { name: 'Madrid', lat: 40.41, lng: -3.7 })).toBe(photo('Madrid'));
  });

  it('só aceita imagens do Wikimedia', () => {
    expect(isWikimediaUrl('https://upload.wikimedia.org/x.jpg')).toBe(true);
    expect(isWikimediaUrl('https://thumb.wikimedia.org/x.jpg')).toBe(true);
    expect(isWikimediaUrl('https://evil.example.com/wikimedia.org/x.jpg')).toBe(false);
    expect(isWikimediaUrl('http://upload.wikimedia.org/x.jpg')).toBe(false);
    expect(isWikimediaUrl('não é um endereço')).toBe(false);
    expect(pickImage([page('Sintra', 'https://evil.example.com/a.jpg', 38.8, -9.38)], sintra)).toBeNull();
  });
});

const file = (title: string, width = 3000, height = 2000, over: Partial<CommonsFile> = {}): CommonsFile => ({
  title: `File:${title}`,
  index: 1,
  mime: 'image/jpeg',
  width,
  height,
  thumbUrl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${encodeURIComponent(title)}/1000px-x.jpg`,
  artist: '<a href="//x">Zarateman</a>',
  license: 'CC BY-SA 3.0',
  ...over,
});

describe('pickCommons', () => {
  it('escolhe fotografias grandes, na horizontal, com o nome do sítio no título', () => {
    const files = [
      file('Cáceres - Torre de San Francisco Javier.jpg'),
      file('Castillo de Trujillo, Cáceres.jpg', 7000, 4000),
      file('Outra coisa qualquer.jpg'),
      file('Cáceres vertical.jpg', 2000, 3000),
      file('Cáceres pequena.jpg', 800, 600),
      file('Cáceres.png', 3000, 2000, { mime: 'image/png' }),
    ];
    expect(pickCommons(files, { name: 'Cáceres' }, 'quality').map((c) => c.title)).toEqual(['Cáceres - Torre de San Francisco Javier.jpg', 'Castillo de Trujillo, Cáceres.jpg']);
  });

  it('as que não são de qualidade têm de ser ainda maiores', () => {
    expect(pickCommons([file('Sintra a.jpg', 1800, 1200)], { name: 'Sintra' }, 'quality')).toHaveLength(1);
    expect(pickCommons([file('Sintra a.jpg', 1800, 1200)], { name: 'Sintra' }, 'commons')).toHaveLength(0);
  });

  it('não repete séries do mesmo autor e respeita o limite', () => {
    const files = ['Salamanca - BC 02.jpg', 'Salamanca - BC 03.jpg', 'Salamanca - BC 04.jpg', 'Salamanca, Plaza Mayor.jpg'].map((t, i) => file(t, 3000, 2000, { index: i }));
    expect(pickCommons(files, { name: 'Salamanca' }, 'quality').map((c) => c.title)).toEqual(['Salamanca - BC 02.jpg', 'Salamanca, Plaza Mayor.jpg']);
    expect(pickCommons(files, { name: 'Salamanca' }, 'quality', 1)).toHaveLength(1);
  });

  it('recusa bandeiras e mapas mesmo com o nome certo', () => {
    expect(pickCommons([file('Bandera de Salamanca.jpg'), file('Salamanca locator map.jpg')], { name: 'Salamanca' }, 'quality')).toEqual([]);
  });

  it('deixa de fora carros, animais e portas', () => {
    const files = ['Audi Q5 Amarante Rally de Portugal 2016.jpg', 'Door knocker in Coimbra 01.jpg', 'Red macaw Guimarães.jpg'].map((t) => file(t));
    expect(pickCommons(files, { name: 'Amarante' }, 'quality')).toEqual([]);
    expect(pickCommons([file('Coimbra November 2012-7.jpg')], { name: 'Coimbra' }, 'quality')).toHaveLength(1);
  });

  it('limpa o crédito e junta a licença', () => {
    expect(creditOf('<a href="//x">Zarateman</a>', 'CC BY-SA 3.0')).toBe('Foto: Zarateman · CC BY-SA 3.0 · Wikimedia Commons');
    expect(creditOf(null, null)).toBe('Foto · Wikimedia Commons');
  });

  it('as palavras do nome para o título', () => {
    expect(nameWords('San Lorenzo de El Escorial')).toEqual(['san', 'lorenzo']);
    expect(nameWords('Porto Covo')).toEqual(['porto', 'covo']);
    expect(nameWords('Évora')).toEqual(['evora']);
  });
});

describe('pickWikidataImage', () => {
  const braga = { name: 'Braga', lat: 41.55, lng: -8.42 };
  const item = (label: string, image: string | null, lat = 41.55, lng = -8.42) => ({ label, image, lat, lng });

  it('devolve a imagem principal do item com o nome certo e perto', () => {
    expect(pickWikidataImage([item('Braga', 'Arco da porta nova Braga.jpg')], braga)).toBe('Arco da porta nova Braga.jpg');
  });

  it('salta itens sem imagem, de outro sítio ou longe (a Braga de outro país)', () => {
    expect(pickWikidataImage([item('Braga', null), item('Braga', 'Longe.jpg', -2, 40), item('Brago', 'Outro.jpg'), item('Braga', 'Certa.jpg')], braga)).toBe('Certa.jpg');
  });

  it('só aceita JPEG, PNG ou WebP (nada de SVG)', () => {
    expect(pickWikidataImage([item('Braga', 'Brasao.svg')], braga)).toBeNull();
  });

  it('sem coordenadas do sítio não arrisca', () => {
    expect(pickWikidataImage([item('Braga', 'A.jpg')], { name: 'Braga', lat: null, lng: null })).toBeNull();
  });
});
