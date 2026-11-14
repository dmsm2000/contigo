// O plano de uma viagem: lógica pura, sem Angular nem rede, para se testar facilmente.
import { ExpenseCategory } from './expenses.logic';
import { Lang, LOCALES, Trip, TripStatus } from './trips.logic';

/** Os estados em que a viagem ainda está a ser pensada (não começou): sorteada ou criada à mão. */
export function isPlanning(status: TripStatus): boolean {
  return status === 'drawn' || status === 'planned';
}

/** Os estados de uma viagem que ainda não acabou (do sorteio até ao fecho). */
export function isLive(status: TripStatus): boolean {
  return status === 'drawn' || status === 'planned' || status === 'prepared' || status === 'ongoing';
}

/** Os passos do ciclo, pela ordem: o 1.º serve para as duas origens (sorteada ou criada à mão). */
export const STAGES = ['planning', 'prepared', 'ongoing', 'closed'] as const;
export type Stage = (typeof STAGES)[number];

export function stageOf(status: TripStatus): Stage | null {
  if (isPlanning(status)) return 'planning';
  if (status === 'prepared' || status === 'ongoing' || status === 'closed') return status;
  return null;
}

/** O estado a gravar quando se chega a um passo (a planear grava-se como "planned"). */
export function statusForStage(stage: Stage, current: TripStatus): TripStatus {
  if (stage === 'planning') return current === 'drawn' ? 'drawn' : 'planned';
  return stage;
}

// ---------------------------------------------------------------- datas em avaliação

export interface DateOption {
  id: string;
  tripId: string;
  startDate: string;
  endDate: string;
  note: string | null;
  preferred: boolean;
}

export interface DateOptionRow {
  id: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  preferred: boolean;
}

export function toDateOption(row: DateOptionRow): DateOption {
  return { id: row.id, tripId: row.trip_id, startDate: row.start_date, endDate: row.end_date, note: row.note, preferred: row.preferred };
}

/** Quantas noites tem uma viagem de `start` a `end` (de 2 a 4 de dezembro são 2). */
export function nightsBetween(start: string, end: string): number {
  const utc = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(0, Math.round((utc(end) - utc(start)) / 86_400_000));
}

/** "2 a 4 de dezembro" (no mesmo mês) ou "30 de novembro a 2 de dezembro". */
export function formatRange(start: string, end: string, lang: Lang): string {
  const locale = LOCALES[lang];
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (start === end) return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(a);
  const to = lang === 'en' ? 'to' : lang === 'es' ? 'al' : 'a';
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(a);
    const of = lang === 'en' ? '' : ' de';
    return lang === 'en'
      ? `${month} ${a.getDate()} ${to} ${b.getDate()}`
      : `${a.getDate()} ${to} ${b.getDate()}${of} ${month}`;
  }
  const part = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return `${part.format(a)} ${to} ${part.format(b)}`;
}

/** As datas de uma opção sobrepõem-se a um dia que já não se pode (ex.: "não posso a partir de 12 de dezembro")? */
export function endsAfter(option: Pick<DateOption, 'endDate'>, limit: string): boolean {
  return option.endDate >= limit;
}

// ---------------------------------------------------------------- alojamento

export interface Stay {
  id: string;
  tripId: string;
  name: string;
  priceEur: number | null;
  rating: number | null;
  note: string | null;
  link: string | null;
  chosen: boolean;
}

export interface StayRow {
  id: string;
  trip_id: string;
  name: string;
  price_eur: number | string | null;
  rating: number | string | null;
  note: string | null;
  link: string | null;
  chosen: boolean;
}

export function toStay(row: StayRow): Stay {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    priceEur: row.price_eur === null ? null : Number(row.price_eur),
    rating: row.rating === null ? null : Number(row.rating),
    note: row.note,
    link: row.link,
    chosen: row.chosen,
  };
}

