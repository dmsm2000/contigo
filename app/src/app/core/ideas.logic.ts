// Lógica pura da lista de ideias: sem Angular nem rede, para se testar facilmente.
import { Lang, LOCALES } from './trips.logic';

/** open: por ver · planned: vamos fazer · done: feita. */
export type IdeaStatus = 'open' | 'planned' | 'done';

/** Pela ordem em que se mostram: o que está por ver primeiro, o que já está feito no fim. */
export const IDEA_STATUSES: readonly IdeaStatus[] = ['open', 'planned', 'done'];

export const MAX_IDEA_LENGTH = 500;

export interface IdeaRow {
  id: string;
  user_id: string;
  body: string;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Idea {
  id: string;
  userId: string;
  body: string;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export function toIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/**
 * Prepara o texto de uma ideia: tira espaços nas pontas, uniformiza as quebras de linha e não deixa mais do que
 * uma linha em branco seguida. Devolve 'empty' se não sobrar nada e 'tooLong' se passar do limite.
 */
export function cleanIdeaText(input: string): string | 'empty' | 'tooLong' {
  const text = input
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return 'empty';
  return text.length > MAX_IDEA_LENGTH ? 'tooLong' : text;
}

/** O que está por ver primeiro; dentro de cada estado, as mais recentes primeiro. */
export function sortIdeas(ideas: readonly Idea[]): Idea[] {
  return [...ideas].sort(
    (a, b) =>
      IDEA_STATUSES.indexOf(a.status) - IDEA_STATUSES.indexOf(b.status) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export function countByStatus(ideas: readonly Idea[]): Record<IdeaStatus, number> {
  const counts: Record<IdeaStatus, number> = { open: 0, planned: 0, done: 0 };
  for (const idea of ideas) counts[idea.status] += 1;
  return counts;
}

export type IdeaFilter = IdeaStatus | 'all';

export function filterIdeas(ideas: readonly Idea[], filter: IdeaFilter): Idea[] {
  return filter === 'all' ? [...ideas] : ideas.filter((idea) => idea.status === filter);
}

/** "13 nov": o dia e o mês, na hora local e na língua da app. */
export function formatIdeaDate(createdAt: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short' }).format(new Date(createdAt));
}
