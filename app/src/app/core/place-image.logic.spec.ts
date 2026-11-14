import { describe, expect, it } from 'vitest';
import { isWikimediaUrl, pickImage, WikiPage } from './place-image.logic';

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