/** Mais baratas primeiro; as que não têm preço no fim. */
export function sortStays(stays: readonly Stay[]): Stay[] {
  return [...stays].sort((a, b) => Number(b.chosen) - Number(a.chosen) || (a.priceEur ?? Infinity) - (b.priceEur ?? Infinity) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- como chegar

export const LEG_MODES = ['car', 'train', 'bus', 'flight', 'other'] as const;
export type LegMode = (typeof LEG_MODES)[number];

export interface Leg {
  id: string;
  tripId: string;
  origin: string;
  mode: LegMode;
  minutes: number | null;
  priceEur: number | null;
  note: string | null;
  /** A deslocação escolhida desta origem (as outras da mesma origem são alternativas). */
  chosen: boolean;
}

export interface LegRow {
  id: string;
  trip_id: string;
  origin: string;
  mode: LegMode;
  minutes: number | null;
  price_eur: number | string | null;
  note: string | null;
  chosen: boolean;
}

export function toLeg(row: LegRow): Leg {
  return {
    id: row.id,
    tripId: row.trip_id,
    origin: row.origin,
    mode: row.mode,
    minutes: row.minutes,
    priceEur: row.price_eur === null ? null : Number(row.price_eur),
    note: row.note,
    chosen: row.chosen,
  };
}

/** "3h30", "1h37", "45 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/** Lê "3h30", "3:30", "3,5" (horas) ou "45" (minutos) em minutos; 'invalid' se não se perceber. */
export function parseDuration(input: string): number | null | 'invalid' {
  const text = input.trim().toLowerCase().replace(',', '.');
  if (!text) return null;
  let match = /^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*(?:m|min)?$/.exec(text);
  if (match) {
    const minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
    return minutes <= 6000 ? minutes : 'invalid';
  }
  match = /^(\d{1,2}(?:\.\d+)?)\s*h$/.exec(text);
  if (match) return Math.round(Number(match[1]) * 60);
  match = /^(\d{1,4})\s*(?:m|min)?$/.exec(text);
  if (match) return Number(match[1]) <= 6000 ? Number(match[1]) : 'invalid';
  return 'invalid';
}

// ---------------------------------------------------------------- orçamento

export interface BudgetLine {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  amountEur: number;
}

export interface BudgetLineRow {
  id: string;
  trip_id: string;
  category: ExpenseCategory;
  amount_eur: number | string;
}

export function toBudgetLine(row: BudgetLineRow): BudgetLine {
  return { id: row.id, tripId: row.trip_id, category: row.category, amountEur: Number(row.amount_eur) };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Quantas pessoas vão (o orçamento escreve-se por pessoa). */
export function travellers(trip: Pick<Trip, 'withPartner'>): number {
  return trip.withPartner ? 2 : 1;
}

/** A estimativa por pessoa e a dos dois juntos. */
export function budgetTotals(lines: readonly Pick<BudgetLine, 'amountEur'>[], people: number): { perPerson: number; total: number } {
  const perPerson = round2(lines.reduce((sum, line) => sum + line.amountEur, 0));
  return { perPerson, total: round2(perPerson * people) };
}

/**
 * Uma estimativa de partida a partir do que já se sabe: o alojamento escolhido dividido pelas pessoas e as deslocações
 * (cada origem é uma pessoa: a média das origens, com a forma mais barata de cada uma). O resto fica por preencher.
 */
export function suggestBudget(stay: Pick<Stay, 'priceEur'> | null, legs: readonly Pick<Leg, 'origin' | 'priceEur'>[], people: number): Partial<Record<ExpenseCategory, number>> {
  const out: Partial<Record<ExpenseCategory, number>> = {};
  if (stay?.priceEur) out['stay'] = round2(stay.priceEur / people);
  // Cada origem é uma pessoa, e as várias formas de chegar dessa origem são alternativas: conta a mais barata.
  const cheapest = new Map<string, number>();
  for (const leg of legs) {
    if (leg.priceEur === null) continue;
    const key = leg.origin.trim().toLowerCase();
    cheapest.set(key, Math.min(cheapest.get(key) ?? Infinity, leg.priceEur));
  }
  if (cheapest.size) out['transport'] = round2([...cheapest.values()].reduce((sum, price) => sum + price, 0) / cheapest.size);
  return out;
}

/** Quanto falta (ou sobra) entre o teto e o que se estima/gasta: positivo é folga. */
export function headroom(cap: number | null, amount: number): number | null {
  return cap === null ? null : round2(cap - amount);
}

// ---------------------------------------------------------------- lista

export const CHECKLIST_KINDS = ['see', 'do', 'eat', 'todo'] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export interface ChecklistItem {
  id: string;
  tripId: string;
  kind: ChecklistKind;
  text: string;
  done: boolean;
}

export interface ChecklistRow {
  id: string;
  trip_id: string;
  kind: ChecklistKind;
  text: string;
  done: boolean;
}

export function toChecklistItem(row: ChecklistRow): ChecklistItem {
  return { id: row.id, tripId: row.trip_id, kind: row.kind, text: row.text, done: row.done };
}

/** Os que faltam primeiro, pela ordem em que foram escritos. */
export function openFirst(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done));
}

// ---------------------------------------------------------------- ciclo

export interface PlanApproval {
  tripId: string;
  userId: string;
}

export interface PlanApprovalRow {
  trip_id: string;
  user_id: string;
}

export function toPlanApproval(row: PlanApprovalRow): PlanApproval {
  return { tripId: row.trip_id, userId: row.user_id };
}

/** As origens que têm deslocações: cada uma precisa de uma escolhida. */
function originsOf(legs: readonly Pick<Leg, 'origin'>[]): string[] {
  return [...new Set(legs.map((leg) => leg.origin.trim().toLowerCase()))];
}

/** A deslocação está decidida quando há pelo menos uma escolhida e cada origem tem a sua. */
export function transportDecided(legs: readonly Pick<Leg, 'origin' | 'chosen'>[]): boolean {
  if (!legs.some((leg) => leg.chosen)) return false;
  return originsOf(legs).every((origin) => legs.some((leg) => leg.chosen && leg.origin.trim().toLowerCase() === origin));
}

export type Requirement = 'dates' | 'stay' | 'transport' | 'approval';

export interface PlanReadiness {
  dates: boolean;
  stay: boolean;
  transport: boolean;
  /** Quem já aprovou e quem falta, entre as pessoas que vão. */
  approvedBy: string[];
  waitingFor: string[];
  /** As 3 decisões estão tomadas e todos aprovaram. */
  ready: boolean;
  /** O que ainda impede, pela ordem em que se resolve (a aprovação só conta depois das 3 decisões). */
  missing: Requirement[];
}

/**
 * Uma viagem só passa a "preparada" com as 3 decisões tomadas (datas confirmadas, alojamento escolhido, deslocação
 * escolhida) e a aprovação dos dois. O resto do plano pode ficar vazio. A base de dados aplica a mesma regra.
 */
export function planReadiness(input: {
  datesConfirmed: boolean;
  stays: readonly Pick<Stay, 'chosen'>[];
  legs: readonly Pick<Leg, 'origin' | 'chosen'>[];
  approvals: readonly Pick<PlanApproval, 'userId'>[];
  travellerIds: readonly string[];
}): PlanReadiness {
  const dates = input.datesConfirmed;
  const stay = input.stays.some((item) => item.chosen);
  const transport = transportDecided(input.legs);
  const approvedBy = input.travellerIds.filter((id) => input.approvals.some((approval) => approval.userId === id));
  const waitingFor = input.travellerIds.filter((id) => !approvedBy.includes(id));
  const missing: Requirement[] = [];
  if (!dates) missing.push('dates');
  if (!stay) missing.push('stay');
  if (!transport) missing.push('transport');
  if (waitingFor.length) missing.push('approval');
  return { dates, stay, transport, approvedBy, waitingFor, ready: missing.length === 0, missing };
}

/** O passo seguinte do ciclo, ou nulo se já está fechada. */
export function nextStage(stage: Stage): Stage | null {
  const index = STAGES.indexOf(stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null;
}
