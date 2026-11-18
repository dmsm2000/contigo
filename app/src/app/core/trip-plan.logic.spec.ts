import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  minutesBetween,
  budgetTotals,
  formatDuration,
  formatRange,
  headroom,
  isLive,
  isPlanning,
  planReadiness,
  transportDecided,
  nextStage,
  nightsBetween,
  openFirst,
  parseDuration,
  sortStays,
  stageOf,
  statusForStage,
  suggestBudget,
  travellers,
} from './trip-plan.logic';

describe('estados', () => {
  it('sorteada e planeada são "a planear"', () => {
    expect(isPlanning('drawn')).toBe(true);
    expect(isPlanning('planned')).toBe(true);
    expect(isPlanning('prepared')).toBe(false);
    expect(stageOf('planned')).toBe('planning');
    expect(stageOf('past')).toBeNull();
  });

  it('só as viagens por acabar estão vivas', () => {
    expect(['drawn', 'planned', 'prepared', 'ongoing'].every((s) => isLive(s as never))).toBe(true);
    expect(isLive('past')).toBe(false);
    expect(isLive('closed')).toBe(false);
  });

  it('voltar a planear mantém a origem (sorteada continua sorteada)', () => {
    expect(statusForStage('planning', 'drawn')).toBe('drawn');
    expect(statusForStage('planning', 'prepared')).toBe('planned');
    expect(statusForStage('ongoing', 'prepared')).toBe('ongoing');
  });

  it('o ciclo anda pela ordem', () => {
    expect(nextStage('planning')).toBe('prepared');
    expect(nextStage('prepared')).toBe('ongoing');
    expect(nextStage('ongoing')).toBe('closed');
    expect(nextStage('closed')).toBeNull();
  });
});

describe('datas', () => {
  it('conta as noites', () => {
    expect(nightsBetween('2026-12-02', '2026-12-04')).toBe(2);
    expect(nightsBetween('2026-11-30', '2026-12-02')).toBe(2);
    expect(nightsBetween('2026-12-02', '2026-12-02')).toBe(0);
  });

  it('escreve o intervalo', () => {
    expect(formatRange('2026-12-02', '2026-12-04', 'pt')).toBe('2 a 4 de dezembro');
    expect(formatRange('2026-11-30', '2026-12-02', 'pt')).toContain('30 de novembro a 2 de dezembro');
    expect(formatRange('2026-12-02', '2026-12-04', 'en')).toBe('December 2 to 4');
  });
});

describe('deslocações', () => {
  it('escreve e lê durações', () => {
    expect(formatDuration(210)).toBe('3h30');
    expect(formatDuration(97)).toBe('1h37');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(120)).toBe('2h');
    expect(parseDuration('3h30')).toBe(210);
    expect(parseDuration('3:30')).toBe(210);
    expect(parseDuration('1h37')).toBe(97);
    expect(parseDuration('3,5h')).toBe(210);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('muito')).toBe('invalid');
  });
});

describe('alojamento e orçamento', () => {
  const stay = (name: string, priceEur: number | null, chosen = false) => ({ id: name, tripId: 't', name, priceEur, rating: null, note: null, link: null, chosen });

  it('a escolhida vem primeiro, depois as mais baratas, e as sem preço no fim', () => {
    expect(sortStays([stay('Luxor', 238), stay('Sem', null), stay('Condal', 78), stay('Polo', 81, true)]).map((s) => s.name)).toEqual(['Polo', 'Condal', 'Luxor', 'Sem']);
  });

  it('o orçamento é por pessoa e o total multiplica pelas pessoas', () => {
    expect(budgetTotals([{ amountEur: 40 }, { amountEur: 30 }, { amountEur: 80 }], 2)).toEqual({ perPerson: 150, total: 300 });
    expect(travellers({ withPartner: true })).toBe(2);
    expect(travellers({ withPartner: false })).toBe(1);
  });

  it('sugere o alojamento dividido pelos dois e a média das deslocações (a mais barata de cada origem)', () => {
    expect(suggestBudget({ priceEur: 78 }, [{ origin: 'Porto', priceEur: 40 }, { origin: 'Madrid', priceEur: 20 }], 2)).toEqual({ stay: 39, transport: 30 });
    // O Porto tem duas formas de chegar: conta a mais barata, não as duas.
    expect(suggestBudget(null, [{ origin: 'Porto', priceEur: 25 }, { origin: 'porto', priceEur: 20 }, { origin: 'Madrid', priceEur: 20 }], 2)).toEqual({ transport: 20 });
    expect(suggestBudget(null, [], 2)).toEqual({});
  });

  it('a folga face ao teto', () => {
    expect(headroom(400, 312)).toBe(88);
    expect(headroom(300, 312)).toBe(-12);
    expect(headroom(null, 312)).toBeNull();
  });
});

