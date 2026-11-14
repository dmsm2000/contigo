import { describe, expect, it } from 'vitest';
import {
  groupByYear,
  byRecentlyAdded,
  isDone,
  isUpcoming,
  lastDayOf,
  formatCost,
  formatTripDate,
  initialOf,
  isFutureMonth,
  monthName,
  monthOptions,
  parseCost,
  placeSubtitle,
  previousMonth,
  startDateFor,
  tileColors,
  toTrip,
  TripRow,
  yearOptions,
  yearStats,
} from './trips.logic';

describe('datas', () => {
  it('guarda o mês como o dia 1', () => {
    expect(startDateFor(2026, 10)).toBe('2026-10-01');
    expect(startDateFor(2026, 3)).toBe('2026-03-01');
  });

  it('percebe quando um mês ainda não chegou', () => {
    const now = new Date(2026, 10, 13); // 13 de novembro de 2026
    expect(isFutureMonth(2026, 11, now)).toBe(false);
    expect(isFutureMonth(2026, 12, now)).toBe(true);
    expect(isFutureMonth(2027, 1, now)).toBe(true);
    expect(isFutureMonth(2025, 12, now)).toBe(false);
  });

  it('o mês anterior atravessa o ano', () => {
    expect(previousMonth(new Date(2026, 10, 13))).toEqual({ year: 2026, month: 10 });
    expect(previousMonth(new Date(2027, 0, 5))).toEqual({ year: 2026, month: 12 });
  });

  it('lista anos do atual para trás', () => {
    const years = yearOptions(new Date(2026, 10, 13), 3);
    expect(years).toEqual([2026, 2025, 2024, 2023]);
  });

  it('escreve os meses na língua certa, com maiúscula', () => {
    expect(monthName(10, 'pt')).toBe('Outubro');
    expect(monthName(10, 'es')).toBe('Octubre');
    expect(monthName(10, 'en')).toBe('October');
    expect(monthOptions('pt')).toHaveLength(12);
    expect(monthOptions('pt')[0]).toEqual({ value: 1, label: 'Janeiro' });
  });

  it('formata a data de uma viagem só com o mês', () => {
    const trip = { startDate: '2026-10-01', endDate: null, datePrecision: 'month' as const };
    expect(formatTripDate(trip, 'pt')).toMatch(/^Outubro de 2026$/);
    expect(formatTripDate(trip, 'en')).toBe('October 2026');
  });

  it('formata o dia quando se sabe o dia', () => {
    const trip = { startDate: '2026-12-05', endDate: null, datePrecision: 'day' as const };
    expect(formatTripDate(trip, 'pt')).toMatch(/5 de dezembro de 2026/);
  });
});

describe('custo', () => {
  it('lê valores escritos de várias formas', () => {
    expect(parseCost('')).toBeNull();
    expect(parseCost('   ')).toBeNull();
    expect(parseCost('12')).toBe(12);
    expect(parseCost('12,5')).toBe(12.5);
    expect(parseCost('12.5')).toBe(12.5);
    expect(parseCost('1.234,50')).toBe(1234.5);
    expect(parseCost('1,234.50')).toBe(1234.5);
    expect(parseCost('1.234')).toBe(1234);
    expect(parseCost('187 €')).toBe(187);
    expect(parseCost('0')).toBe(0);
  });

  it('recusa o que não é um valor', () => {
    expect(parseCost('abc')).toBe('invalid');
    expect(parseCost('-5')).toBe('invalid');
    expect(parseCost('12abc')).toBe('invalid');
    expect(parseCost('99999999')).toBe('invalid');
  });

  it('formata em euros sem casas decimais inúteis', () => {
    expect(formatCost(187, 'pt')).toMatch(/187/);
    expect(formatCost(187, 'pt')).toMatch(/€/);
    expect(formatCost(187.5, 'pt')).toMatch(/187,50/);
  });
});

