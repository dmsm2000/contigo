import { describe, expect, it } from 'vitest';
import { Meeting, nextEncounter, togetherStats, upcomingMeetings } from './meetings.logic';
import { Trip } from './trips.logic';

const meeting = (id: string, startDate: string, endDate: string | null = null): Meeting => ({
  id,
  startDate,
  endDate,
  place: 'porto',
  note: null,
  createdBy: null,
});

const trip = (startDate: string, endDate: string | null, datesConfirmed = true) =>
  ({ id: 't', startDate, endDate, datePrecision: 'day', datesConfirmed }) as Trip;

describe('upcomingMeetings', () => {
  it('ignora os que já acabaram e ordena pelo começo', () => {
    const list = [meeting('c', '2026-12-20'), meeting('a', '2026-11-01'), meeting('b', '2026-12-01', '2026-12-03')];
    expect(upcomingMeetings(list, '2026-11-15').map((m) => m.id)).toEqual(['b', 'c']);
  });

  it('um encontro a decorrer ainda conta', () => {
    expect(upcomingMeetings([meeting('a', '2026-11-14', '2026-11-16')], '2026-11-15')).toHaveLength(1);
  });
});

describe('nextEncounter', () => {
  const today = '2026-11-15';

  it('sem nada, não há próximo', () => {
    expect(nextEncounter([], null, today)).toBeNull();
  });

  it('um encontro antes da viagem ganha', () => {
    const next = nextEncounter([meeting('a', '2026-11-28')], trip('2026-12-05', '2026-12-08'), today);
    expect(next).toMatchObject({ kind: 'meeting' });
  });

  it('a viagem antes do encontro ganha', () => {
    const next = nextEncounter([meeting('a', '2026-12-20')], trip('2026-12-05', '2026-12-08'), today);
    expect(next).toMatchObject({ kind: 'trip' });
  });

  it('uma viagem com as datas por confirmar não conta', () => {
    expect(nextEncounter([], trip('2026-12-05', null, false), today)).toBeNull();
    expect(nextEncounter([meeting('a', '2026-12-20')], trip('2026-12-05', null, false), today)).toMatchObject({ kind: 'meeting' });
  });

  it('o que está a decorrer passa à frente do que vem aí', () => {
    const next = nextEncounter([meeting('a', '2026-11-14', '2026-11-16'), meeting('b', '2026-11-20')], null, today);
    expect(next).toMatchObject({ kind: 'meeting', meeting: { id: 'a' } });
  });
});

describe('togetherStats', () => {
  const today = '2026-11-15';
  const past = (startDate: string, endDate: string | null, extra: Partial<Trip> = {}) =>
    ({ status: 'past', withPartner: true, datePrecision: 'day', startDate, endDate, ...extra }) as Trip;

  it('sem nada, zero dias e sem último encontro', () => {
    expect(togetherStats([], [], today)).toEqual({ daysThisYear: 0, daysSince: null });
  });

  it('soma os dias dos encontros e das viagens, sem contar duas vezes os que se sobrepõem', () => {
    const stats = togetherStats([meeting('a', '2026-11-01', '2026-11-03')], [past('2026-11-03', '2026-11-05')], today);
    expect(stats.daysThisYear).toBe(5);
    expect(stats.daysSince).toBe(10);
  });

  it('ignora o que ainda vem aí, as viagens sem o outro e as só com o mês', () => {
    const stats = togetherStats(
      [meeting('a', '2026-12-01', '2026-12-03')],
      [past('2026-05-01', '2026-05-04', { withPartner: false }), past('2026-06-01', null, { datePrecision: 'month' })],
      today,
    );
    expect(stats).toEqual({ daysThisYear: 0, daysSince: null });
  });

  it('só conta os dias do ano em curso', () => {
    const stats = togetherStats([meeting('a', '2025-12-30', '2026-01-02')], [], today);
    expect(stats.daysThisYear).toBe(2);
  });

  it('um encontro a decorrer conta até hoje e o último foi hoje', () => {
    const stats = togetherStats([meeting('a', '2026-11-14', '2026-11-18')], [], today);
    expect(stats).toEqual({ daysThisYear: 2, daysSince: 0 });
  });
});
