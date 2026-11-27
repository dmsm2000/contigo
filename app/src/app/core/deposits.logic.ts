// Depósitos na cebola: dinheiro que um dos dois mete de uma vez, além da dotação mensal.
import { parseAmount } from './expenses.logic';

export const DEPOSIT_NOTE_MAX = 120;

export interface Deposit {
  id: string;
  /** Em euros, sempre positivo. */
  amount: number;
  /** O dia em que se meteu ("2026-11-27"): conta para o mês desse dia. */
  madeOn: string;
  note: string | null;
  userId: string | null;
  createdAt: string;
}

export interface DepositRow {
  id: string;
  amount: number | string;
  made_on: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export function toDeposit(row: DepositRow): Deposit {
  return { id: row.id, amount: Number(row.amount), madeOn: row.made_on, note: row.note, userId: row.created_by, createdAt: row.created_at };
}

/** Os depósitos, do mais recente para o mais antigo. */
export function newestDepositsFirst(deposits: readonly Deposit[]): Deposit[] {
  return [...deposits].sort((a, b) => b.madeOn.localeCompare(a.madeOn) || b.createdAt.localeCompare(a.createdAt));
}

export type DepositCheck = { ok: true; amount: number } | { ok: false; error: 'amount' | 'date' };

/** Valida o formulário: valor positivo e um dia que não seja no futuro. */
export function checkDeposit(amountText: string, madeOn: string, today: string): DepositCheck {
  const amount = parseAmount(amountText);
  if (amount === 'invalid') return { ok: false, error: 'amount' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(madeOn) || madeOn > today) return { ok: false, error: 'date' };
  return { ok: true, amount };
}
