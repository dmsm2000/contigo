// Lógica pura das viagens: sem Angular nem rede, para se testar facilmente.

export type Lang = 'pt' | 'es' | 'en';
export type WouldReturn = 'yes' | 'maybe' | 'no';
export type DatePrecision = 'month' | 'day';
export type TripStatus = 'past' | 'drawn' | 'planned' | 'prepared' | 'ongoing' | 'closed';

export interface Place {
  id: string;
  name: string;
  admin1: string | null;
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
  osmRef: string | null;
  /** O ficheiro da imagem do sítio no bucket "place-images" (se já foi buscar uma). */
  imagePath: string | null;
}

export interface Trip {
  id: string;
  placeId: string;
  status: TripStatus;
  startDate: string;
  endDate: string | null;
  datePrecision: DatePrecision;
  withPartner: boolean;
  wouldReturn: WouldReturn | null;
  costEur: number | null;
  note: string | null;
  /** Só nas viagens sorteadas: de onde saiu ('wish:<id>' ou 'suggestion:<id>'). */
  drawEntry: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  /** O teto da viagem em euros (para os dois), se já se decidiu. */
  budgetCapEur: number | null;
  /** Falso enquanto as datas estão em avaliação: a data da viagem é então só provisória. */
  datesConfirmed: boolean;
  /** Notas gerais do plano. */
  planNote: string | null;
  place: Place;
}

/** Como as linhas chegam do Supabase (nomes das colunas). */
export interface PlaceRow {
  id: string;
  name: string;
  admin1: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  osm_ref: string | null;
  image_path?: string | null;
}

export interface TripRow {
  id: string;
  place_id: string;
  status: TripStatus;
  start_date: string;
  end_date: string | null;
  date_precision: DatePrecision;
  with_partner: boolean;
  would_return: WouldReturn | null;
  cost_eur: number | string | null;
  note: string | null;
  draw_entry: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  budget_cap_eur?: number | string | null;
  dates_confirmed?: boolean;
  plan_note?: string | null;
  place: PlaceRow;
}

export const LOCALES: Record<Lang, string> = { pt: 'pt-PT', es: 'es-ES', en: 'en-GB' };

export function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    admin1: row.admin1,
    countryCode: row.country_code,
    lat: row.lat,
    lng: row.lng,
    osmRef: row.osm_ref,
    imagePath: row.image_path ?? null,
  };
}

export function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    placeId: row.place_id,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    datePrecision: row.date_precision,
    withPartner: row.with_partner,
    wouldReturn: row.would_return,
    // O Postgres devolve numeric como texto.
    costEur: row.cost_eur === null ? null : Number(row.cost_eur),
    note: row.note,
    drawEntry: row.draw_entry,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    budgetCapEur: row.budget_cap_eur === null || row.budget_cap_eur === undefined ? null : Number(row.budget_cap_eur),
    datesConfirmed: row.dates_confirmed ?? true,
    planNote: row.plan_note ?? null,
    place: toPlace(row.place),
  };
}

/** Viagens que já aconteceram (as outras ainda são planos): são as que contam como memórias e como sítios visitados. */
export function isDone(trip: Pick<Trip, 'status'>): boolean {
  return trip.status === 'past' || trip.status === 'closed';
}

/** O último dia da viagem; quando só se sabe o mês, o último dia desse mês. */
export function lastDayOf(trip: Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'>): string {
  if (trip.endDate) return trip.endDate;
  if (trip.datePrecision === 'day') return trip.startDate;
  const [year, month] = trip.startDate.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** Se a viagem ainda não acabou (hoje ainda conta). `today` é uma data como "2026-11-13". */
export function isUpcoming(trip: Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'>, today: string): boolean {
  return lastDayOf(trip) >= today;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** O primeiro dia do mês, que é como se guarda uma viagem em que só se sabe o mês. */
export function startDateFor(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}

export function isFutureMonth(year: number, month: number, now: Date = new Date()): boolean {
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

/** O mês anterior ao de hoje: é por onde a maioria das viagens já feitas começa. */
export function previousMonth(now: Date = new Date()): { year: number; month: number } {
  const month = now.getMonth() + 1;
  return month === 1 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: month - 1 };
}

export function yearOptions(now: Date = new Date(), span = 30): number[] {
  return Array.from({ length: span + 1 }, (_, index) => now.getFullYear() - index);
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export function monthName(month: number, lang: Lang): string {
  const name = new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
  return capitalize(name);
}

export function monthOptions(lang: Lang): { value: number; label: string }[] {
  return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: monthName(index + 1, lang) }));
}

function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "Outubro de 2026" quando só se sabe o mês; "5 de dezembro de 2026" (ou um intervalo) quando se sabe o dia. */
export function formatTripDate(trip: Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'>, lang: Lang): string {
  const locale = LOCALES[lang];
  const start = parseDay(trip.startDate);
  if (trip.datePrecision === 'month') {
    return capitalize(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start));
  }
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (!trip.endDate || trip.endDate === trip.startDate) return day.format(start);
  const end = parseDay(trip.endDate);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).formatRange(
    start,
    end,
  );
}

