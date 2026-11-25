// O próximo transporte da viagem, para o guia do dia: a deslocação escolhida cuja partida (dia e hora) é a seguinte.
import { isValidZone, wallToInstant } from './timezone.logic';
import { Leg } from './trip-plan.logic';

const MINUTE_MS = 60_000;
/** Uma deslocação sem duração conhece-se "em viagem" durante este tempo depois da partida. */
const DEFAULT_TRAVEL_MS = 60 * MINUTE_MS;
/** Só se destaca o transporte que parte nas próximas horas (ou que está em andamento). */
export const NEXT_TRANSPORT_WINDOW_MS = 36 * 60 * MINUTE_MS;

export interface NextTransport {
  leg: Leg;
  /** O instante da partida (no fuso da partida) e o da chegada, se se sabe a duração. */
  departMs: number;
  arriveMs: number;
  /** "underway": já partiu e ainda não chegou; "upcoming": ainda vai partir. */
  status: 'underway' | 'upcoming';
  /** Milissegundos até partir (upcoming) ou até chegar (underway). */
  msLeft: number;
}

/**
 * As deslocações escolhidas com dia e hora de partida, a primeira que ainda não acabou. `deviceZone` serve de fuso da
 * partida quando a deslocação não tem um. Sem nada nas próximas 36 horas, devolve null.
 */
export function nextTransport(legs: readonly Leg[], nowMs: number, deviceZone: string): NextTransport | null {
  const found: NextTransport[] = [];
  for (const leg of legs) {
    if (!leg.chosen || !leg.departsOn || !leg.departsTime) continue;
    const zone = isValidZone(leg.fromZone) ? leg.fromZone : deviceZone;
    const departMs = wallToInstant(leg.departsOn, leg.departsTime, zone);
    const arriveMs = departMs + (leg.minutes !== null ? leg.minutes * MINUTE_MS : DEFAULT_TRAVEL_MS);
    if (arriveMs <= nowMs) continue;
    const status = departMs <= nowMs ? 'underway' : 'upcoming';
    if (status === 'upcoming' && departMs - nowMs > NEXT_TRANSPORT_WINDOW_MS) continue;
    found.push({ leg, departMs, arriveMs, status, msLeft: (status === 'upcoming' ? departMs : arriveMs) - nowMs });
  }
  found.sort((a, b) => a.departMs - b.departMs);
  return found[0] ?? null;
}
