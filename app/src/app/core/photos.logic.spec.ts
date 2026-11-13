import { describe, expect, it } from 'vitest';
import {
  checkFile,
  chunk,
  cleanCaption,
  coverOf,
  fitWithin,
  groupByTrip,
  MAX_CAPTION_LENGTH,
  MAX_INPUT_BYTES,
  Photo,
  photoPaths,
  sortPhotos,
  toPhoto,
} from './photos.logic';

const photo = (id: string, tripId: string, createdAt: string): Photo => ({
  id,
  tripId,
  userId: 'u1',
  path: `${tripId}/${id}.jpg`,
  thumbPath: `${tripId}/${id}_t.jpg`,
  width: 1600,
  height: 1200,
  caption: null,
  createdAt,
});

describe('fitWithin', () => {
  it('reduz a foto pelo lado maior, sem a deformar', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('não amplia uma foto pequena', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('nunca devolve zero, mesmo numa foto muito comprida', () => {
    expect(fitWithin(20000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('photoPaths', () => {
  it('guarda numa pasta por viagem, com a miniatura ao lado', () => {
    expect(photoPaths('t1', 'p9')).toEqual({ path: 't1/p9.jpg', thumbPath: 't1/p9_t.jpg' });
  });
});

describe('checkFile', () => {
  it('aceita imagens', () => {
    expect(checkFile({ type: 'image/jpeg', name: 'a.jpg', size: 3_000_000 })).toBe('ok');
    expect(checkFile({ type: 'image/heic', name: 'a.heic', size: 3_000_000 })).toBe('ok');
  });

  it('quando o browser não diz o tipo, vai pelo nome', () => {
    expect(checkFile({ type: '', name: 'IMG_0001.HEIC', size: 2_000_000 })).toBe('ok');
    expect(checkFile({ type: '', name: 'notas.txt', size: 100 })).toBe('notImage');
  });

  it('recusa o que não é imagem', () => {
    expect(checkFile({ type: 'application/pdf', name: 'a.pdf', size: 100 })).toBe('notImage');
    expect(checkFile({ type: 'video/mp4', name: 'a.mp4', size: 100 })).toBe('notImage');
  });

  it('recusa um ficheiro enorme', () => {
    expect(checkFile({ type: 'image/jpeg', name: 'a.jpg', size: MAX_INPUT_BYTES + 1 })).toBe('tooBig');
    expect(checkFile({ type: 'image/jpeg', name: 'a.jpg', size: MAX_INPUT_BYTES })).toBe('ok');
  });
});

describe('sortPhotos, groupByTrip e coverOf', () => {
  const photos = [photo('c', 't1', '2026-11-13T12:00:00Z'), photo('a', 't1', '2026-11-13T10:00:00Z'), photo('b', 't2', '2026-11-13T11:00:00Z')];

  it('ordena da mais antiga para a mais recente, sem mexer na lista original', () => {
    expect(sortPhotos(photos).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(photos[0].id).toBe('c');
  });

  it('desempata pelo id, para a ordem ser sempre a mesma', () => {
    const same = [photo('z', 't1', '2026-11-13T10:00:00Z'), photo('y', 't1', '2026-11-13T10:00:00Z')];
    expect(sortPhotos(same).map((p) => p.id)).toEqual(['y', 'z']);
  });

  it('agrupa por viagem', () => {
    const groups = groupByTrip(photos);
    expect(groups.get('t1')?.map((p) => p.id)).toEqual(['a', 'c']);
    expect(groups.get('t2')?.map((p) => p.id)).toEqual(['b']);
    expect(groups.get('t3')).toBeUndefined();
  });

  it('a capa é a primeira foto da viagem', () => {
    expect(coverOf(groupByTrip(photos).get('t1')!)?.id).toBe('a');
    expect(coverOf([])).toBeNull();
  });
});

describe('cleanCaption', () => {
  it('uma legenda vazia fica sem legenda', () => {
    expect(cleanCaption('')).toBeNull();
    expect(cleanCaption('   \n ')).toBeNull();
  });

  it('arruma os espaços e as quebras de linha', () => {
    expect(cleanCaption('  O pôr do   sol\nem Évora ')).toBe('O pôr do sol em Évora');
  });

  it('recusa uma legenda demasiado longa', () => {
    expect(cleanCaption('x'.repeat(MAX_CAPTION_LENGTH))).toBe('x'.repeat(MAX_CAPTION_LENGTH));
    expect(cleanCaption('x'.repeat(MAX_CAPTION_LENGTH + 1))).toBe('tooLong');
  });
});

describe('chunk e toPhoto', () => {
  it('parte uma lista em blocos', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('traduz a linha da base de dados', () => {
    expect(
      toPhoto({ id: 'p', trip_id: 't', user_id: 'u', path: 't/p.jpg', thumb_path: 't/p_t.jpg', width: 1600, height: 900, caption: 'Olá', created_at: '2026-11-13T10:00:00Z' }),
    ).toEqual({ id: 'p', tripId: 't', userId: 'u', path: 't/p.jpg', thumbPath: 't/p_t.jpg', width: 1600, height: 900, caption: 'Olá', createdAt: '2026-11-13T10:00:00Z' });
  });
});
