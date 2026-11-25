// Fusos horários reais (IANA) para as horas de partida e chegada de uma deslocação. Tudo via Intl: trata sozinho das
// horas de verão de cada país, por isso a diferença entre dois sítios não é sempre a mesma.

/** A diferença para o UTC, em minutos, de um fuso num instante (por exemplo Madrid no inverno: 60). */
export function offsetMinutes(zone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(new Date(atMs));
  const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

export function isValidZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** O instante (ms) em que, num fuso, o relógio marca esse dia e essa hora. */
export function wallToInstant(date: string, time: string, zone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asUtc - offsetMinutes(zone, asUtc) * 60_000;
  return asUtc - offsetMinutes(zone, first) * 60_000;
}

function wallParts(ms: number, zone: string): { date: string; time: string } {
  const local = new Date(ms + offsetMinutes(zone, ms) * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

const DAY_MS = 86_400_000;

/**
 * A hora de chegada (no relógio do destino) de quem parte a `time` do dia `date` e viaja `minutes`.
 * `days` diz quantos dias depois da partida é a chegada (0 = no mesmo dia, 1 = no dia seguinte).
 */
export function arrivalAt(date: string, time: string, minutes: number, fromZone: string, toZone: string): { time: string; days: number } {
  const departure = wallToInstant(date, time, fromZone);
  const arrival = wallParts(departure + minutes * 60_000, toZone);
  const days = Math.round((Date.parse(`${arrival.date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS);
  return { time: arrival.time, days };
}

/** A duração a partir das duas horas de relógio (cada uma no seu fuso); passar da meia-noite conta. */
export function durationBetween(date: string, depTime: string, arrTime: string, fromZone: string, toZone: string): number {
  const departure = wallToInstant(date, depTime, fromZone);
  const arrivalDay = wallParts(departure, toZone).date;
  let minutes = Math.round((wallToInstant(arrivalDay, arrTime, toZone) - departure) / 60_000);
  while (minutes < 0) minutes += 1440;
  return minutes;
}

/** Quantas horas o relógio do destino anda à frente do da partida nesse dia (pode ser negativo ou fracionário). */
export function zoneShiftHours(date: string, fromZone: string, toZone: string): number {
  const at = wallToInstant(date, '12:00', fromZone);
  return (offsetMinutes(toZone, at) - offsetMinutes(fromZone, at)) / 60;
}
