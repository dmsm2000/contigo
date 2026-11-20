import { describe, expect, it } from 'vitest';
import { parseDevNow } from './clock.service';
import { ItineraryItem } from './itinerary.logic';
import {
  buildLiveView,
  durationText,
  firstTimed,
  itemsOfDay,
  liveDayOf,
  mapUrlOf,
} from './trip-live.logic';

const DATE = '2026-12-03';
/** O instante de uma hora de DATE, no fuso do dispositivo (como a lógica faz). */
const at = (hhmm: string, date = DATE) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

let counter = 0;
function item(
  start: string | null,
  end: string | null,
  title = 'Atividade',
  extra: Partial<ItineraryItem> = {},
): ItineraryItem {
  counter += 1;
  return {
    id: `i${counter}`,
    itineraryId: 'it',
    tripId: 't',
    day: 2,
    position: counter,
    startTime: start,
    endTime: end,
    title,
    category: 'see',
    description: null,
    placeName: null,
    address: null,
    costEur: null,
    booking: null,
    link: null,
    tip: null,
    ...extra,
  };
}

const trip = (overrides: Record<string, unknown> = {}) =>
  ({
    status: 'planned' as const,
    startDate: '2026-12-02',
    endDate: '2026-12-04',
    datePrecision: 'day' as const,
    datesConfirmed: true,
    ...overrides,
  }) as Parameters<typeof liveDayOf>[0];

describe('liveDayOf', () => {
  it('diz em que dia da viagem estamos', () => {
    expect(liveDayOf(trip(), new Date(2026, 11, 2, 10, 0))).toEqual({
      day: 1,
      total: 3,
      date: '2026-12-02',
    });
    expect(liveDayOf(trip(), new Date(2026, 11, 3, 23, 59))).toEqual({
      day: 2,
      total: 3,
      date: '2026-12-03',
    });
    expect(liveDayOf(trip(), new Date(2026, 11, 4, 8, 0))).toEqual({
      day: 3,
      total: 3,
      date: '2026-12-04',
    });
  });

  it('não conta antes de começar nem depois de acabar', () => {
    expect(liveDayOf(trip(), new Date(2026, 11, 1, 23, 59))).toBeNull();
    expect(liveDayOf(trip(), new Date(2026, 11, 5, 0, 0))).toBeNull();
  });

  it('não conta com datas por fechar nem só com o mês', () => {
    expect(liveDayOf(trip({ datesConfirmed: false }), new Date(2026, 11, 3, 10, 0))).toBeNull();
    expect(
      liveDayOf(
        trip({ datePrecision: 'month', startDate: '2026-12-01', endDate: null }),
        new Date(2026, 11, 3, 10, 0),
      ),
    ).toBeNull();
  });

  it('não conta numa viagem que já passou', () => {
    expect(liveDayOf(trip({ status: 'past' }), new Date(2026, 11, 3, 10, 0))).toBeNull();
    expect(liveDayOf(trip({ status: 'closed' }), new Date(2026, 11, 3, 10, 0))).toBeNull();
  });

  it('uma viagem de um dia só dura nesse dia', () => {
    const one = trip({ startDate: '2026-12-03', endDate: null });
    expect(liveDayOf(one, new Date(2026, 11, 3, 12, 0))).toEqual({
      day: 1,
      total: 1,
      date: '2026-12-03',
    });
    expect(liveDayOf(one, new Date(2026, 11, 4, 12, 0))).toBeNull();
  });
});

describe('itemsOfDay e firstTimed', () => {
  it('filtra o dia e respeita a posição', () => {
    const a = item('10:00', null, 'A', { day: 1, position: 2 });
    const b = item('09:00', null, 'B', { day: 1, position: 1 });
    const c = item('09:00', null, 'C', { day: 2, position: 1 });
    expect(itemsOfDay([a, b, c], 1).map((x) => x.title)).toEqual(['B', 'A']);
  });

  it('a primeira com hora ignora as que não têm', () => {
    expect(
      firstTimed([
        item(null, null, 'sem hora'),
        item('11:00', null, 'tarde'),
        item('09:30', null, 'cedo'),
      ])?.title,
    ).toBe('cedo');
    expect(firstTimed([item(null, null)])).toBeNull();
  });
});