describe('lista e preparação', () => {
  it('o que falta vem primeiro', () => {
    const items = [
      { id: 'a', tripId: 't', kind: 'see' as const, text: 'a', done: true },
      { id: 'b', tripId: 't', kind: 'eat' as const, text: 'b', done: false },
    ];
    expect(openFirst(items).map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('a deslocação só está decidida com uma escolhida em cada origem', () => {
    const leg = (origin: string, chosen: boolean) => ({ origin, chosen });
    expect(transportDecided([])).toBe(false);
    expect(transportDecided([leg('Porto', false), leg('Porto', false)])).toBe(false);
    expect(transportDecided([leg('Porto', true), leg('Porto', false)])).toBe(true);
    expect(transportDecided([leg('Porto', true), leg('Madrid', false)])).toBe(false);
    expect(transportDecided([leg('Porto', true), leg('porto ', false), leg('Madrid', true)])).toBe(true);
  });

  it('só está pronta com as 3 decisões e a aprovação dos dois', () => {
    const base = { datesConfirmed: true, stays: [{ chosen: true }], legs: [{ origin: 'Porto', chosen: true }], approvals: [{ userId: 'a' }, { userId: 'b' }], travellerIds: ['a', 'b'] };
    expect(planReadiness(base)).toMatchObject({ ready: true, missing: [], waitingFor: [] });
    expect(planReadiness({ ...base, approvals: [{ userId: 'a' }] })).toMatchObject({ ready: false, missing: ['approval'], approvedBy: ['a'], waitingFor: ['b'] });
    expect(planReadiness({ ...base, datesConfirmed: false, stays: [{ chosen: false }], legs: [] }).missing).toEqual(['dates', 'stay', 'transport']);
    // Vai só uma pessoa: basta a aprovação dela.
    expect(planReadiness({ ...base, approvals: [{ userId: 'a' }], travellerIds: ['a'] }).ready).toBe(true);
  });
});

describe('ida e volta', () => {
  it('soma a ida e a volta mais baratas de cada origem', () => {
    const legs = [
      { origin: 'Porto', direction: 'out' as const, priceEur: 60 },
      { origin: 'Porto', direction: 'out' as const, priceEur: 40 },
      { origin: 'Porto', direction: 'back' as const, priceEur: 50 },
    ];
    expect(suggestBudget(null, legs, 2)['transport']).toBe(90);
  });

  it('pede uma escolhida em cada sentido que tenha deslocações', () => {
    const out = { origin: 'Porto', direction: 'out' as const, chosen: true };
    const back = { origin: 'Porto', direction: 'back' as const, chosen: false };
    expect(transportDecided([out])).toBe(true);
    expect(transportDecided([out, back])).toBe(false);
    expect(transportDecided([out, { ...back, chosen: true }])).toBe(true);
  });
});

describe('horas da deslocação', () => {
  it('calcula a chegada a partir da saída e da duração', () => {
    expect(addMinutes('16:30', 195)).toEqual({ time: '19:45', days: 0 });
    expect(addMinutes('23:00', 150)).toEqual({ time: '01:30', days: 1 });
    expect(addMinutes('xx', 10)).toBeNull();
  });

  it('calcula a duração entre a saída e a chegada', () => {
    expect(minutesBetween('16:30', '19:45')).toBe(195);
    expect(minutesBetween('23:00', '01:30')).toBe(150);
  });
});
