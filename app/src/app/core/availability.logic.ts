// Lógica pura da disponibilidade: sem Angular nem rede, para se testar facilmente.
// Os dias são datas locais em texto ("2026-11-14"), sem fuso: as janelas em comum calculam-se por dia.
import { MinStay } from './suggestions';
import { Lang, LOCALES } from './trips.logic';

export type ShiftKind = 'busy' | 'free';
export type ShiftTone = 'morning' | 'afternoon' | 'middle';

export const SHIFT_TONES: readonly ShiftTone[] = ['morning', 'afternoon', 'middle'];

export interface ShiftTypeRow {
  id: string;
  user_id: string;
  name: string;
  kind: ShiftKind;
  starts_at: string | null;
  ends_at: string | null;
  tone: ShiftTone;
}

export interface ShiftType {
  id: string;
  userId: string;
  name: string;
  kind: ShiftKind;
  /** "07:00", ou nulo se o tipo não tem horas. */
  startsAt: string | null;
  endsAt: string | null;
  tone: ShiftTone;
}

export interface DayMarkRow {
  user_id: string;
  day: string;
  shift_type_id: string;
}

export interface DayMark {
  userId: string;
  day: string;
  shiftTypeId: string;
}

/** O Postgres devolve "07:00:00"; a app só precisa de "07:00". */
const toClock = (time: string | null): string | null => (time ? time.slice(0, 5) : null);

export function toShiftType(row: ShiftTypeRow): ShiftType {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    startsAt: toClock(row.starts_at),
    endsAt: toClock(row.ends_at),
    tone: row.tone,
  };
}

export function toDayMark(row: DayMarkRow): DayMark {
  return { userId: row.user_id, day: row.day, shiftTypeId: row.shift_type_id };
}

/** Só aceita horas como "07:00" ou "7:5"; devolve "07:00" ou nulo. */
export function normalizeClock(input: string): string | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ---- Datas ----------------------------------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, '0');

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Hoje, na hora local de quem está a usar a app. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/** Soma (ou tira) dias. Usa UTC por dentro, para as mudanças de hora não estragarem nada. */
export function addDays(iso: string, count: number): string {
  const { year, month, day } = parseIso(iso);
  const moved = new Date(Date.UTC(year, month - 1, day + count));
  return toIso(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate());
}

/** 0 = segunda … 6 = domingo. */
export function weekday(iso: string): number {
  const { year, month, day } = parseIso(iso);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Todos os dias de `a` a `b`, inclusive, pela ordem do calendário, venham como vierem. Máximo de 366. */
export function rangeDays(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 366; day = addDays(day, 1)) days.push(day);
  return days;
}

export interface GridDay {
  iso: string;
  day: number;
  /** Se é do mês que se está a ver (os outros só completam as semanas). */
  inMonth: boolean;
}

