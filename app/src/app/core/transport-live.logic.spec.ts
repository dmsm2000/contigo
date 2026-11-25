import { describe, expect, it } from 'vitest';
import { nextTransport } from './transport-live.logic';
import { Leg } from './trip-plan.logic';
import { wallToInstant } from './timezone.logic';

const leg = (over: Partial<Leg>): Leg => ({
  id: 'l', tripId: 't', origin: 'Porto', direction: 'out', departsOn: '2026-12-03', departsTime: '16:30', arrivesTime: null,
  fromZone: 'Europe/Lisbon', toZone: 'Europe/Madrid', mode: 'train', minutes: 195, priceEur: null, note: null, chosen: true, ...over,
});
const at = (date: string, time: string) => wallToInstant(date, time, 'Europe/Lisbon');

describe('nextTransport', () => {
  it('escolhe a partida seguinte, no fuso da partida', () => {
    const next = nextTransport([leg({})], at('2026-12-03', '13:00'), 'Europe/Lisbon');
    expect(next?.status).toBe('upcoming');
    expect(next?.msLeft).toBe(3.5 * 3600_000);
  });

  it('já a caminho: conta até chegar', () => {
    const next = nextTransport([leg({})], at('2026-12-03', '17:30'), 'Europe/Lisbon');
    expect(next?.status).toBe('underway');
    expect(next?.msLeft).toBe((195 - 60) * 60_000);
  });

  it('ignora o que já acabou, o que não está escolhido, o sem hora e o que está longe', () => {
    const now = at('2026-12-03', '21:00');
    expect(nextTransport([leg({})], now, 'Europe/Lisbon')).toBeNull();
    expect(nextTransport([leg({ chosen: false })], at('2026-12-03', '13:00'), 'Europe/Lisbon')).toBeNull();
    expect(nextTransport([leg({ departsTime: null })], at('2026-12-03', '13:00'), 'Europe/Lisbon')).toBeNull();
    expect(nextTransport([leg({})], at('2026-11-30', '13:00'), 'Europe/Lisbon')).toBeNull();
  });

  it('com várias, a que parte primeiro', () => {
    const later = leg({ id: 'b', departsTime: '19:00' });
    const sooner = leg({ id: 'a', departsTime: '17:00' });
    expect(nextTransport([later, sooner], at('2026-12-03', '08:00'), 'Europe/Lisbon')?.leg.id).toBe('a');
  });
});
