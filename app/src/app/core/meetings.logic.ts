// Lógica pura dos encontros (visitas sem ser viagem) e de qual é o próximo, para o contador do Início.
import { addDays, daysUntil, todayIso } from './availability.logic';
import { Trip, TripCountdown, lastDayOf, tripCountdown } from './trips.logic';

export type MeetingPlace = 'porto' | 'madrid' | 'other';

export interface Meeting {
  id: string;
  startDate: string;
  endDate: string | null;
  place: MeetingPlace;
  note: string | null;
  /** A hora a que começa ('18:30'), se se sabe. */
  startTime: string | null;
  createdBy: string | null;
}

export interface MeetingRow {
  id: string;
  start_date: string;
  end_date: string | null;
  at_place: MeetingPlace;
  note: string | null;
  start_time?: string | null;
  created_by: string | null;
}

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    place: row.at_place,
    note: row.note,
    // O Postgres devolve '18:30:00'.
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    createdBy: row.created_by,
  };
}

/** Os dias de um encontro, no mesmo formato das datas de uma viagem (para a contagem e as datas escritas). */
export function meetingSpan(meeting: Pick<Meeting, 'startDate' | 'endDate'>): Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'> {
  return { startDate: meeting.startDate, endDate: meeting.endDate, datePrecision: 'day' };
}

/** Para ordenar: a data e a hora (sem hora, o início do dia). */
function startKey(meeting: Pick<Meeting, 'startDate' | 'startTime'>): string {
  return `${meeting.startDate}T${meeting.startTime ?? '00:00'}`;
}

/** Os encontros que ainda não acabaram (hoje ainda conta), do mais próximo para o mais distante. */
export function upcomingMeetings(meetings: readonly Meeting[], today: string): Meeting[] {
  return meetings
    .filter((meeting) => lastDayOf(meetingSpan(meeting)) >= today)
    .sort((a, b) => startKey(a).localeCompare(startKey(b)) || a.id.localeCompare(b.id));
}

export type NextEncounter = { kind: 'meeting'; meeting: Meeting } | { kind: 'trip'; trip: Trip };

/**
 * O próximo momento em que os dois estão juntos: o que está a decorrer, ou senão o que começa primeiro,
 * entre os encontros e a viagem ativa (só se as datas dela já estiverem confirmadas). Sem nada, null.
 */
export function nextEncounter(meetings: readonly Meeting[], trip: Trip | null, today: string): NextEncounter | null {
  const candidates: { start: string; value: NextEncounter }[] = upcomingMeetings(meetings, today).map((meeting) => ({
    start: startKey(meeting),
    value: { kind: 'meeting', meeting },
  }));
  if (trip && trip.datesConfirmed && lastDayOf(trip) >= today) {
    candidates.push({ start: `${trip.startDate}T00:00`, value: { kind: 'trip', trip } });
  }
  if (!candidates.length) return null;
  // Ao empatar, a viagem ganha (é o que se quer destacar).
  candidates.sort((a, b) => a.start.localeCompare(b.start) || (a.value.kind === 'trip' ? -1 : 1));
  const ongoing = candidates.find((candidate) => candidate.start.slice(0, 10) <= today);
  return (ongoing ?? candidates[0]).value;
}

export interface TogetherStats {
  /** Quantos dias deste ano já passaram juntos (até hoje). */
  daysThisYear: number;
  /** Há quantos dias foi o último dia juntos (0 = hoje); null se ainda não há nenhum. */
  daysSince: number | null;
}

/**
 * Os dias juntos: os dos encontros e os das viagens feitas a dois com o dia exato (as antigas, só com o mês, não dizem
 * quantos dias foram). Os dias que se sobrepõem contam uma vez, e só contam os que já passaram.
 */
export function togetherStats(
  meetings: readonly Meeting[],
  trips: readonly Pick<Trip, 'status' | 'withPartner' | 'datePrecision' | 'startDate' | 'endDate'>[],
  today: string,
): TogetherStats {
  const spans: { from: string; to: string }[] = meetings.map((meeting) => ({
    from: meeting.startDate,
    to: lastDayOf(meetingSpan(meeting)),
  }));
  for (const trip of trips) {
    const counts = trip.withPartner && trip.datePrecision === 'day' && ['past', 'closed', 'ongoing'].includes(trip.status);
    if (counts) spans.push({ from: trip.startDate, to: lastDayOf(trip) });
  }

  const year = today.slice(0, 4);
  const days = new Set<string>();
  let last: string | null = null;
  for (const span of spans) {
    if (span.from > today) continue;
    const to = span.to < today ? span.to : today;
    if (last === null || to > last) last = to;
    // Só os dias do ano em curso, por isso começa-se no máximo a 1 de janeiro.
    for (let day = span.from < `${year}-01-01` ? `${year}-01-01` : span.from; day <= to; day = addDays(day, 1)) days.add(day);
  }
  return { daysThisYear: days.size, daysSince: last === null ? null : daysUntil(today, last) };
}

const DAY_MS = 86_400_000;

/** O instante (hora local) em que o encontro começa; null se não tem hora. */
export function meetingStartMs(meeting: Pick<Meeting, 'startDate' | 'startTime'>): number | null {
  if (!meeting.startTime) return null;
  const [year, month, day] = meeting.startDate.split('-').map(Number);
  const [hour, minute] = meeting.startTime.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

/** Como o contador de um encontro: dias, ou (com hora, a menos de 24 h) as horas, minutos e segundos que faltam. */
export type MeetingCountdown = TripCountdown | { phase: 'soon'; ms: number };

export function meetingCountdown(meeting: Meeting, now: Date): MeetingCountdown {
  const today = todayIso(now);
  const start = meetingStartMs(meeting);
  if (start !== null) {
    const diff = start - now.getTime();
    if (diff > 0 && diff < DAY_MS) return { phase: 'soon', ms: diff };
    // A 24 h ou mais: dias de calendário, como nos encontros sem hora.
    if (diff >= DAY_MS) return { phase: 'before', days: Math.max(1, daysUntil(meeting.startDate, today)) };
  }
  return tripCountdown(meetingSpan(meeting), today);
}

/** Horas, minutos e segundos de um intervalo (por baixo). */
export function clockParts(ms: number): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
