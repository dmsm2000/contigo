import { describe, expect, it } from 'vitest';
import { Deposit } from './deposits.logic';
import {
  cebola,
  monthlyIncome,
  monthlyLedger,
  spentByPerson,
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

const deposit = (id: string, amount: number, madeOn: string): Deposit => ({ id, amount, madeOn, note: null, userId: 'u1', createdAt: `${madeOn}T10:00:00Z` });

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
  it('sem gastos nem depósitos, só há a dotação deste mês', () => {
    expect(cebola([], 400, '2026-11-14')).toMatchObject({ amount: 400, carried: 0, since: null, months: 0, available: 400 });
  });
  it('no mês do primeiro gasto ainda não há nada de trás: gasta-se da dotação desse mês', () => {
    expect(cebola([expense('a', 150, { spentOn: '2026-11-02' })], 400, '2026-11-14')).toMatchObject({
      amount: 250,
      carried: 0,
      months: 0,
      spentThisMonth: 150,
    });
  });
  it('o que sobra de cada mês fechado passa para a cebola, e este mês gasta-se dela', () => {
    // Set: 400-150 = 250; Out: 400-50 = 350; Nov (em curso): entra 400 e gastou 100.
    const list = [
      expense('a', 150, { spentOn: '2026-09-20' }),
      expense('b', 50, { spentOn: '2026-10-05' }),
      expense('c', 100, { spentOn: '2026-11-03' }),
    ];
    expect(cebola(list, 400, '2026-11-14')).toMatchObject({ since: '2026-09', months: 2, carried: 600, spentThisMonth: 100, amount: 900, available: 900 });
  });
  it('um mês sem gastos no meio conta a dotação inteira', () => {
    const list = [expense('a', 100, { spentOn: '2026-08-10' }), expense('b', 40, { spentOn: '2026-11-01' })];
    // Ago 300; Set 400; Out 400 → 1100 de trás; Nov: +400 −40.
    expect(cebola(list, 400, '2026-11-14')).toMatchObject({ carried: 1100, amount: 1460 });
  });
  it('um mês em que se gastou mais do que entrou faz a cebola descer', () => {
    const list = [expense('a', 500, { spentOn: '2026-10-02' })];
    expect(cebola(list, 400, '2026-11-14')).toMatchObject({ carried: -100, amount: 300 });
  });
  it('muda de ano sem se perder', () => {
    const list = [expense('a', 100, { spentOn: '2026-12-10' })];
    expect(cebola(list, 400, '2027-02-01')).toMatchObject({ months: 2, carried: 300 + 400, amount: 300 + 400 + 400 });
  });
  it('um depósito faz a cebola subir logo, no mês em que é feito', () => {
    const deposits = [deposit('d', 200, '2026-11-10')];
    expect(cebola([], 400, '2026-11-14', deposits)).toMatchObject({ amount: 600, depositsThisMonth: 200, since: '2026-11' });
    expect(cebola([], 400, '2026-11-14').amount).toBe(400);
  });
  it('um depósito de um mês que já fechou fica na cebola que passa', () => {
    const deposits = [deposit('d', 200, '2026-10-10')];
    expect(cebola([], 400, '2026-11-14', deposits)).toMatchObject({ since: '2026-10', months: 1, carried: 600, amount: 1000 });
  });
  it('um depósito para depois de hoje só conta quando chegar', () => {
    expect(cebola([], 400, '2026-11-14', [deposit('d', 200, '2026-11-20')]).amount).toBe(400);
  });
  it('monthsInclusive conta os dois meses e muda de ano', () => {
    expect(monthsInclusive('2026-11', '2026-11')).toBe(1);
    expect(monthsInclusive('2026-11', '2027-02')).toBe(4);
    expect(monthsInclusive('2026-12', '2026-11')).toBe(0);
  });
});

