import { describe, expect, it } from 'vitest';
import { ActivityItem, collapse, groupByDay, isUnread, iconOf, messageKey, targetOf, unreadCount } from './activity.logic';

const item = (id: string, kind: string, createdAt: string, extra: Partial<ActivityItem> = {}): ActivityItem => ({
  id,
  actor: 'ela',
  kind,
  tripId: 't1',
  data: {},
  createdAt,
  ...extra,
});

describe('novidades', () => {
  it('só conta o que o outro fez e que ainda não se leu', () => {
    const items = [
      item('a', 'expense', '2026-11-30T10:00:00Z'),
      item('b', 'expense', '2026-11-30T08:00:00Z'),
      item('c', 'expense', '2026-11-30T11:00:00Z', { actor: 'eu' }),
    ];
    expect(unreadCount(items, 'eu', '2026-11-30T09:00:00Z')).toBe(1);
    expect(unreadCount(items, 'eu', null)).toBe(2);
    expect(isUnread(items[2], 'eu', null)).toBe(false);
    expect(unreadCount(items, null, null)).toBe(0);
  });

  it('junta as despesas seguidas do mesmo autor e da mesma viagem, e soma-as', () => {
    const list = [
      item('3', 'expense', '2026-11-30T10:20:00Z', { data: { amount: 5 } }),
      item('2', 'expense', '2026-11-30T10:10:00Z', { data: { amount: 7.5 } }),
      item('1', 'expense', '2026-11-30T10:00:00Z', { data: { amount: 2 } }),
    ];
    const entries = collapse(list);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ count: 3, total: 14.5 });
    expect(messageKey(entries[0])).toBe('activity.kind.expense_other');
  });

  it('não junta o que está longe no tempo, de outra viagem, de outro autor ou que não se junta', () => {
    const far = collapse([item('2', 'expense', '2026-11-30T12:00:00Z'), item('1', 'expense', '2026-11-30T10:00:00Z')]);
    expect(far).toHaveLength(2);
    expect(collapse([item('2', 'expense', '2026-11-30T10:05:00Z', { tripId: 't2' }), item('1', 'expense', '2026-11-30T10:00:00Z')])).toHaveLength(2);
    expect(collapse([item('2', 'expense', '2026-11-30T10:05:00Z', { actor: 'eu' }), item('1', 'expense', '2026-11-30T10:00:00Z')])).toHaveLength(2);
    expect(collapse([item('2', 'stay_chosen', '2026-11-30T10:05:00Z'), item('1', 'stay_chosen', '2026-11-30T10:00:00Z')])).toHaveLength(2);
  });

  it('a chave do texto tem singular e plural só onde se junta', () => {
    expect(messageKey(collapse([item('1', 'photo_added', '2026-11-30T10:00:00Z')])[0])).toBe('activity.kind.photo_added_one');
    expect(messageKey(collapse([item('1', 'plan_approved', '2026-11-30T10:00:00Z')])[0])).toBe('activity.kind.plan_approved');
  });

  it('diz para onde leva tocar', () => {
    expect(targetOf({ kind: 'deposit', tripId: null })).toEqual({ type: 'page', path: '/expenses' });
    expect(targetOf({ kind: 'stay_chosen', tripId: 't1' })).toEqual({ type: 'trip', tripId: 't1' });
    expect(targetOf({ kind: 'expense', tripId: null })).toEqual({ type: 'page', path: '/expenses' });
    expect(targetOf({ kind: 'meeting_added', tripId: null })).toEqual({ type: 'page', path: '/availability' });
    expect(targetOf({ kind: 'trip_status', tripId: null })).toBeNull();
  });

  it('agrupa por dia', () => {
    const entries = collapse([item('3', 'plan_approved', '2026-11-30T12:00:00'), item('2', 'stay_chosen', '2026-11-30T09:00:00'), item('1', 'doc_added', '2026-11-29T20:00:00')]);
    expect(groupByDay(entries).map((day) => [day.day, day.entries.length])).toEqual([['2026-11-30', 2], ['2026-11-29', 1]]);
  });

  it('tem um ícone para cada tipo e um por omissão', () => {
    expect(iconOf('expense')).toBe('receipt-outline');
    expect(iconOf('coisa-nova')).toBe('sparkles-outline');
  });
});
