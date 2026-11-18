import { describe, expect, it } from 'vitest';
import { checkDoc, docPath, formatSize, MAX_DOC_BYTES, mimeOf, nameFromFile, nextColor, NoteRow, sortNotes, toNote } from './trip-docs.logic';

const note = (id: string, pinned: boolean, createdAt: string) =>
  toNote({ id, trip_id: 't', body: id, color: 'yellow', pinned, created_by: null, created_at: createdAt } as NoteRow);

describe('trip-docs.logic', () => {
  it('põe os post-its fixados primeiro e mantém a ordem de escrita', () => {
    const sorted = sortNotes([note('a', false, '2026-01-01'), note('b', true, '2026-01-03'), note('c', true, '2026-01-02'), note('d', false, '2026-01-04')]);
    expect(sorted.map((n) => n.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('cai no amarelo se a cor for desconhecida', () => {
    expect(toNote({ id: 'x', trip_id: 't', body: 'x', color: 'roxo', pinned: false, created_by: null, created_at: '2026-01-01' }).color).toBe('yellow');
  });

  it('roda as cores dos post-its novos', () => {
    expect(nextColor(0)).toBe('yellow');
    expect(nextColor(5)).toBe('yellow');
    expect(nextColor(2)).toBe('green');
  });

  it('percebe o tipo pelo MIME ou, se faltar, pela extensão', () => {
    expect(mimeOf({ type: 'application/pdf', name: 'a' })).toBe('application/pdf');
    expect(mimeOf({ type: '', name: 'IMG_1.HEIC' })).toBe('image/heic');
    expect(mimeOf({ type: 'application/zip', name: 'a.zip' })).toBeNull();
  });

  it('valida o ficheiro', () => {
    expect(checkDoc({ size: 1000, type: 'application/pdf', name: 'a.pdf' })).toBe('ok');
    expect(checkDoc({ size: 0, type: 'application/pdf', name: 'a.pdf' })).toBe('empty');
    expect(checkDoc({ size: MAX_DOC_BYTES + 1, type: 'image/png', name: 'a.png' })).toBe('tooBig');
    expect(checkDoc({ size: 10, type: 'text/plain', name: 'a.txt' })).toBe('unsupported');
  });

  it('constrói o caminho no bucket', () => {
    expect(docPath('viagem', 'doc', 'application/pdf')).toBe('viagem/doc.pdf');
    expect(docPath('viagem', 'doc', 'image/jpeg')).toBe('viagem/doc.jpg');
  });

  it('tira a extensão ao nome e limita o tamanho', () => {
    expect(nameFromFile('Bilhete_Porto-Madrid.pdf')).toBe('Bilhete Porto-Madrid');
    expect(nameFromFile('.pdf')).toBe('.pdf'.slice(0, 120));
    expect(nameFromFile(`${'a'.repeat(300)}.pdf`)).toHaveLength(120);
  });

  it('formata o tamanho', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(180 * 1024)).toBe('180 KB');
    expect(formatSize(2.4 * 1024 * 1024)).toBe('2,4 MB');
  });
});
