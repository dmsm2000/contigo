import { describe, expect, it } from 'vitest';
import { arrivalAt, durationBetween, isValidZone, offsetMinutes, zoneShiftHours } from './timezone.logic';

describe('fusos horários', () => {
  it('Porto e Madrid têm uma hora de diferença, no inverno e no verão', () => {
    expect(zoneShiftHours('2026-12-03', 'Europe/Lisbon', 'Europe/Madrid')).toBe(1);
    expect(zoneShiftHours('2026-07-03', 'Europe/Lisbon', 'Europe/Madrid')).toBe(1);
  });

  it('não é sempre uma hora: Londres, Canárias, Nova Iorque', () => {
    expect(zoneShiftHours('2026-12-03', 'Europe/Lisbon', 'Europe/London')).toBe(0);
    expect(zoneShiftHours('2026-12-03', 'Europe/Madrid', 'Atlantic/Canary')).toBe(-1);
    expect(zoneShiftHours('2026-12-03', 'Europe/Lisbon', 'America/New_York')).toBe(-5);
    expect(zoneShiftHours('2026-12-03', 'Europe/Lisbon', 'Asia/Kolkata')).toBe(5.5);
  });

  it('a diferença muda com as horas de verão de cada lado (março)', () => {
    // Nova Iorque passa ao verão antes da Europa.
    expect(zoneShiftHours('2026-03-20', 'Europe/Lisbon', 'America/New_York')).toBe(-4);
    expect(zoneShiftHours('2026-04-05', 'Europe/Lisbon', 'America/New_York')).toBe(-5);
  });

  it('a chegada tem em conta o fuso e a duração', () => {
    // Porto 16:30 → 3h15 de viagem → 19:45 em Portugal = 20:45 em Madrid.
    expect(arrivalAt('2026-12-03', '16:30', 195, 'Europe/Lisbon', 'Europe/Madrid')).toEqual({ time: '20:45', days: 0 });
    expect(arrivalAt('2026-12-03', '16:30', 195, 'Europe/Madrid', 'Europe/Lisbon')).toEqual({ time: '18:45', days: 0 });
    expect(arrivalAt('2026-12-03', '23:00', 150, 'Europe/Lisbon', 'Europe/Madrid')).toEqual({ time: '02:30', days: 1 });
  });

  it('a duração sai das duas horas de relógio', () => {
    expect(durationBetween('2026-12-03', '16:30', '20:45', 'Europe/Lisbon', 'Europe/Madrid')).toBe(195);
    expect(durationBetween('2026-12-03', '23:00', '02:30', 'Europe/Lisbon', 'Europe/Madrid')).toBe(150);
  });

  it('valida os nomes dos fusos', () => {
    expect(isValidZone('Europe/Madrid')).toBe(true);
    expect(isValidZone('Madrid')).toBe(false);
    expect(isValidZone('')).toBe(false);
    expect(offsetMinutes('UTC', Date.UTC(2026, 0, 1))).toBe(0);
  });
});