/** As semanas de um mês (`month` de 1 a 12), a começar na segunda-feira. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = toIso(year, month, 1);
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = weekday(first);
  const weeks = Math.ceil((offset + length) / 7);
  const start = addDays(first, -offset);
  const grid: GridDay[][] = [];
  for (let week = 0; week < weeks; week++) {
    const row: GridDay[] = [];
    for (let column = 0; column < 7; column++) {
      const iso = addDays(start, week * 7 + column);
      const { month: m, day } = parseIso(iso);
      row.push({ iso, day, inMonth: m === month });
    }
    grid.push(row);
  }
  return grid;
}

/** O mês seguinte (ou anterior, com `step` -1), com a mudança de ano. */
export function shiftMonth(year: number, month: number, step: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + step;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// ---- Marcações e janelas --------------------------------------------------------------------------------------

/** Os dias que uma pessoa marcou, com o tipo de cada um. */
export function markedDays(marks: readonly DayMark[], userId: string | null): Map<string, string> {
  const days = new Map<string, string>();
  if (!userId) return days;
  for (const mark of marks) if (mark.userId === userId) days.set(mark.day, mark.shiftTypeId);
  return days;
}

/** Os dias em que a pessoa está livre (marcou um tipo "livre"). Os dias por marcar não contam. */
export function freeDays(marks: readonly DayMark[], types: readonly ShiftType[], userId: string | null): Set<string> {
  const freeTypes = new Set(types.filter((type) => type.kind === 'free').map((type) => type.id));
  const free = new Set<string>();
  for (const [day, typeId] of markedDays(marks, userId)) if (freeTypes.has(typeId)) free.add(day);
  return free;
}

export interface FreeWindow {
  start: string;
  end: string;
  days: number;
}

/** Os blocos de dias seguidos em que os dois estão livres, a partir de `from` (inclusive). */
export function commonWindows(a: ReadonlySet<string>, b: ReadonlySet<string>, from: string): FreeWindow[] {
  const shared = [...a].filter((day) => day >= from && b.has(day)).sort();
  const windows: FreeWindow[] = [];
  for (const day of shared) {
    const last = windows[windows.length - 1];
    if (last && addDays(last.end, 1) === day) {
      last.end = day;
      last.days += 1;
    } else {
      windows.push({ start: day, end: day, days: 1 });
    }
  }
  return windows;
}

/** Um dia, um fim-de-semana (2 dias) ou uma viagem mais longa (3 ou mais). */
export function windowKind(days: number): MinStay {
  return days >= 3 ? 'long' : days === 2 ? 'weekend' : 'day';
}

/** Se um sítio com esta duração mínima cabe numa janela com estes dias. Sem duração mínima, cabe sempre. */
export function fitsWindow(minStay: MinStay | null, days: number): boolean {
  if (minStay === 'long') return days >= 3;
  if (minStay === 'weekend') return days >= 2;
  return days >= 1;
}

/** A janela que vem a seguir: a primeira que ainda não acabou. */
export function nextWindow(windows: readonly FreeWindow[], today: string): FreeWindow | null {
  return windows.find((window) => window.end >= today) ?? null;
}

// ---- Textos de datas ------------------------------------------------------------------------------------------

const asDate = (iso: string) => {
  const { year, month, day } = parseIso(iso);
  return new Date(Date.UTC(year, month - 1, day));
};

/** "17 de novembro", "21–22 de novembro" ou "30 de novembro – 2 de dezembro", na língua da app. */
export function formatWindow(window: Pick<FreeWindow, 'start' | 'end'>, lang: Lang): string {
  const format = new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return window.start === window.end ? format.format(asDate(window.start)) : format.formatRange(asDate(window.start), asDate(window.end));
}

/** Os dias da semana de uma janela: "terça-feira", "sábado e domingo" ou "sábado – segunda-feira". */
export function formatWeekdays(window: Pick<FreeWindow, 'start' | 'end'>, lang: Lang): string {
  const format = new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', timeZone: 'UTC' });
  if (window.start === window.end) return format.format(asDate(window.start));
  if (addDays(window.start, 1) === window.end) {
    return new Intl.ListFormat(LOCALES[lang], { type: 'conjunction' }).format([
      format.format(asDate(window.start)),
      format.format(asDate(window.end)),
    ]);
  }
  return format.formatRange(asDate(window.start), asDate(window.end));
}

/** "novembro de 2026". */
export function monthTitle(year: number, month: number, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Os nomes curtos dos dias da semana, a começar na segunda-feira. */
export function weekdayNames(lang: Lang): string[] {
  const formatter = new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'narrow', timeZone: 'UTC' });
  // 9 de novembro de 2026 é uma segunda-feira.
  return Array.from({ length: 7 }, (_, index) => formatter.format(asDate(addDays('2026-11-09', index))));
}

/** Escreve uma hora ("07:00") sem o zero à frente, como se diz ("7:00"). */
export function shortClock(clock: string): string {
  return clock.replace(/^0/, '');
}