describe('monthlyLedger', () => {
  const at = (id: string, amount: number, spentOn: string, userId = 'u1') => expense(id, amount, { spentOn, userId });

  it('sem despesas nem depósitos não há meses', () => {
    expect(monthlyLedger([], 400, '2026-11-14')).toEqual([]);
  });

  it('cada mês recebe a dotação e passa o que sobra ao seguinte, com o mais recente primeiro', () => {
    const rows = monthlyLedger([at('a', 100, '2026-09-10'), at('b', 500, '2026-10-02'), at('c', 50, '2026-11-03')], 400, '2026-11-14');
    expect(rows.map((row) => row.month)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(rows[2]).toMatchObject({ income: 400, spent: 100, carried: 0, balance: 300, current: false });
    expect(rows[1]).toMatchObject({ spent: 500, carried: 300, balance: 200 });
    expect(rows[0]).toMatchObject({ spent: 50, carried: 200, balance: 550, current: true });
  });

  it('os depósitos entram no mês em que foram feitos', () => {
    const rows = monthlyLedger([at('a', 100, '2026-10-10')], 400, '2026-11-14', [deposit('d', 200, '2026-11-02')]);
    expect(rows[0]).toMatchObject({ month: '2026-11', income: 400, deposits: 200, carried: 300, balance: 900 });
  });

  it('o saldo do mês de hoje é a cebola', () => {
    const list = [at('a', 100, '2026-09-10'), at('b', 50, '2026-11-03')];
    const deposits = [deposit('d', 75, '2026-10-20')];
    const rows = monthlyLedger(list, 400, '2026-11-14', deposits);
    expect(rows[1]).toMatchObject({ month: '2026-10', spent: 0, deposits: 75, carried: 300, balance: 775 });
    expect(rows[0].balance).toBe(cebola(list, 400, '2026-11-14', deposits).amount);
  });
});

describe('spentByPerson', () => {
  it('soma por quem registou', () => {
    const list = [expense('a', 10, { userId: 'u1' }), expense('b', 5, { userId: 'u2' }), expense('c', 2.5, { userId: 'u1' })];
    expect([...spentByPerson(list)]).toEqual([['u1', 12.5], ['u2', 5]]);
  });

  it('só do mês pedido', () => {
    const list = [expense('a', 10, { spentOn: '2026-10-05' }), expense('b', 5, { spentOn: '2026-11-05' })];
    expect([...spentByPerson(list, '2026-11')]).toEqual([['u1', 5]]);
  });
});

describe('monthlyIncome', () => {
  const history = [
    { userId: 'a', month: '2000-01', amount: 200 },
    { userId: 'a', month: '2026-10', amount: 250 },
    { userId: 'b', month: '2000-01', amount: 200 },
  ];

  it('cada mês usa a dotação que valia nessa altura', () => {
    expect(monthlyIncome(history, ['a', 'b'], '2026-09', 999)).toBe(400);
    expect(monthlyIncome(history, ['a', 'b'], '2026-10', 999)).toBe(450);
    expect(monthlyIncome(history, ['a', 'b'], '2027-01', 999)).toBe(450);
  });

  it('antes da primeira mudança conhecida vale a primeira', () => {
    expect(monthlyIncome([{ userId: 'a', month: '2026-10', amount: 300 }], ['a'], '2026-01', 0)).toBe(300);
  });

  it('sem histórico usa o valor de hoje', () => {
    expect(monthlyIncome([], ['a', 'b'], '2026-09', 400)).toBe(400);
  });

  it('a cebola e o mês a mês usam o que entrou em cada mês', () => {
    const list = [expense('x', 100, { spentOn: '2026-09-10' })];
    const income = (month: string) => monthlyIncome(history, ['a', 'b'], month, 400);
    const rows = monthlyLedger(list, income, '2026-11-14');
    expect(rows.map((row) => [row.month, row.income, row.balance])).toEqual([
      ['2026-11', 450, 300 + 450 + 450],
      ['2026-10', 450, 300 + 450],
      ['2026-09', 400, 300],
    ]);
    const c = cebola(list, income, '2026-11-14');
    expect(c.carried).toBe(750);
    expect(c.monthly).toBe(450);
    expect(c.amount).toBe(rows[0].balance);
  });
});
