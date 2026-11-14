// "Quem mexeu e quando": lógica pura, sem Angular nem rede, para se testar facilmente.
import { Lang, LOCALES } from './trips.logic';

export interface AuditInput {
  createdBy: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface AuditLine {
  by: string | null;
  at: string;
}

export interface Audit {
  created: AuditLine;
  /** Só existe quando a alteração veio bem depois da criação (mais de um minuto). */
  updated: AuditLine | null;
}

/** Margem para uma correção logo a seguir a criar não contar como "atualizado". */
const SAME_MOMENT_MS = 60_000;

export function describeAudit(input: AuditInput): Audit {
  const created: AuditLine = { by: input.createdBy, at: input.createdAt };
  const updatedAt = input.updatedAt ?? null;
  // Sem autor da alteração não há "atualizado por": é o caso das linhas anteriores a esta funcionalidade.
  if (!updatedAt || !input.updatedBy) return { created, updated: null };
  const gap = new Date(updatedAt).getTime() - new Date(input.createdAt).getTime();
  if (!(gap > SAME_MOMENT_MS)) return { created, updated: null };
  return { created, updated: { by: input.updatedBy ?? null, at: updatedAt } };
}

/** "há 3 dias", "ontem", "agora mesmo": pela unidade mais grossa que ainda dá pelo menos 1. */
export function relativeTime(iso: string, lang: Lang, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 45) return format.format(0, 'second');
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2_592_000],
    ['year', 31_536_000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) {
    if (abs >= unit[1]) chosen = unit;
  }
  return format.format(Math.round(seconds / chosen[1]), chosen[0]);
}

export interface Change {
  by: string | null;
  at: string;
}

/** A alteração mais recente entre várias listas: cada item conta pela última alteração, ou pela criação se nunca mudou. */
export function latestChange(items: readonly { by: string | null; at: string | null | undefined }[]): Change | null {
  let best: Change | null = null;
  for (const item of items) {
    if (!item.at) continue;
    if (!best || new Date(item.at).getTime() > new Date(best.at).getTime()) best = { by: item.by, at: item.at };
  }
  return best;
}