export function countryName(code: string | null, lang: Lang): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([LOCALES[lang]], { type: 'region' }).of(code) ?? null;
  } catch {
    return null;
  }
}

/** A linha por baixo do nome: "Braga, Portugal". */
export function placeSubtitle(place: Pick<Place, 'admin1' | 'countryCode'>, lang: Lang): string {
  const parts = [place.admin1, countryName(place.countryCode, lang)].filter((part): part is string => Boolean(part));
  return parts.filter((part, index) => parts.indexOf(part) === index).join(', ');
}

export function formatCost(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Lê um valor escrito à mão: vazio → null, "12,5" ou "1.234,50" ou "12.5" → número, lixo → 'invalid'.
 */
export function parseCost(input: string): number | null | 'invalid' {
  const text = input.replace(/[\s€]/g, '');
  if (!text) return null;
  if (!/^\d[\d.,]*$/.test(text)) return 'invalid';
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);
  const integerPart = (decimalAt === -1 ? text : text.slice(0, decimalAt)).replace(/[.,]/g, '');
  const decimalPart = decimalAt === -1 ? '' : text.slice(decimalAt + 1);
  // Um separador seguido de três dígitos, sem outro, é milhares ("1.234"), não decimais.
  const isThousands = decimalAt !== -1 && decimalPart.length === 3 && lastComma === -1 !== (lastDot === -1);
  const normalized = isThousands ? text.replace(/[.,]/g, '') : `${integerPart}${decimalPart ? '.' + decimalPart : ''}`;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value >= 10_000_000) return 'invalid';
  return Math.round(value * 100) / 100;
}

export interface YearStats {
  /** Sítios diferentes visitados no ano. */
  places: number;
  /** Para cada mês, se houve viagem. */
  months: boolean[];
}

export function yearStats(trips: Pick<Trip, 'placeId' | 'startDate'>[], year: number): YearStats {
  const months = Array.from({ length: 12 }, () => false);
  const places = new Set<string>();
  for (const trip of trips) {
    const [tripYear, tripMonth] = trip.startDate.split('-').map(Number);
    if (tripYear !== year) continue;
    months[tripMonth - 1] = true;
    places.add(trip.placeId);
  }
  return { places: places.size, months };
}

const TILE_COLORS: readonly [string, string][] = [
  ['#C2306F', '#EE5A62'],
  ['#EE5A62', '#F7A55A'],
  ['#8E1F52', '#C2306F'],
  ['#3FA864', '#8AD3A0'],
  ['#5B6CD6', '#9AA6F0'],
  ['#8E5BD6', '#C3A0F2'],
];

/** Duas cores sempre iguais para o mesmo sítio. Servem de capa até haver fotografias. */
export function tileColors(name: string): { from: string; to: string } {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const [from, to] = TILE_COLORS[hash % TILE_COLORS.length];
  return { from, to };
}

export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? '?';
  return first.toLocaleUpperCase();
}

/** As viagens pela data em que foram registadas, as mais recentes primeiro (é a ordem das histórias do Início). */
export function byRecentlyAdded<T extends Pick<Trip, 'createdAt'>>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface YearGroup<T> {
  year: string;
  trips: T[];
}

/** As viagens agrupadas por ano da viagem (não do registo): o ano mais recente primeiro, e dentro dele a viagem mais recente. */
export function groupByYear<T extends Pick<Trip, 'startDate' | 'createdAt'>>(trips: readonly T[]): YearGroup<T>[] {
  const sorted = [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  const groups: YearGroup<T>[] = [];
  for (const trip of sorted) {
    const year = trip.startDate.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.trips.push(trip);
    else groups.push({ year, trips: [trip] });
  }
  return groups;
}

/** Onde estamos em relação a uma viagem: ainda faltam dias, está a decorrer (dia X de N) ou já acabou. */
export type TripCountdown =
  | { phase: 'before'; days: number }
  | { phase: 'during'; day: number; total: number }
  | { phase: 'after' };

/** `today` e as datas da viagem são "AAAA-MM-DD". A viagem só de mês conta a partir do dia 1. */
export function tripCountdown(
  trip: Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'>,
  today: string,
): TripCountdown {
  const dayMs = 86_400_000;
  const toMs = (value: string) => parseDay(value).getTime();
  const days = Math.round((toMs(trip.startDate) - toMs(today)) / dayMs);
  if (days > 0) return { phase: 'before', days };
  const last = lastDayOf(trip);
  if (today > last) return { phase: 'after' };
  const total = Math.round((toMs(last) - toMs(trip.startDate)) / dayMs) + 1;
  return { phase: 'during', day: -days + 1, total };
}
