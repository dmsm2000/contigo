import { describe, expect, it } from 'vitest';
import {
  cleanIdeaText,
  countByStatus,
  filterIdeas,
  formatIdeaDate,
  Idea,
  MAX_IDEA_LENGTH,
  sortIdeas,
  toIdea,
} from './ideas.logic';

const idea = (id: string, status: Idea['status'], createdAt: string): Idea => ({
  id,
  userId: 'u1',
  body: `ideia ${id}`,
  status,
  createdAt,
  updatedAt: createdAt,
  updatedBy: null,
});

describe('cleanIdeaText', () => {
  it('tira os espaços das pontas', () => {
    expect(cleanIdeaText('  Uma ideia  ')).toBe('Uma ideia');
  });

  it('um texto vazio ou só de espaços é recusado', () => {
    expect(cleanIdeaText('')).toBe('empty');
    expect(cleanIdeaText('  \n \t ')).toBe('empty');
  });

  it('uniformiza as quebras de linha e limita as linhas em branco', () => {
    expect(cleanIdeaText('a\r\nb')).toBe('a\nb');
    expect(cleanIdeaText('a\n\n\n\n\nb')).toBe('a\n\nb');
    expect(cleanIdeaText('a   \nb')).toBe('a\nb');
  });

  it('aceita o limite e recusa o que passa dele', () => {
    expect(cleanIdeaText('x'.repeat(MAX_IDEA_LENGTH))).toBe('x'.repeat(MAX_IDEA_LENGTH));
    expect(cleanIdeaText('x'.repeat(MAX_IDEA_LENGTH + 1))).toBe('tooLong');
  });
});

describe('sortIdeas', () => {
  it('põe o que está por ver primeiro e o que está feito no fim, com as mais recentes primeiro', () => {
    const sorted = sortIdeas([
      idea('feita', 'done', '2026-11-13T10:00:00Z'),
      idea('velha', 'open', '2026-11-01T10:00:00Z'),
      idea('plano', 'planned', '2026-11-12T10:00:00Z'),
      idea('nova', 'open', '2026-11-12T10:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['nova', 'velha', 'plano', 'feita']);
  });

  it('não mexe na lista original', () => {
    const original = [idea('a', 'done', '2026-11-01T00:00:00Z'), idea('b', 'open', '2026-11-02T00:00:00Z')];
    sortIdeas(original);
    expect(original.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('countByStatus e filterIdeas', () => {
  const ideas = [idea('1', 'open', '2026-11-01T00:00:00Z'), idea('2', 'open', '2026-11-02T00:00:00Z'), idea('3', 'done', '2026-11-03T00:00:00Z')];

  it('conta por estado, também os que não têm nenhuma', () => {
    expect(countByStatus(ideas)).toEqual({ open: 2, planned: 0, done: 1 });
    expect(countByStatus([])).toEqual({ open: 0, planned: 0, done: 0 });
  });

  it('filtra por estado, ou devolve tudo', () => {
    expect(filterIdeas(ideas, 'open').map((i) => i.id)).toEqual(['1', '2']);
    expect(filterIdeas(ideas, 'planned')).toEqual([]);
    expect(filterIdeas(ideas, 'all')).toHaveLength(3);
  });
});

describe('toIdea e formatIdeaDate', () => {
  it('traduz a linha da base de dados', () => {
    expect(
      toIdea({ id: 'i', user_id: 'u', body: 'Texto', status: 'planned', created_at: '2026-11-13T10:00:00Z', updated_at: '2026-11-14T10:00:00Z', updated_by: 'v' }),
    ).toEqual({ id: 'i', userId: 'u', body: 'Texto', status: 'planned', createdAt: '2026-11-13T10:00:00Z', updatedAt: '2026-11-14T10:00:00Z', updatedBy: 'v' });
  });

  it('escreve o dia e o mês', () => {
    const text = formatIdeaDate('2026-11-13T12:00:00Z', 'pt');
    expect(text).toContain('13');
    // Conforme a língua, o mês vem por extenso abreviado ("nov") ou em número ("13/11").
    expect(/nov|11/i.test(text)).toBe(true);
  });
});
