// Lógica pura do modo "viagem em curso": em que dia vamos, o que está a acontecer agora e o que vem a seguir.
// Sem Angular nem rede, para se testar facilmente. As horas do roteiro são "HH:MM" locais (as do relógio do telemóvel).
import { todayIso } from './availability.logic';
import { ItineraryItem } from './itinerary.logic';
import { isLive } from './trip-plan.logic';
import { Trip, tripCountdown } from './trips.logic';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** Quanto dura uma atividade com hora de início mas sem fim e sem nada a seguir. */
const DEFAULT_DURATION_MS = 60 * MINUTE_MS;

export interface LiveDay {
  /** O dia da viagem (1 = o primeiro). */
  day: number;
  total: number;
  /** A data de hoje, "AAAA-MM-DD". */
  date: string;
}

/**
 * O dia da viagem a decorrer agora, ou nulo se hoje não é um dia dela. Só conta com datas fechadas e ao dia
 * (sem isso não há como saber em que dia estamos) e com uma viagem ainda por acabar.
 */
export function liveDayOf(
  trip: Pick<Trip, 'status' | 'startDate' | 'endDate' | 'datePrecision' | 'datesConfirmed'>,
  now: Date,
): LiveDay | null {
  if (!trip.datesConfirmed || trip.datePrecision !== 'day' || !isLive(trip.status)) return null;
  const today = todayIso(now);
  const count = tripCountdown(trip, today);
  return count.phase === 'during' ? { day: count.day, total: count.total, date: today } : null;
}

/** As atividades de um dia do roteiro, pela ordem em que estão guardadas. */
export function itemsOfDay(items: readonly ItineraryItem[], day: number): ItineraryItem[] {
  return items.filter((item) => item.day === day).sort((a, b) => a.position - b.position);
}

/** A primeira atividade com hora de uma lista (para dizer "amanhã começa às…"). */
export function firstTimed(items: readonly ItineraryItem[]): ItineraryItem | null {
  return (
    items
      .filter((item) => item.startTime)
      .sort((a, b) => (a.startTime as string).localeCompare(b.startTime as string))[0] ?? null
  );
}

export type LiveStatus = 'done' | 'now' | 'upcoming' | 'anytime';

export interface LiveEntry {
  item: ItineraryItem;
  /** "anytime": sem hora, por isso não é nem passada nem futura. */
  status: LiveStatus;
  /** Os instantes (ms) em que começa e acaba; nulos nas atividades sem hora. */
  startMs: number | null;
  endMs: number | null;
}

/** Onde vamos no dia: antes da primeira atividade, numa atividade, num intervalo, depois da última, ou sem horas. */
export type LivePhase = 'empty' | 'before' | 'now' | 'free' | 'after';

export interface LiveView {
  phase: LivePhase;
  /** Todas as atividades do dia, com hora primeiro (por hora) e as sem hora no fim. */
  entries: LiveEntry[];
  /** A que está a decorrer; havendo várias ao mesmo tempo, a que começou há menos tempo. */
  current: LiveEntry | null;
  /** A próxima a começar. */
  next: LiveEntry | null;
  /** Milissegundos até a próxima começar. */
  msToNext: number | null;
  /** Milissegundos até a atual acabar. */
  msToEnd: number | null;
  /** De 0 a 1: quanto da atividade atual já passou. */
  progress: number | null;
}

/** O instante de uma hora "HH:MM" num dia "AAAA-MM-DD", no fuso do dispositivo. */
function atMs(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

/**
 * O estado de um dia do roteiro num dado instante. Uma atividade sem hora de fim dura até à seguinte (no máximo
 * uma hora); uma que acaba "antes" de começar acaba depois da meia-noite.
 */
export function buildLiveView(
  items: readonly ItineraryItem[],
  date: string,
  nowMs: number,
): LiveView {
  const timed = items
    .filter((item) => item.startTime)
    .map((item) => ({ item, startMs: atMs(date, item.startTime as string) }))
    .sort((a, b) => a.startMs - b.startMs);

  const entries: LiveEntry[] = timed.map(({ item, startMs }, index) => {
    let endMs: number;
    if (item.endTime) {
      endMs = atMs(date, item.endTime);
      if (endMs <= startMs) endMs += DAY_MS;
    } else {
      const following = timed[index + 1]?.startMs ?? Infinity;
      endMs = Math.max(startMs + MINUTE_MS, Math.min(startMs + DEFAULT_DURATION_MS, following));
    }
    const status: LiveStatus = endMs <= nowMs ? 'done' : startMs <= nowMs ? 'now' : 'upcoming';
    return { item, status, startMs, endMs };
  });
  const timedEntries = [...entries];
  for (const item of items) {
    if (!item.startTime) entries.push({ item, status: 'anytime', startMs: null, endMs: null });
  }

  const current = [...timedEntries].reverse().find((entry) => entry.status === 'now') ?? null;
  const next = timedEntries.find((entry) => entry.status === 'upcoming') ?? null;
  const started = timedEntries.some((entry) => entry.status !== 'upcoming');

  let phase: LivePhase;
  if (!timedEntries.length) phase = 'empty';
  else if (current) phase = 'now';
  else if (!started) phase = 'before';
  else if (next) phase = 'free';
  else phase = 'after';

  const span = current ? (current.endMs as number) - (current.startMs as number) : 0;
  return {
    phase,
    entries,
    current,
    next,
    msToNext: next ? (next.startMs as number) - nowMs : null,
    msToEnd: current ? (current.endMs as number) - nowMs : null,
    progress:
      current && span > 0
        ? Math.min(1, Math.max(0, (nowMs - (current.startMs as number)) / span))
        : null,
  };
}

/** "45 min", "2 h" ou "1 h 12 min": arredonda para cima, para nunca mostrar "0 min" antes da hora. */
export function durationText(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / MINUTE_MS));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? (minutes ? `${hours} h ${minutes} min` : `${hours} h`) : `${minutes} min`;
}

/** Procura o sítio no mapa (abre fora da app, só quando se toca); `area` ajuda a não confundir sítios com o mesmo nome. */
export function mapUrlOf(
  item: Pick<ItineraryItem, 'placeName' | 'address'>,
  area: string,
): string | null {
  const query = [item.placeName, item.address].filter(Boolean).join(', ');
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} ${area}`)}`
    : null;
}
