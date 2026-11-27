// Lógica pura das despesas e da cebola: sem Angular nem rede, para se testar facilmente.
import type { Deposit } from './deposits.logic';

export type ExpenseCategory = 'transport' | 'stay' | 'food' | 'activities' | 'other';

/** Pela ordem em que se mostram nos botões. */
export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = ['transport', 'stay', 'food', 'activities', 'other'];

export const MAX_EXPENSE = 100_000;
export const MAX_EXPENSE_NOTE = 200;
/** A dotação mensal que cada um põe, por defeito. */
export const DEFAULT_ALLOWANCE = 200;

export interface ExpenseRow {
  id: string;
  trip_id: string;
  user_id: string | null;
  amount_eur: number | string;
  category: ExpenseCategory;
  note: string | null;
  spent_on: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Expense {
  id: string;
  tripId: string;
  userId: string | null;
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  /** O dia em que se gastou: "2026-11-14". */
  spentOn: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  /** Só nas despesas registadas sem rede: ainda por enviar, ou recusada pelo servidor. As outras não têm. */
  sync?: 'pending' | 'failed';
}

/**
 * Uma despesa registada sem rede, à espera de ser enviada. O `id` nasce no telemóvel: se o envio se repetir (a rede
 * caiu depois de o servidor a receber), o servidor reconhece-o e não a duplica.
 */
export interface PendingExpense {
  id: string;
  tripId: string;
  userId: string;
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  spentOn: string;
  /** Quando foi registada, no telemóvel. */
  createdAt: string;
  /** O servidor recusou-a (por exemplo, a viagem já não existe): não se volta a tentar até a pessoa a corrigir ou apagar. */
  failed?: boolean;
}

export function pendingToExpense(pending: PendingExpense): Expense {
  return {
    id: pending.id,
    tripId: pending.tripId,
    userId: pending.userId,
    amount: pending.amount,
    category: pending.category,
    note: pending.note,
    spentOn: pending.spentOn,
    createdAt: pending.createdAt,
    updatedAt: pending.createdAt,
    updatedBy: null,
    sync: pending.failed ? 'failed' : 'pending',
  };
}

/** As despesas do servidor mais as que ainda não foram enviadas (uma já enviada, mas ainda na fila, não conta duas vezes). */
export function withPending(server: readonly Expense[], pending: readonly PendingExpense[]): Expense[] {
  const known = new Set(server.map((expense) => expense.id));
  return [...server, ...pending.filter((item) => !known.has(item.id)).map(pendingToExpense)];
}

/** Não houve resposta do servidor (sem rede, ou fora do ar): vale a pena tentar mais tarde. Uma recusa não é isto. */
export function isUnreachable(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    // O Postgres devolve os numeric como texto.
    amount: Number(row.amount_eur),
    category: row.category,
    note: row.note,
    spentOn: row.spent_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/**
 * Lê um valor escrito à mão: aceita "12,5", "12.50" e "12 €". Devolve o número com duas casas, ou 'invalid' se não
 * for um valor positivo até ao limite.
 */
export function parseAmount(input: string): number | 'invalid' {
  const text = input.replace(/[€\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid';
  const value = Math.round(Number(text) * 100) / 100;
  return value > 0 && value <= MAX_EXPENSE ? value : 'invalid';
}

/** A nota: sem espaços nas pontas; vazia vira nula; 'tooLong' se passar do limite. */
export function cleanExpenseNote(input: string): string | null | 'tooLong' {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > MAX_EXPENSE_NOTE ? 'tooLong' : text;
}

export function totalOf(expenses: readonly Pick<Expense, 'amount'>[]): number {
  return roundCents(expenses.reduce((sum, expense) => sum + expense.amount, 0));
}

export function totalsByTrip(expenses: readonly Expense[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(expense.tripId, roundCents((totals.get(expense.tripId) ?? 0) + expense.amount));
  return totals;
}

/** O total de cada categoria, da maior para a mais pequena (só as que têm gastos). */
export function totalsByCategory(expenses: readonly Expense[]): { category: ExpenseCategory; total: number }[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const expense of expenses) totals.set(expense.category, roundCents((totals.get(expense.category) ?? 0) + expense.amount));
  return [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

/** Os mais recentes primeiro: pelo dia do gasto e, no mesmo dia, pelo registo. */
export function newestFirst(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
}

/** Quantos meses há de "2026-09" até "2026-11", contando os dois (3). */
export function monthsInclusive(fromMonth: string, toMonth: string): number {
  const [fromYear, from] = fromMonth.split('-').map(Number);
  const [toYear, to] = toMonth.split('-').map(Number);
  return Math.max(0, (toYear - fromYear) * 12 + (to - from) + 1);
}

/** O que entra num mês: um valor fixo, ou uma função do mês ("2026-11") quando as dotações mudaram ao longo do tempo. */
export type Income = number | ((month: string) => number);

function incomeOf(income: Income, month: string): number {
  return typeof income === 'number' ? income : income(month);
}

export interface AllowanceChange {
  userId: string;
  /** "2026-11": vale a partir deste mês. "2000-01" é a dotação desde sempre. */
  month: string;
  amount: number;
}

/**
 * O que os dois põem num mês: para cada pessoa, a dotação da mudança mais recente até esse mês (a de antes da primeira
 * mudança é a primeira que se conhece), somadas. Sem histórico, devolve `fallback` (a dotação de hoje).
 */
export function monthlyIncome(history: readonly AllowanceChange[], userIds: readonly string[], month: string, fallback: number): number {
  if (!history.length) return fallback;
  let total = 0;
  for (const userId of userIds) {
    const own = history.filter((change) => change.userId === userId).sort((a, b) => a.month.localeCompare(b.month));
    if (!own.length) continue;
    const applicable = own.filter((change) => change.month <= month);
    total += (applicable.length ? applicable[applicable.length - 1] : own[0]).amount;
  }
  return roundCents(total);
}

export interface Cebola {
  /** A cebola: tudo o que têm para gastar agora. O que sobrou dos meses fechados, mais o que entrou este mês (dotações e depósitos), menos o que já se gastou. Pode ser negativa. */
  amount: number;
  /** O que sobrou dos meses que já acabaram e passou para este (pode ser negativo). */
  carried: number;
  /** O mês em que começou a contar ("2026-09"), ou nulo se ainda não há gastos nem depósitos. */
  since: string | null;
  /** Quantos meses já fechados entram na conta. */
  months: number;
  /** O que entra por mês (a soma das dotações dos dois). */
  monthly: number;
  /** O que se depositou este mês, além da dotação. */
  depositsThisMonth: number;
  /** O que já se gastou neste mês. */
  spentThisMonth: number;
  /** O mesmo que `amount`: o que se pode gastar ainda (a cebola é o que há para gastar). */
  available: number;
}

const monthOf = (day: string): string => day.slice(0, 7);

/** Soma por mês ("2026-11") de uma lista de valores com dia. */
function sumByMonth<T>(items: readonly T[], dayOf: (item: T) => string, amountOf: (item: T) => number): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const item of items) byMonth.set(monthOf(dayOf(item)), (byMonth.get(monthOf(dayOf(item))) ?? 0) + amountOf(item));
  return byMonth;
}

/** O primeiro mês de que a app sabe alguma coisa (um gasto ou um depósito); antes disso não inventa. */
function firstMonth(expenses: readonly Expense[], deposits: readonly { madeOn: string }[]): string | null {
  const months = [...expenses.map((item) => monthOf(item.spentOn)), ...deposits.map((item) => monthOf(item.madeOn))].sort();
  return months[0] ?? null;
}

/**
 * A cebola: o dinheiro dos dois, a crescer. Cada mês entra a dotação dos dois e o que depositarem, gasta-se, e o que
 * sobra (ou falta) passa ao mês seguinte. O que entra este mês conta logo: pôr dinheiro faz a cebola subir no mesmo
 * instante. Conta a partir do mês do primeiro gasto ou depósito (antes disso a app não sabe o que se passou).
 */
export function cebola(expenses: readonly Expense[], income: Income, today: string, deposits: readonly Deposit[] = []): Cebola {
  const thisMonth = monthOf(today);
  const monthly = incomeOf(income, thisMonth);
  // Um depósito marcado para depois de hoje só conta quando chegar o dia.
  const made = deposits.filter((deposit) => deposit.madeOn <= today);
  const spentByMonth = sumByMonth(expenses, (item) => item.spentOn, (item) => item.amount);
  const depositedByMonth = sumByMonth(made, (item) => item.madeOn, (item) => item.amount);
  const spentThisMonth = roundCents(spentByMonth.get(thisMonth) ?? 0);
  const depositsThisMonth = roundCents(depositedByMonth.get(thisMonth) ?? 0);

  const since = firstMonth(expenses, made);
  // Só os meses que já fecharam: do primeiro ao mês antes de hoje.
  const closedMonths = since ? Math.max(0, monthsInclusive(since, thisMonth) - 1) : 0;
  let carried = 0;
  for (let index = 0; since && index < closedMonths; index++) {
    const month = addMonth(since, index);
    carried += incomeOf(income, month) + (depositedByMonth.get(month) ?? 0) - (spentByMonth.get(month) ?? 0);
  }
  carried = roundCents(carried);
  const amount = roundCents(carried + monthly + depositsThisMonth - spentThisMonth);
  return { amount, carried, since, months: closedMonths, monthly, depositsThisMonth, spentThisMonth, available: amount };
}

/** "2026-11" + 2 = "2027-01". */
function addMonth(month: string, count: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface LedgerMonth {
  /** "2026-11". */
  month: string;
  /** O que entrou neste mês: as dotações dos dois. */
  income: number;
  /** O que se depositou neste mês, além das dotações. */
  deposits: number;
  /** O que se gastou neste mês. */
  spent: number;
  /** A cebola que vinha de trás quando o mês começou. */
  carried: number;
  /** O que ficou no fim do mês (ou o que há agora, se for o mês de hoje): a cebola que passa ao seguinte. */
  balance: number;
  /** É o mês de hoje (ainda a decorrer). */
  current: boolean;
}

/**
 * O dinheiro dos dois mês a mês, do primeiro gasto ou depósito até hoje, com o mais recente primeiro. Cada mês recebe
 * a dotação dos dois e os depósitos, gasta-se, e o que sobra (ou falta) passa ao mês seguinte: é a cebola a crescer.
 */
export function monthlyLedger(expenses: readonly Expense[], income: Income, today: string, deposits: readonly Deposit[] = []): LedgerMonth[] {
  const thisMonth = monthOf(today);
  const made = deposits.filter((deposit) => deposit.madeOn <= today);
  const since = firstMonth(expenses, made);
  if (!since) return [];
  const spentByMonth = sumByMonth(expenses, (item) => item.spentOn, (item) => item.amount);
  const depositedByMonth = sumByMonth(made, (item) => item.madeOn, (item) => item.amount);
  const rows: LedgerMonth[] = [];
  let carried = 0;
  const count = monthsInclusive(since, thisMonth);
  for (let index = 0; index < count; index++) {
    const month = addMonth(since, index);
    const spent = roundCents(spentByMonth.get(month) ?? 0);
    const entered = incomeOf(income, month);
    const deposited = roundCents(depositedByMonth.get(month) ?? 0);
    const balance = roundCents(carried + entered + deposited - spent);
    rows.push({ month, income: entered, deposits: deposited, spent, carried, balance, current: month === thisMonth });
    carried = balance;
  }
  return rows.reverse();
}

/** Quanto cada pessoa gastou (quem registou a despesa) num mês ("2026-11"); sem mês, no total. */
export function spentByPerson(expenses: readonly Expense[], month?: string): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const expense of expenses) {
    if (month && !expense.spentOn.startsWith(month)) continue;
    totals.set(expense.userId, roundCents((totals.get(expense.userId) ?? 0) + expense.amount));
  }
  return totals;
}
