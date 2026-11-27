// As novidades: o que o outro foi fazendo na app. Lógica pura (sem Angular nem rede) para se testar facilmente.

export interface ActivityRow {
  id: string;
  actor: string | null;
  kind: string;
  trip_id: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  actor: string | null;
  kind: string;
  tripId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export function toActivity(row: ActivityRow): ActivityItem {
  return { id: row.id, actor: row.actor, kind: row.kind, tripId: row.trip_id, data: row.data ?? {}, createdAt: row.created_at };
}

/** Os tipos de novidade que se juntam quando acontecem seguidos ("registou 3 despesas"). */
const MERGEABLE = new Set(['expense', 'photo_added', 'doc_added', 'note_added']);
/** Quanto tempo no máximo entre duas novidades iguais para ficarem numa só. */
const MERGE_WINDOW_MS = 30 * 60_000;

export interface ActivityEntry {
  /** A mais recente das juntas (para a hora e o destino). */
  latest: ActivityItem;
  items: ActivityItem[];
  count: number;
  /** Nas despesas, o total. */
  total: number | null;
}

function amountOf(item: ActivityItem): number {
  return Number(item.data['amount'] ?? 0) || 0;
}

/** Junta as novidades iguais, do mesmo autor e da mesma viagem, que aconteceram seguidas. Entra e sai do mais recente para o mais antigo. */
export function collapse(items: readonly ActivityItem[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const item of items) {
    const last = entries[entries.length - 1];
    const same =
      last &&
      MERGEABLE.has(item.kind) &&
      last.latest.kind === item.kind &&
      last.latest.actor === item.actor &&
      last.latest.tripId === item.tripId &&
      Date.parse(last.items[last.items.length - 1].createdAt) - Date.parse(item.createdAt) <= MERGE_WINDOW_MS;
    if (same) {
      last.items.push(item);
      last.count++;
      if (last.total !== null) last.total = Math.round((last.total + amountOf(item)) * 100) / 100;
    } else {
      entries.push({ latest: item, items: [item], count: 1, total: item.kind === 'expense' ? amountOf(item) : null });
    }
  }
  return entries;
}

/** Só conta o que o outro fez, e que é mais recente do que a última vez que se leu. */
export function isUnread(item: Pick<ActivityItem, 'actor' | 'createdAt'>, me: string | null, readAt: string | null): boolean {
  if (!me || item.actor === me) return false;
  return !readAt || item.createdAt > readAt;
}

export function unreadCount(items: readonly ActivityItem[], me: string | null, readAt: string | null): number {
  return items.filter((item) => isUnread(item, me, readAt)).length;
}

export type ActivityTarget = { type: 'trip'; tripId: string } | { type: 'page'; path: string } | null;

const PAGE_OF: Record<string, string> = {
  deposit: '/expenses',
  meeting_added: '/availability',
  meeting_cancelled: '/availability',
  wish_added: '/wishlist',
  idea_added: '/ideas',
};

/** Para onde leva tocar na novidade: a viagem, ou a página onde a coisa vive. */
export function targetOf(item: Pick<ActivityItem, 'kind' | 'tripId'>): ActivityTarget {
  if (PAGE_OF[item.kind]) return { type: 'page', path: PAGE_OF[item.kind] };
  if (item.kind === 'expense') return item.tripId ? { type: 'trip', tripId: item.tripId } : { type: 'page', path: '/expenses' };
  return item.tripId ? { type: 'trip', tripId: item.tripId } : null;
}

const ICONS: Record<string, string> = {
  expense: 'receipt-outline',
  deposit: 'cash-outline',
  meeting_added: 'heart-outline',
  meeting_cancelled: 'heart-dislike-outline',
  trip_planned: 'airplane-outline',
  trip_past: 'images-outline',
  trip_drawn: 'dice-outline',
  trip_status: 'flag-outline',
  trip_dates: 'calendar-outline',
  stay_added: 'bed-outline',
  stay_chosen: 'bed-outline',
  leg_added: 'navigate-outline',
  leg_chosen: 'navigate-outline',
  plan_approved: 'checkmark-circle-outline',
  itinerary_accepted: 'map-outline',
  itinerary_draft: 'map-outline',
  doc_added: 'document-text-outline',
  note_added: 'create-outline',
  photo_added: 'camera-outline',
  wish_added: 'heart-outline',
  idea_added: 'bulb-outline',
};

export function iconOf(kind: string): string {
  return ICONS[kind] ?? 'sparkles-outline';
}

/** A chave do texto: as que se juntam têm uma forma no singular e outra no plural. */
export function messageKey(entry: ActivityEntry): string {
  const kind = entry.latest.kind;
  return `activity.kind.${kind}${MERGEABLE.has(kind) ? (entry.count > 1 ? '_other' : '_one') : ''}`;
}

/** O dia ("2026-11-30") de um instante, no relógio do telemóvel. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface ActivityDay {
  day: string;
  entries: ActivityEntry[];
}

/** As novidades agrupadas por dia, a mais recente primeiro. */
export function groupByDay(entries: readonly ActivityEntry[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const day = dayKey(entry.latest.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}