describe('buildLiveView', () => {
  const day = () => [
    item('10:00', '12:00', 'Catedrais'),
    item('12:15', '13:30', 'Casa Lis'),
    item('13:45', '15:15', 'Almoço'),
    item('17:15', '18:30', 'Puente Romano'),
  ];

  it('antes da primeira atividade, o dia ainda não começou', () => {
    const view = buildLiveView(day(), DATE, at('08:30'));
    expect(view.phase).toBe('before');
    expect(view.current).toBeNull();
    expect(view.next?.item.title).toBe('Catedrais');
    expect(view.msToNext).toBe(90 * 60_000);
    expect(view.entries.every((entry) => entry.status === 'upcoming')).toBe(true);
  });

  it('durante uma atividade, mostra a atual, a seguinte e o progresso', () => {
    const view = buildLiveView(day(), DATE, at('11:00'));
    expect(view.phase).toBe('now');
    expect(view.current?.item.title).toBe('Catedrais');
    expect(view.next?.item.title).toBe('Casa Lis');
    expect(view.progress).toBeCloseTo(0.5);
    expect(view.msToEnd).toBe(60 * 60_000);
    expect(view.msToNext).toBe(75 * 60_000);
  });

  it('a hora de início conta como já a decorrer e a de fim como acabada', () => {
    expect(buildLiveView(day(), DATE, at('10:00')).current?.item.title).toBe('Catedrais');
    const atEnd = buildLiveView(day(), DATE, at('12:00'));
    // Às 12:00 a Catedral acabou e a Casa Lis ainda só começa às 12:15: é um intervalo.
    expect(atEnd.current).toBeNull();
    expect(atEnd.phase).toBe('free');
    expect(atEnd.entries[0].status).toBe('done');
    expect(atEnd.msToNext).toBe(15 * 60_000);
  });

  it('uma atividade que começa quando a outra acaba passa a ser a atual', () => {
    const back = [item('10:00', '11:00', 'A'), item('11:00', '12:00', 'B')];
    const view = buildLiveView(back, DATE, at('11:00'));
    expect(view.current?.item.title).toBe('B');
    expect(view.entries[0].status).toBe('done');
  });

  it('entre duas atividades é tempo livre', () => {
    const view = buildLiveView(day(), DATE, at('16:00'));
    expect(view.phase).toBe('free');
    expect(view.current).toBeNull();
    expect(view.next?.item.title).toBe('Puente Romano');
    expect(view.msToNext).toBe(75 * 60_000);
  });

  it('depois da última, o dia acabou', () => {
    const view = buildLiveView(day(), DATE, at('19:00'));
    expect(view.phase).toBe('after');
    expect(view.next).toBeNull();
    expect(view.msToNext).toBeNull();
    expect(view.entries.every((entry) => entry.status === 'done')).toBe(true);
  });

  it('sem hora de fim, a atividade dura até à seguinte (no máximo uma hora)', () => {
    const open = [
      item('09:00', null, 'Pequeno-almoço'),
      item('09:30', null, 'Passeio'),
      item('14:00', null, 'Almoço'),
    ];
    expect(buildLiveView(open, DATE, at('09:10')).current?.item.title).toBe('Pequeno-almoço');
    // O pequeno-almoço acabou quando o passeio começou.
    expect(buildLiveView(open, DATE, at('09:30')).current?.item.title).toBe('Passeio');
    // O passeio dura uma hora, não até às 14:00.
    expect(buildLiveView(open, DATE, at('10:31')).phase).toBe('free');
    // A última dura uma hora.
    expect(buildLiveView(open, DATE, at('14:59')).current?.item.title).toBe('Almoço');
    expect(buildLiveView(open, DATE, at('15:00')).phase).toBe('after');
  });

  it('uma atividade que acaba depois da meia-noite continua a decorrer', () => {
    const night = [item('23:00', '01:00', 'Passeio noturno')];
    expect(buildLiveView(night, DATE, at('23:30')).current?.item.title).toBe('Passeio noturno');
    expect(buildLiveView(night, DATE, at('00:30', '2026-12-04')).current?.item.title).toBe(
      'Passeio noturno',
    );
    expect(buildLiveView(night, DATE, at('01:00', '2026-12-04')).phase).toBe('after');
  });

  it('as atividades sem hora vão para o fim e não mudam o estado do dia', () => {
    const mixed = [item(null, null, 'Compras'), item('10:00', '11:00', 'Museu')];
    const view = buildLiveView(mixed, DATE, at('10:30'));
    expect(view.entries.map((entry) => entry.item.title)).toEqual(['Museu', 'Compras']);
    expect(view.entries[1].status).toBe('anytime');
    expect(view.phase).toBe('now');
    expect(buildLiveView(mixed, DATE, at('12:00')).phase).toBe('after');
  });

  it('só com atividades sem hora, não há agora nem a seguir', () => {
    const view = buildLiveView([item(null, null, 'Passear')], DATE, at('12:00'));
    expect(view.phase).toBe('empty');
    expect(view.current).toBeNull();
    expect(view.next).toBeNull();
    expect(buildLiveView([], DATE, at('12:00')).phase).toBe('empty');
  });

  it('ordena por hora, mesmo que estejam guardadas fora de ordem', () => {
    const view = buildLiveView(
      [item('15:00', '16:00', 'tarde'), item('09:00', '10:00', 'manhã')],
      DATE,
      at('08:00'),
    );
    expect(view.entries.map((entry) => entry.item.title)).toEqual(['manhã', 'tarde']);
    expect(view.next?.item.title).toBe('manhã');
  });

  it('com duas atividades ao mesmo tempo, a atual é a que começou há menos tempo', () => {
    const overlap = [item('10:00', '12:00', 'Longa'), item('11:00', '11:30', 'Curta')];
    const view = buildLiveView(overlap, DATE, at('11:10'));
    expect(view.current?.item.title).toBe('Curta');
    expect(view.entries.filter((entry) => entry.status === 'now')).toHaveLength(2);
  });

  it('duas atividades com a mesma hora e sem fim não ficam com duração zero', () => {
    const same = [item('10:00', null, 'A'), item('10:00', null, 'B')];
    expect(buildLiveView(same, DATE, at('10:00')).current).not.toBeNull();
  });
});

