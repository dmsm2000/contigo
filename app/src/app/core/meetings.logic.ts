// Lógica pura dos encontros (visitas sem ser viagem) e de qual é o próximo, para o contador do Início.
import { addDays, daysUntil } from './availability.logic';
import { Trip, lastDayOf } from './trips.logic';

export type MeetingPlace = 'porto' | 'madrid' | 'other';

export interface Meeting {
  id: string;
  startDate: string;
  endDate: string | null;
  place: MeetingPlace;
  note: string | null;
  createdBy: string | null;
}

export interface MeetingRow {
  id: string;
  start_date: string;
  end_date: string | null;
  at_place: MeetingPlace;
  note: string | null;
  created_by: string | null;
}

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    place: row.at_place,
    note: row.note,
    createdBy: row.created_by,
  };
}

/** Os dias de um encontro, no mesmo formato das datas de uma viagem (para a contagem e as datas escritas). */
export function meetingSpan(meeting: Pick<Meeting, 'startDate' | 'endDate'>): Pick<Trip, 'startDate' | 'endDate' | 'datePrecision'> {
  return { startDate: meeting.startDate, endDate: meeting.endDate, datePrecision: 'day' };
}

/** Os encontros que ainda não acabaram (hoje ainda conta), do mais próximo para o mais distante. */
export function upcomingMeetings(meetings: readonly Meeting[], today: string): Meeting[] {
  return meetings
    .filter((meeting) => lastDayOf(meetingSpan(meeting)) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}

export type NextEncounter = { kind: 'meeting'; meeting: Meeting } | { kind: 'trip'; trip: Trip };

/**
 * O próximo momento em que os dois estão juntos: o que está a decorrer, ou senão o que começa primeiro,
 * entre os encontros e a viagem ativa (só se as datas dela já estiverem confirmadas). Sem nada, null.
 */
export function nextEncounter(meetings: readonly Meeting[], trip: Trip | null, today: string): NextEncounter | null {
  const candidates: { start: string; value: NextEncounter }[] = upcomingMeetings(meetings, today).map((meeting) => ({
    start: meeting.startDate,
    value: { kind: 'meeting', meeting },
  }));
  if (trip && trip.datesConfirmed && lastDayOf(trip) >= today) {
    candidates.push({ start: trip.startDate, value: { kind: 'trip', trip } });
  }
  if (!candidates.length) return null;
  // Ao empatar, a viagem ganha (é o que se quer destacar).
  candidates.sort((a, b) => a.start.localeCompare(b.start) || (a.value.kind === 'trip' ? -1 : 1));
  const ongoing = candidates.find((candidate) => candidate.start <= today);
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
