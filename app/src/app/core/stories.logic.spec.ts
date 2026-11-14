import { describe, expect, it } from 'vitest';
import { buildSlides, nextPosition, previousPosition, tapAction } from './stories.logic';

describe('buildSlides', () => {
  it('uma viagem sem fotos tem só o cartão', () => {
    expect(buildSlides([], false)).toEqual([{ kind: 'card' }]);
  });
  it('com fotos e sem nota, só as fotos', () => {
    expect(buildSlides(['a', 'b'], false)).toEqual([
      { kind: 'photo', photoId: 'a' },
      { kind: 'photo', photoId: 'b' },
    ]);
  });
  it('com fotos e nota, o cartão fecha', () => {
    expect(buildSlides(['a'], true)).toEqual([{ kind: 'photo', photoId: 'a' }, { kind: 'card' }]);
  });
});

describe('navegação', () => {
  const counts = [2, 1, 3];
  it('avança dentro da viagem e depois para a seguinte', () => {
    expect(nextPosition({ group: 0, slide: 0 }, counts)).toEqual({ group: 0, slide: 1 });
    expect(nextPosition({ group: 0, slide: 1 }, counts)).toEqual({ group: 1, slide: 0 });
  });
  it('no fim de tudo, fecha', () => {
    expect(nextPosition({ group: 2, slide: 2 }, counts)).toBeNull();
  });
  it('volta ao ecrã anterior e à viagem anterior', () => {
    expect(previousPosition({ group: 0, slide: 1 }, counts)).toEqual({ group: 0, slide: 0 });
    expect(previousPosition({ group: 1, slide: 0 }, counts)).toEqual({ group: 0, slide: 0 });
  });
  it('no primeiro ecrã de todos, fica onde está', () => {
    expect(previousPosition({ group: 0, slide: 0 }, counts)).toEqual({ group: 0, slide: 0 });
  });
  it('o terço esquerdo volta e o resto avança', () => {
    expect(tapAction(50, 300)).toBe('previous');
    expect(tapAction(150, 300)).toBe('next');
  });
});
