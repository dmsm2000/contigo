import { describe, expect, it } from 'vitest';
import {
  addDays,
  commonWindows,
  DayMark,
  fitsWindow,
  formatWindow,
  freeDays,
  markedDays,
  monthGrid,
  monthTitle,
  nextWindow,
  normalizeClock,
  rangeDays,
  shiftMonth,
  ShiftType,
  shortClock,
  toIso,
  toShiftType,
  todayIso,
  weekday,
  weekdayNames,
  windowKind,
} from './availability.logic';

const type = (id: string, kind: 'busy' | 'free', userId = 'a'): ShiftType => ({
  id,
  userId,
  name: id,
  kind,
  startsAt: null,
  endsAt: null,
  tone: 'middle',
});

const mark = (userId: string, day: string, shiftTypeId: string): DayMark => ({ userId, day, shiftTypeId });

describe('datas', () => {
  it('soma dias atravessando meses e anos', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('não se engana nas mudanças de hora', () => {
    // Na Europa, a hora muda a 29 de março e a 25 de outubro de 2026.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('diz o dia da semana, com a segunda-feira a 0', () => {
    expect(weekday('2026-11-09')).toBe(0); // segunda
    expect(weekday('2026-11-14')).toBe(5); // sábado
    expect(weekday('2026-11-15')).toBe(6); // domingo
  });

  it('dá os dias de um intervalo pela ordem do calendário, venham como vierem', () => {
    expect(rangeDays('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(rangeDays('2026-11-16', '2026-11-14')).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(rangeDays('2026-11-14', '2026-11-14')).toEqual(['2026-11-14']);
  });

  it('limita um intervalo a um ano', () => {
    expect(rangeDays('2026-01-01', '2030-01-01').length).toBe(366);
  });

  it('escreve a data de hoje na hora local', () => {
    expect(todayIso(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(toIso(2026, 1, 9)).toBe('2026-01-09');
  });
});

describe('monthGrid', () => {
  it('começa na segunda-feira e completa as semanas', () => {
    const grid = monthGrid(2026, 11); // 1 de novembro de 2026 é domingo
    expect(grid).toHaveLength(6);
    expect(grid[0][0].iso).toBe('2026-10-26');
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid[0][6]).toMatchObject({ iso: '2026-11-01', day: 1, inMonth: true });
    expect(grid[5][0]).toMatchObject({ iso: '2026-11-30', inMonth: true });
    expect(grid[5][6]).toMatchObject({ iso: '2026-12-06', inMonth: false });
  });

  it('um fevereiro que começa à segunda e tem 28 dias ocupa 4 semanas', () => {
    const grid = monthGrid(2027, 2); // 1 de fevereiro de 2027 é segunda
    expect(grid).toHaveLength(4);
    expect(grid.flat().every((day) => day.inMonth)).toBe(true);
  });

  it('todas as semanas têm 7 dias seguidos', () => {
    const days = monthGrid(2026, 7).flat();
    for (let i = 1; i < days.length; i++) expect(days[i].iso).toBe(addDays(days[i - 1].iso, 1));
  });
});

describe('shiftMonth', () => {
  it('passa de dezembro a janeiro e ao contrário', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
    expect(shiftMonth(2026, 11, 14)).toEqual({ year: 2028, month: 1 });
  });
});

describe('toShiftType e normalizeClock', () => {
  it('corta os segundos das horas', () => {
    expect(
      toShiftType({ id: '1', user_id: 'a', name: 'Manhã', kind: 'busy', starts_at: '07:00:00', ends_at: '15:30:00', tone: 'morning' }),
    ).toMatchObject({ startsAt: '07:00', endsAt: '15:30' });
  });

  it('mantém nulo o que não tem horas', () => {
    expect(
      toShiftType({ id: '1', user_id: 'a', name: 'Folga', kind: 'free', starts_at: null, ends_at: null, tone: 'middle' }),
    ).toMatchObject({ startsAt: null, endsAt: null });
  });

  it('aceita horas bem escritas e recusa as outras', () => {
    expect(normalizeClock('7:5')).toBe('07:05');
    expect(normalizeClock(' 15:00 ')).toBe('15:00');
    expect(normalizeClock('24:00')).toBeNull();
    expect(normalizeClock('12:60')).toBeNull();
    expect(normalizeClock('às 15h')).toBeNull();
    expect(normalizeClock('')).toBeNull();
  });
});

describe('freeDays', () => {
  const types = [type('folga', 'free'), type('manha', 'busy'), type('ferias', 'free', 'b')];
  const marks = [
    mark('a', '2026-11-14', 'folga'),
    mark('a', '2026-11-15', 'manha'),
    mark('b', '2026-11-14', 'ferias'),
  ];

  it('conta só os dias com um tipo livre, e só os da pessoa pedida', () => {
    expect([...freeDays(marks, types, 'a')]).toEqual(['2026-11-14']);
    expect([...freeDays(marks, types, 'b')]).toEqual(['2026-11-14']);
  });

  it('os dias por marcar não contam como livres', () => {
    expect(freeDays([], types, 'a').size).toBe(0);
  });

  it('sem pessoa não há dias', () => {
    expect(freeDays(marks, types, null).size).toBe(0);
    expect(markedDays(marks, null).size).toBe(0);
  });

  it('diz o tipo de cada dia marcado', () => {
    expect(markedDays(marks, 'a').get('2026-11-15')).toBe('manha');
  });
});

describe('commonWindows', () => {
  const set = (...days: string[]) => new Set(days);

  it('junta os dias seguidos em que os dois estão livres', () => {
    const a = set('2026-11-13', '2026-11-14', '2026-11-15', '2026-11-20');
    const b = set('2026-11-14', '2026-11-15', '2026-11-16', '2026-11-20');
    expect(commonWindows(a, b, '2026-11-01')).toEqual([
      { start: '2026-11-14', end: '2026-11-15', days: 2 },
      { start: '2026-11-20', end: '2026-11-20', days: 1 },
    ]);
  });

  it('um dia que só um tem livre não conta', () => {
    expect(commonWindows(set('2026-11-14'), set('2026-11-15'), '2026-11-01')).toEqual([]);
  });

  it('junta blocos que atravessam o fim do mês e do ano', () => {
    const both = set('2026-12-30', '2026-12-31', '2027-01-01');
    expect(commonWindows(both, both, '2026-12-01')).toEqual([{ start: '2026-12-30', end: '2027-01-01', days: 3 }]);
  });

  it('ignora o que já passou', () => {
    const both = set('2026-11-01', '2026-11-02', '2026-11-20');
    expect(commonWindows(both, both, '2026-11-10')).toEqual([{ start: '2026-11-20', end: '2026-11-20', days: 1 }]);
  });

  it('com um dos lados vazio não há janelas', () => {
    expect(commonWindows(set('2026-11-14'), set(), '2026-11-01')).toEqual([]);
  });
});

describe('windowKind e fitsWindow', () => {
  it('classifica pelo número de dias', () => {
    expect(windowKind(1)).toBe('day');
    expect(windowKind(2)).toBe('weekend');
    expect(windowKind(3)).toBe('long');
    expect(windowKind(9)).toBe('long');
  });

  it('um sítio cabe se a janela tiver dias que cheguem', () => {
    expect(fitsWindow('day', 1)).toBe(true);
    expect(fitsWindow('weekend', 1)).toBe(false);
    expect(fitsWindow('weekend', 2)).toBe(true);
    expect(fitsWindow('long', 2)).toBe(false);
    expect(fitsWindow('long', 3)).toBe(true);
  });

  it('sem duração mínima cabe em qualquer janela', () => {
    expect(fitsWindow(null, 1)).toBe(true);
  });
});

describe('nextWindow', () => {
  const windows = [
    { start: '2026-11-07', end: '2026-11-08', days: 2 },
    { start: '2026-11-14', end: '2026-11-16', days: 3 },
  ];

  it('é a primeira que ainda não acabou', () => {
    expect(nextWindow(windows, '2026-11-09')).toEqual(windows[1]);
  });

  it('uma janela que está a decorrer ainda conta', () => {
    expect(nextWindow(windows, '2026-11-15')).toEqual(windows[1]);
    expect(nextWindow(windows, '2026-11-08')).toEqual(windows[0]);
  });

  it('sem janelas à frente devolve nulo', () => {
    expect(nextWindow(windows, '2026-11-17')).toBeNull();
    expect(nextWindow([], '2026-11-01')).toBeNull();
  });
});

describe('textos de datas', () => {
  it('escreve uma janela de um dia e de vários', () => {
    expect(formatWindow({ start: '2026-11-14', end: '2026-11-14' }, 'pt')).not.toContain('–');
    const several = formatWindow({ start: '2026-11-14', end: '2026-11-16' }, 'pt');
    expect(several).toContain('14');
    expect(several).toContain('16');
    expect(several).toContain('–');
  });

  it('dá o título do mês com o ano', () => {
    const title = monthTitle(2026, 11, 'pt');
    expect(title.toLowerCase()).toContain('novembro');
    expect(title).toContain('2026');
  });

  it('dá sete nomes de dias da semana, a começar na segunda-feira', () => {
    const names = weekdayNames('en');
    expect(names).toHaveLength(7);
    expect(names[0]).toBe('M');
    expect(names[6]).toBe('S');
  });

  it('tira o zero à frente das horas', () => {
    expect(shortClock('07:00')).toBe('7:00');
    expect(shortClock('15:30')).toBe('15:30');
    expect(shortClock('00:30')).toBe('0:30');
  });
});
