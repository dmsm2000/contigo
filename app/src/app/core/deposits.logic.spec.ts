import { describe, expect, it } from 'vitest';
import { checkDeposit, Deposit, newestDepositsFirst, toDeposit } from './deposits.logic';

describe('depósitos', () => {
  it('converte uma linha da base de dados', () => {
    expect(toDeposit({ id: 'a', amount: '200.50', made_on: '2026-11-10', note: null, created_by: 'u', created_at: 'x' })).toMatchObject({ amount: 200.5, madeOn: '2026-11-10', userId: 'u' });
  });

  it('valida o valor e o dia', () => {
    expect(checkDeposit('200', '2026-11-10', '2026-11-27')).toEqual({ ok: true, amount: 200 });
    expect(checkDeposit('12,5', '2026-11-27', '2026-11-27')).toEqual({ ok: true, amount: 12.5 });
    expect(checkDeposit('0', '2026-11-10', '2026-11-27')).toEqual({ ok: false, error: 'amount' });
    expect(checkDeposit('abc', '2026-11-10', '2026-11-27')).toEqual({ ok: false, error: 'amount' });
    expect(checkDeposit('50', '2026-12-01', '2026-11-27')).toEqual({ ok: false, error: 'date' });
    expect(checkDeposit('50', '', '2026-11-27')).toEqual({ ok: false, error: 'date' });
  });

  it('ordena do mais recente para o mais antigo', () => {
    const d = (id: string, madeOn: string): Deposit => ({ id, amount: 1, madeOn, note: null, userId: null, createdAt: madeOn });
    expect(newestDepositsFirst([d('a', '2026-10-01'), d('b', '2026-11-01')]).map((x) => x.id)).toEqual(['b', 'a']);
  });
});
