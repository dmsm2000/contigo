import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import {
  Expense,
  isUnreachable,
  PendingExpense,
  pendingToExpense,
  withPending,
} from './expenses.logic';
import { ExpensesService, OfflineError } from './expenses.service';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';

interface Reply {
  error: { code?: string; message: string } | null;
  status: number;
}
const OK: Reply = { error: null, status: 201 };
const NO_NETWORK: Reply = { error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 };
const REFUSED: Reply = { error: { message: 'foreign key', code: '23503' }, status: 409 };
const DUPLICATE: Reply = { error: { message: 'duplicate key', code: '23505' }, status: 409 };

const DRAFT = {
  tripId: 't1',
  amount: 12.5,
  category: 'food' as const,
  note: 'jantar',
  spentOn: '2026-12-03',
};

/** O serviço com um Supabase de mentira: guarda os envios e responde pela ordem das `replies` (senão, "ok"). */
function setup(options: { online?: boolean; stale?: boolean } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const replies: Reply[] = [];
  const online = signal(options.online ?? true);
  const stale = signal(options.stale ?? false);
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve(replies.shift() ?? OK);
      },
      select: () => ({
        order: () => ({
          order: () => ({
            range: () => ({ returns: () => Promise.resolve({ data: [], error: null }) }),
          }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve(replies.shift() ?? OK) }),
      delete: () => ({ eq: () => Promise.resolve(replies.shift() ?? OK) }),
    }),
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: () => Promise.resolve(),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: { client } },
      { provide: AuthService, useValue: { userId: signal('u1'), stale, reload: signal(0) } },
      { provide: ProfileService, useValue: { incomeFor: () => 0 } },
      { provide: ConnectivityService, useValue: { online, refresh: signal(0) } },
    ],
  });
  const service = TestBed.inject(ExpensesService);
  // A primeira passagem do `effect` do serviço (carregar, ouvir) faz-se já, para não aparecer a meio do teste.
  TestBed.tick();
  return { service, inserts, replies, online, stale };
}

