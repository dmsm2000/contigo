import { describe, expect, it } from 'vitest';
import {
  cebola,
  cleanExpenseNote,
  Expense,
  monthsInclusive,
  newestFirst,
  parseAmount,
  toExpense,
  totalOf,
  totalsByCategory,
  totalsByTrip,
} from './expenses.logic';

const expense = (id: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id,
  tripId: 't1',
  userId: 'u1',
  amount,
  category: 'food',
  note: null,
  spentOn: '2026-10-05',
  createdAt: '2026-10-05T10:00:00Z',
  updatedAt: '2026-10-05T10:00:00Z',
  updatedBy: null,
  ...extra,
});

describe('parseAmount', () => {
  it('aceita vírgula, ponto e o símbolo do euro', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount(' 40 € ')).toBe(40);
  });
  it('recusa zero, negativos, texto e demasiadas casas', () => {
    for (const bad of ['', '0', '-5', 'abc', '1,234', '12,5,6', '100000,01']) expect(parseAmount(bad)).toBe('invalid');
  });
});

describe('cleanExpenseNote', () => {
  it('vazia vira nula, limpa espaços e recusa o que passa do limite', () => {
    expect(cleanExpenseNote('   ')).toBeNull();
    expect(cleanExpenseNote('  Jantar   na   praça ')).toBe('Jantar na praça');
    expect(cleanExpenseNote('x'.repeat(201))).toBe('tooLong');
  });
});

describe('totais', () => {
  const list = [
    expense('a', 10.1),
    expense('b', 20.2, { category: 'stay' }),
    expense('c', 5, { tripId: 't2' }),
  ];
  it('somam sem erros de vírgula flutuante', () => {
    expect(totalOf(list)).toBe(35.3);
    expect(totalsByTrip(list).get('t1')).toBe(30.3);
  });
  it('por categoria, da maior para a menor', () => {
    expect(totalsByCategory(list)).toEqual([
      { category: 'stay', total: 20.2 },
      { category: 'food', total: 15.1 },
    ]);
  });
  it('mais recentes primeiro', () => {
    const sorted = newestFirst([expense('a', 1, { spentOn: '2026-10-01' }), expense('b', 1, { spentOn: '2026-10-09' })]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('toExpense', () => {
  it('converte o numeric (texto) em número', () => {
    const row = { id: 'x', trip_id: 't', user_id: null, amount_eur: '42.50', category: 'food' as const, note: null, spent_on: '2026-10-01', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', updated_by: 'u' };
    expect(toExpense(row).amount).toBe(42.5);
  });
});

describe('cebola', () => {
  it('sem gastos é zero e nada para trás: só há a dotação deste mês', () => {
    expect(cebola([], 400, '2026-11-14')).toMatchObject({ amount: 0, since: null, months: 0, available: 400 });
  });
  it('no mês do primeiro gasto ainda não há cebola: sobra-se da dotação desse mês', () => {
    expect(cebola([expense('a', 150, { spentOn: '2026-11-02' })], 400, '2026-11-14')).toMatchObject({
      amount: 0,
      months: 0,
      spentThisMonth: 150,
      available: 250,
    });
  });
  it('o que sobra de cada mês fechado passa para a cebola, e este mês gasta-se dela', () => {
    // Set: 400-150 = 250; Out: 400-50 = 350; Nov (em curso): gastou 100.
    const list = [
      expense('a', 150, { spentOn: '2026-09-20' }),
      expense('b', 50, { spentOn: '2026-10-05' }),
      expense('c', 100, { spentOn: '2026-11-03' }),
    ];
    expect(cebola(list, 400, '2026-11-14')).toMatchObject({ since: '2026-09', months: 2, amount: 600, spentThisMonth: 100, available: 900 });
  });
  it('um mês sem gastos no meio conta a dotação inteira', () => {
    const list = [expense('a', 100, { spentOn: '2026-08-10' }), expense('b', 40, { spentOn: '2026-11-01' })];
    // Ago 300; Set 400; Out 400 → 1100.
    expect(cebola(list, 400, '2026-11-14').amount).toBe(1100);
  });
  it('um mês em que se gastou mais do que entrou faz a cebola descer', () => {
    const list = [expense('a', 500, { spentOn: '2026-10-02' })];
    expect(cebola(list, 400, '2026-11-14')).toMatchObject({ amount: -100, available: 300 });
  });
  it('muda de ano sem se perder', () => {
    const list = [expense('a', 100, { spentOn: '2026-12-10' })];
    expect(cebola(list, 400, '2027-02-01')).toMatchObject({ months: 2, amount: 300 + 400 });
  });
  it('monthsInclusive conta os dois meses e muda de ano', () => {
    expect(monthsInclusive('2026-11', '2026-11')).toBe(1);
    expect(monthsInclusive('2026-11', '2027-02')).toBe(4);
    expect(monthsInclusive('2026-12', '2026-11')).toBe(0);
  });
});