describe('sítios', () => {
  it('escreve a linha por baixo do nome', () => {
    expect(placeSubtitle({ admin1: 'Braga', countryCode: 'PT' }, 'pt')).toBe('Braga, Portugal');
    expect(placeSubtitle({ admin1: 'Salamanca', countryCode: 'ES' }, 'es')).toBe('Salamanca, España');
    expect(placeSubtitle({ admin1: null, countryCode: 'PT' }, 'en')).toBe('Portugal');
    expect(placeSubtitle({ admin1: null, countryCode: null }, 'pt')).toBe('');
  });

  it('não repete a mesma palavra', () => {
    expect(placeSubtitle({ admin1: 'Portugal', countryCode: 'PT' }, 'pt')).toBe('Portugal');
  });

  it('dá sempre as mesmas cores ao mesmo sítio', () => {
    expect(tileColors('Braga')).toEqual(tileColors('Braga'));
    expect(tileColors('Braga').from).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('tira a inicial, mesmo com acentos', () => {
    expect(initialOf('Évora')).toBe('É');
    expect(initialOf('  braga')).toBe('B');
    expect(initialOf('')).toBe('?');
  });
});

describe('estatísticas do ano', () => {
  const trips = [
    { placeId: 'a', startDate: '2026-03-01' },
    { placeId: 'a', startDate: '2026-09-01' },
    { placeId: 'b', startDate: '2026-09-01' },
    { placeId: 'c', startDate: '2025-12-01' },
  ];

  it('conta sítios diferentes e marca os meses', () => {
    const stats = yearStats(trips, 2026);
    expect(stats.places).toBe(2);
    expect(stats.months.filter(Boolean)).toHaveLength(2);
    expect(stats.months[2]).toBe(true);
    expect(stats.months[8]).toBe(true);
    expect(stats.months[0]).toBe(false);
  });

  it('um ano sem viagens fica vazio', () => {
    expect(yearStats(trips, 2024)).toEqual({ places: 0, months: Array.from({ length: 12 }, () => false) });
  });
});

describe('linhas do Supabase', () => {
  it('converte uma linha numa viagem', () => {
    const row: TripRow = {
      id: 't1',
      place_id: 'p1',
      status: 'past',
      start_date: '2026-10-01',
      end_date: null,
      date_precision: 'month',
      with_partner: true,
      would_return: 'yes',
      cost_eur: '187.50',
      note: null,
      draw_entry: null,
      created_by: 'u1',
      created_at: '2026-11-13T18:00:00Z',
      updated_by: 'u2',
      updated_at: '2026-11-14T09:00:00Z',
      place: { id: 'p1', name: 'Braga', admin1: 'Braga', country_code: 'PT', lat: 41.55, lng: -8.42, osm_ref: 'R4115866' },
    };
    const trip = toTrip(row);
    expect(trip.costEur).toBe(187.5);
    expect(trip.withPartner).toBe(true);
    expect(trip.place.countryCode).toBe('PT');
    expect(trip.place.osmRef).toBe('R4115866');
    expect(trip.drawEntry).toBeNull();
    expect(trip.updatedBy).toBe('u2');
    expect(trip.updatedAt).toBe('2026-11-14T09:00:00Z');
  });

  it('mantém o custo vazio como nulo', () => {
    const row = { cost_eur: null, place: { id: 'p', name: 'X' } } as unknown as TripRow;
    expect(toTrip(row).costEur).toBeNull();
  });
});

describe('viagens feitas e por fazer', () => {
  it('só as passadas e as fechadas já aconteceram', () => {
    expect(isDone({ status: 'past' })).toBe(true);
    expect(isDone({ status: 'closed' })).toBe(true);
    expect(isDone({ status: 'drawn' })).toBe(false);
    expect(isDone({ status: 'prepared' })).toBe(false);
    expect(isDone({ status: 'ongoing' })).toBe(false);
  });

  it('o último dia é o fim, ou o próprio dia, ou o fim do mês', () => {
    expect(lastDayOf({ startDate: '2026-11-21', endDate: '2026-11-22', datePrecision: 'day' })).toBe('2026-11-22');
    expect(lastDayOf({ startDate: '2026-11-21', endDate: null, datePrecision: 'day' })).toBe('2026-11-21');
    expect(lastDayOf({ startDate: '2026-11-01', endDate: null, datePrecision: 'month' })).toBe('2026-11-30');
    expect(lastDayOf({ startDate: '2028-02-01', endDate: null, datePrecision: 'month' })).toBe('2028-02-29');
  });

  it('uma viagem ainda não acabou até ao fim do último dia', () => {
    const trip = { startDate: '2026-11-21', endDate: '2026-11-22', datePrecision: 'day' } as const;
    expect(isUpcoming(trip, '2026-11-13')).toBe(true);
    expect(isUpcoming(trip, '2026-11-22')).toBe(true);
    expect(isUpcoming(trip, '2026-11-23')).toBe(false);
  });

  it('com só o mês, conta até ao fim do mês', () => {
    const trip = { startDate: '2026-12-01', endDate: null, datePrecision: 'month' } as const;
    expect(isUpcoming(trip, '2026-12-31')).toBe(true);
    expect(isUpcoming(trip, '2027-01-01')).toBe(false);
  });
});

describe('byRecentlyAdded', () => {
  it('põe primeiro o que foi registado há menos tempo, sem mexer na lista original', () => {
    const list = [
      { id: 'a', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'c', createdAt: '2026-11-13T09:00:00Z' },
      { id: 'b', createdAt: '2026-11-05T12:00:00Z' },
    ];
    expect(byRecentlyAdded(list).map((trip) => trip.id)).toEqual(['c', 'b', 'a']);
    expect(list.map((trip) => trip.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('groupByYear', () => {
  const t = (startDate: string, createdAt: string) => ({ startDate, createdAt });

  it('agrupa por ano, o mais recente primeiro', () => {
    const groups = groupByYear([t('2025-03-01', 'a'), t('2026-10-01', 'b'), t('2026-08-01', 'c')]);
    expect(groups.map((g) => g.year)).toEqual(['2026', '2025']);
    expect(groups[0].trips.map((x) => x.startDate)).toEqual(['2026-10-01', '2026-08-01']);
  });

  it('sem viagens não há grupos', () => {
    expect(groupByYear([])).toEqual([]);
  });
});