describe('despesas sem rede', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('com rede, a despesa segue logo e não fica na fila', async () => {
    const { service, inserts } = setup();
    expect(await service.add(DRAFT)).toBe('sent');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      trip_id: 't1',
      amount_eur: 12.5,
      category: 'food',
      note: 'jantar',
      spent_on: '2026-12-03',
    });
    expect(typeof inserts[0]['id']).toBe('string');
    expect(service.pendingCount()).toBe(0);
  });

  it('sem rede, fica guardada: aparece, conta nos totais e sobrevive a fechar a app', async () => {
    const { service, inserts } = setup({ online: false });
    expect(await service.add(DRAFT)).toBe('queued');
    expect(inserts).toHaveLength(0);
    expect(service.pendingCount()).toBe(1);
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0].sync).toBe('pending');
    expect(service.byTrip().get('t1')).toBe(12.5);

    TestBed.resetTestingModule();
    const reopened = setup({ online: false }).service;
    expect(reopened.pendingCount()).toBe(1);
    expect(reopened.items()[0]).toMatchObject({ amount: 12.5, note: 'jantar', sync: 'pending' });
  });

  it('com a sessão só guardada (sem rede a sério), também fica guardada, sem ir à rede', async () => {
    const { service, inserts } = setup({ stale: true });
    expect(await service.add(DRAFT)).toBe('queued');
    expect(inserts).toHaveLength(0);
  });

  it('se a rede falha a meio do envio, fica guardada em vez de se perder', async () => {
    const { service, replies } = setup();
    replies.push(NO_NETWORK);
    expect(await service.add(DRAFT)).toBe('queued');
    expect(service.pendingCount()).toBe(1);
  });

  it('se o servidor a recusa, é um erro (e não fica na fila)', async () => {
    const { service, replies } = setup();
    replies.push(REFUSED);
    await expect(service.add(DRAFT)).rejects.toMatchObject({ code: '23503' });
    expect(service.pendingCount()).toBe(0);
  });

  it('quando a rede volta, envia as guardadas pela ordem e esvazia a fila (com o mesmo id)', async () => {
    const { service, inserts, online } = setup({ online: false });
    await service.add(DRAFT);
    await service.add({ ...DRAFT, amount: 3, note: 'café' });
    const ids = service.items().map((item) => item.id);
    online.set(true);
    await service.flush();
    expect(inserts.map((row) => row['id'])).toEqual(ids);
    expect(service.pendingCount()).toBe(0);
    expect(
      localStorage.getItem(Object.keys(localStorage).find((key) => key.includes('pending')) ?? ''),
    ).toBeNull();
  });

  it('pára à primeira falta de rede e deixa o resto para depois', async () => {
    const { service, inserts, online, replies } = setup({ online: false });
    await service.add(DRAFT);
    await service.add({ ...DRAFT, amount: 3 });
    online.set(true);
    replies.push(NO_NETWORK);
    await service.flush();
    expect(inserts).toHaveLength(1);
    expect(service.pendingCount()).toBe(2);
    await service.flush();
    expect(service.pendingCount()).toBe(0);
  });

  it('um id que o servidor já tem (o envio anterior chegou mas a resposta perdeu-se) conta como enviado', async () => {
    const { service, online, replies } = setup({ online: false });
    await service.add(DRAFT);
    online.set(true);
    replies.push(DUPLICATE);
    await service.flush();
    expect(service.pendingCount()).toBe(0);
  });

  it('uma que o servidor recusa fica marcada e não se volta a tentar até ser corrigida', async () => {
    const { service, inserts, online, replies } = setup({ online: false });
    await service.add(DRAFT);
    online.set(true);
    replies.push(REFUSED);
    await service.flush();
    expect(service.pendingCount()).toBe(1);
    expect(service.items()[0].sync).toBe('failed');

    await service.flush();
    expect(inserts).toHaveLength(1);

    await service.update(service.items()[0].id, {
      amount: 9,
      category: 'food',
      note: null,
      spentOn: '2026-12-03',
    });
    await service.flush();
    expect(inserts).toHaveLength(2);
    expect(inserts[1]).toMatchObject({ amount_eur: 9, note: null });
    expect(service.pendingCount()).toBe(0);
  });

  it('corrigir ou apagar uma ainda por enviar mexe só na cópia do telemóvel', async () => {
    const { service, inserts } = setup({ online: false });
    await service.add(DRAFT);
    const id = service.items()[0].id;
    await service.update(id, {
      amount: 20,
      category: 'stay',
      note: 'hotel',
      spentOn: '2026-12-02',
    });
    expect(service.items()[0]).toMatchObject({
      amount: 20,
      category: 'stay',
      note: 'hotel',
      sync: 'pending',
    });
    await service.remove(id);
    expect(service.items()).toHaveLength(0);
    expect(service.pendingCount()).toBe(0);
    expect(inserts).toHaveLength(0);
  });

  it('sem rede, uma despesa já enviada não se corrige nem se apaga (e diz porquê)', async () => {
    const { service } = setup({ online: false });
    await expect(
      service.update('do-servidor', {
        amount: 1,
        category: 'food',
        note: null,
        spentOn: '2026-12-03',
      }),
    ).rejects.toBeInstanceOf(OfflineError);
    await expect(service.remove('do-servidor')).rejects.toBeInstanceOf(OfflineError);
  });

  it('se a rede falha a meio de uma correção, também é "sem rede"', async () => {
    const { service, replies } = setup();
    replies.push(NO_NETWORK);
    await expect(
      service.update('do-servidor', {
        amount: 1,
        category: 'food',
        note: null,
        spentOn: '2026-12-03',
      }),
    ).rejects.toBeInstanceOf(OfflineError);
    replies.push(NO_NETWORK);
    await expect(service.remove('do-servidor')).rejects.toBeInstanceOf(OfflineError);
  });
});

describe('despesas por enviar: lógica', () => {
  const pending: PendingExpense = {
    id: 'p1',
    tripId: 't1',
    userId: 'u1',
    amount: 5,
    category: 'other',
    note: null,
    spentOn: '2026-12-03',
    createdAt: '2026-12-03T10:00:00.000Z',
  };

  it('uma por enviar vira uma despesa marcada; recusada, marcada como tal', () => {
    expect(pendingToExpense(pending)).toMatchObject({
      id: 'p1',
      amount: 5,
      sync: 'pending',
      updatedBy: null,
    });
    expect(pendingToExpense({ ...pending, failed: true }).sync).toBe('failed');
  });

  it('uma que o servidor já tem não conta duas vezes', () => {
    const onServer: Expense = { ...pendingToExpense(pending), sync: undefined };
    expect(withPending([onServer], [pending])).toHaveLength(1);
    expect(withPending([], [pending])).toHaveLength(1);
    expect(withPending([onServer], [{ ...pending, id: 'p2' }]).map((item) => item.id)).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('só uma falta de resposta do servidor merece nova tentativa; uma recusa não', () => {
    expect([0, 502, 503, 504].every(isUnreachable)).toBe(true);
    expect([200, 201, 400, 401, 403, 409, 500].some(isUnreachable)).toBe(false);
  });
});