describe('durationText', () => {
  it('escreve minutos, horas e as duas', () => {
    expect(durationText(45 * 60_000)).toBe('45 min');
    expect(durationText(120 * 60_000)).toBe('2 h');
    expect(durationText(72 * 60_000)).toBe('1 h 12 min');
  });

  it('arredonda para cima e nunca mostra zero', () => {
    expect(durationText(5_000)).toBe('1 min');
    expect(durationText(0)).toBe('1 min');
    expect(durationText(60_001)).toBe('2 min');
    expect(durationText(59 * 60_000 + 1)).toBe('1 h');
  });
});

describe('mapUrlOf', () => {
  it('junta o sítio, a morada e a zona', () => {
    const url = mapUrlOf({ placeName: 'Casa Lis', address: 'Calle Gibraltar, 14' }, 'Salamanca');
    expect(url).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Casa Lis, Calle Gibraltar, 14 Salamanca')}`,
    );
  });

  it('sem sítio nem morada, não há mapa', () => {
    expect(mapUrlOf({ placeName: null, address: null }, 'Salamanca')).toBeNull();
  });
});

describe('parseDevNow', () => {
  it('lê uma data e hora locais', () => {
    expect(parseDevNow('2026-12-03T15:20')).toBe(new Date(2026, 11, 3, 15, 20).getTime());
    expect(parseDevNow('2026-12-03 15:20')).toBe(new Date(2026, 11, 3, 15, 20).getTime());
  });

  it('rejeita o que não é uma data e hora válidas', () => {
    expect(parseDevNow(null)).toBeNull();
    expect(parseDevNow('off')).toBeNull();
    expect(parseDevNow('2026-12-03')).toBeNull();
    expect(parseDevNow('2026-02-30T10:00')).toBeNull();
    expect(parseDevNow('2026-12-03T25:00')).toBeNull();
    expect(parseDevNow('2026-12-03T10:75')).toBeNull();
  });
});
