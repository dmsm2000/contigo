import { describe, expect, it } from 'vitest';
import { Meeting, nextEncounter, upcomingMeetings } from './meetings.logic';
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
