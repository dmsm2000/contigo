import { describe, expect, it } from 'vitest';
import {
  buildRequest,
  costSummary,
  dayDate,
  groupByDay,
  ItineraryItem,
  parseCost,
  parseItinerary,
  RequestInput,
} from './itinerary.logic';

const reply = (days: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ summary: 'Resumo', days, ...extra });

describe('parseItinerary', () => {
  it('lê um JSON dentro de um bloco de código, com texto à volta', () => {
    const result = parseItinerary('Aqui vai:\n```json\n' + reply([{ day: 1, activities: [{ title: 'Plaza Mayor' }] }]) + '\n```\nBoa viagem!');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items[0].title).toBe('Plaza Mayor');
  });

  it('corrige horas, custos e categorias', () => {
    const result = parseItinerary(
      reply([{ day: 1, activities: [{ title: 'Almoço', start: '9:30', end: '25:00', category: 'EAT', cost_eur: '12,50 €' }, { title: 'Algo', category: 'xpto' }] }]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [first] = result.value.items;
    expect(first).toMatchObject({ startTime: '09:30', endTime: null, category: 'eat', costEur: 12.5 });
    expect(result.value.items[1].category).toBe('other');
  });

  it('ordena cada dia pela hora e deixa o que não tem hora no fim', () => {
    const result = parseItinerary(
      reply([{ day: 1, activities: [{ title: 'B', start: '15:00' }, { title: 'Sem hora' }, { title: 'A', start: '09:00' }] }]),
    );
    expect(result.ok && result.value.items.map((item) => item.title)).toEqual(['A', 'B', 'Sem hora']);
  });

  it('conta as atividades sem título que não se aproveitaram', () => {
    const result = parseItinerary(reply([{ day: 1, activities: [{ title: 'Boa' }, { description: 'sem título' }, {}] }]));
    expect(result.ok && result.skipped).toBe(2);
  });

  it('só guarda ligações http(s)', () => {
    const result = parseItinerary(reply([{ day: 1, activities: [{ title: 'A', link: 'javascript:alert(1)' }, { title: 'B', link: 'https://exemplo.pt' }] }]));
    expect(result.ok && result.value.items.map((item) => item.link)).toEqual([null, 'https://exemplo.pt']);
  });

  it('falha com mensagens claras', () => {
    expect(parseItinerary('isto não é JSON')).toMatchObject({ ok: false, error: { key: 'itinerary.errors.notJson' } });
    expect(parseItinerary('{"summary":"x"}')).toMatchObject({ ok: false, error: { key: 'itinerary.errors.noDays' } });
    expect(parseItinerary(reply([{ day: 1, activities: [] }]))).toMatchObject({ ok: false, error: { key: 'itinerary.errors.noActivities' } });
  });

  it('usa o número do dia quando falta ou é inválido', () => {
    const result = parseItinerary(reply([{ activities: [{ title: 'A' }] }, { day: 0, activities: [{ title: 'B' }] }]));
    expect(result.ok && result.value.items.map((item) => item.day)).toEqual([1, 2]);
  });

  it('guarda o resumo e as dicas', () => {
    const result = parseItinerary(reply([{ day: 1, activities: [{ title: 'A' }] }], { tips: ['Levar casaco', '', 5] }));
    expect(result.ok && result.value.tips).toEqual(['Levar casaco', '5']);
  });
});

describe('parseCost', () => {
  it('aceita números e texto com moeda', () => {
    expect(parseCost(12)).toBe(12);
    expect(parseCost('~12.5 EUR')).toBe(12.5);
    expect(parseCost('grátis')).toBeNull();
    expect(parseCost(-3)).toBeNull();
  });
});

describe('buildRequest', () => {
  const base: RequestInput = {
    place: 'Salamanca, Espanha',
    startDate: '2026-12-03',
    endDate: '2026-12-05',
    days: null,
    people: 2,
    budgetCap: 300,
    origins: ['Porto', 'Madrid'],
    stay: 'Hostal Plaza',
    wishes: ['Catedral'],
    pace: 'relaxed',
    notes: 'comida local',
    planNote: 'Quem vem do Porto não pode viajar antes das 18h.',
    language: 'pt',
  };

  it('inclui o que se sabe e o formato da resposta', () => {
    const request = buildRequest(base);
    for (const part of ['Salamanca, Espanha', 'de 2026-12-03 a 2026-12-05', '300 €', 'Porto e Madrid', 'Hostal Plaza', 'Catedral', 'comida local', 'O que queremos desta viagem', 'não pode viajar antes das 18h', '"cost_eur"']) {
      expect(request).toContain(part);
    }
  });

  it('sem descrição nem notas, não abre essas secções', () => {
    const request = buildRequest({ ...base, notes: '  ', planNote: null });
    expect(request).not.toContain('O que queremos desta viagem');
    expect(request).not.toContain('Notas que já temos');
  });

  it('sem datas fechadas, pede os dias; sem nada, propõe 3', () => {
    expect(buildRequest({ ...base, startDate: null, endDate: null, days: 4 })).toContain('4 dias');
    expect(buildRequest({ ...base, startDate: null, endDate: null, days: null })).toContain('propõe 3 dias');
  });
});

describe('dias, datas e custos', () => {
  const item = (day: number, position: number, cost: number | null, category: ItineraryItem['category']): ItineraryItem => ({
    id: `${day}-${position}`,
    itineraryId: 'i',
    tripId: 't',
    day,
    position,
    startTime: null,
    endTime: null,
    title: 'x',
    category,
    description: null,
    placeName: null,
    address: null,
    costEur: cost,
    booking: null,
    link: null,
    tip: null,
  });

  it('agrupa por dia e ordena pela posição', () => {
    const groups = groupByDay([item(2, 0, null, 'see'), item(1, 1, null, 'see'), item(1, 0, null, 'eat')]);
    expect(groups.map((group) => group.day)).toEqual([1, 2]);
    expect(groups[0].items.map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('a data do dia N só existe se se sabe quando começa', () => {
    expect(dayDate('2026-12-03', 3)).toBe('2026-12-05');
    expect(dayDate(null, 3)).toBeNull();
  });

  it('soma os custos por categoria do orçamento e conta os que não têm custo', () => {
    const summary = costSummary([item(1, 0, 20, 'eat'), item(1, 1, 5.5, 'see'), item(1, 2, 4.5, 'do'), item(1, 3, null, 'move'), item(2, 0, 10, 'move')]);
    expect(summary.byCategory).toEqual({ food: 20, activities: 10, transport: 10 });
    expect(summary).toMatchObject({ total: 40, unpriced: 1 });
  });
});
