// Lógica pura do roteiro de uma viagem: o pedido que se cola num chat, a leitura (e validação) da resposta em JSON,
// o agrupamento por dia e os custos por categoria do orçamento. Sem Angular nem rede, para se testar facilmente.
import { addDays } from './availability.logic';
import { ExpenseCategory } from './expenses.logic';
import { Lang } from './trips.logic';

export const ITINERARY_CATEGORIES = ['see', 'eat', 'do', 'move', 'rest', 'other'] as const;
export type ItineraryCategory = (typeof ITINERARY_CATEGORIES)[number];
export type ItineraryStatus = 'draft' | 'accepted';

export interface ItineraryItem {
  id: string;
  itineraryId: string;
  tripId: string;
  day: number;
  position: number;
  startTime: string | null;
  endTime: string | null;
  title: string;
  category: ItineraryCategory;
  description: string | null;
  placeName: string | null;
  address: string | null;
  /** Estimativa por pessoa, em euros. */
  costEur: number | null;
  booking: string | null;
  link: string | null;
  tip: string | null;
}

export interface Itinerary {
  id: string;
  tripId: string;
  status: ItineraryStatus;
  summary: string | null;
  tips: string[];
  createdAt: string;
  items: ItineraryItem[];
}

export interface ItineraryRow {
  id: string;
  trip_id: string;
  status: ItineraryStatus;
  summary: string | null;
  tips: string[] | null;
  created_at: string;
}

export interface ItineraryItemRow {
  id: string;
  itinerary_id: string;
  trip_id: string;
  day: number;
  position: number;
  start_time: string | null;
  end_time: string | null;
  title: string;
  category: ItineraryCategory;
  description: string | null;
  place_name: string | null;
  address: string | null;
  cost_eur: number | string | null;
  booking: string | null;
  link: string | null;
  tip: string | null;
}

/** O que se guarda de cada atividade (o resto — ids — dá-os a base de dados). */
export type DraftItem = Omit<ItineraryItem, 'id' | 'itineraryId' | 'tripId'>;

export interface ParsedItinerary {
  summary: string | null;
  tips: string[];
  items: DraftItem[];
}

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);

export function toItineraryItem(row: ItineraryItemRow): ItineraryItem {
  return {
    id: row.id,
    itineraryId: row.itinerary_id,
    tripId: row.trip_id,
    day: row.day,
    position: row.position,
    startTime: hhmm(row.start_time),
    endTime: hhmm(row.end_time),
    title: row.title,
    category: row.category,
    description: row.description,
    placeName: row.place_name,
    address: row.address,
    costEur: row.cost_eur === null ? null : Number(row.cost_eur),
    booking: row.booking,
    link: row.link,
    tip: row.tip,
  };
}

export function toItinerary(row: ItineraryRow, items: ItineraryItem[]): Itinerary {
  return { id: row.id, tripId: row.trip_id, status: row.status, summary: row.summary, tips: row.tips ?? [], createdAt: row.created_at, items };
}

// ------------------------------------------------------------------ ler a resposta do chat

/** Um erro para mostrar: a chave da tradução e os valores a pôr nela. */
export interface ParseError {
  key: string;
  params?: Record<string, string | number>;
}

export type ParseResult = { ok: true; value: ParsedItinerary; skipped: number } | { ok: false; error: ParseError };

/** Como pode vir uma atividade: tudo opcional e sem tipo certo, é o que o chat escreveu. */
interface ActivityShape {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  category?: unknown;
  description?: unknown;
  place?: unknown;
  address?: unknown;
  cost_eur?: unknown;
  booking?: unknown;
  link?: unknown;
  tip?: unknown;
}

const MAX_DAYS = 30;
const MAX_ITEMS = 200;

/** O texto de um campo: aparado, sem passar do limite; vazio fica nulo. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const clean = String(value).trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, max) : null;
}

/** "9:00" e "09:00" dão "09:00"; o que não for uma hora válida dá nulo. */
function clock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2})[:h.](\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? `${String(hour).padStart(2, '0')}:${match[2]}` : null;
}

/** "12", 12, "12,50 €" e "~12.5" dão o número; o que não for número (ou for negativo) dá nulo. */
export function parseCost(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.min(10000, Math.round(value * 100) / 100) : null;
  if (typeof value !== 'string') return null;
  const match = /\d+(?:[.,]\d+)?/.exec(value.replace(/\s/g, ''));
  if (!match) return null;
  const number = Number(match[0].replace(',', '.'));
  return Number.isFinite(number) ? Math.min(10000, Math.round(number * 100) / 100) : null;
}

function category(value: unknown): ItineraryCategory {
  return typeof value === 'string' && (ITINERARY_CATEGORIES as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as ItineraryCategory)
    : 'other';
}

/** Só se guardam ligações http(s). */
function link(value: unknown): string | null {
  const url = text(value, 500);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** O JSON dentro da resposta do chat: pode vir com texto antes e depois ou dentro de um bloco ```json. */
function extractJson(source: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  const body = fenced ? fenced[1] : source;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Lê e valida a resposta do chat. Aceita o que dá para aproveitar (corrige horas, custos e categorias) e conta as
 * atividades que não se aproveitaram; só falha se não for JSON, não tiver dias ou não restar nenhuma atividade.
 */
export function parseItinerary(source: string): ParseResult {
  let data: unknown;
  try {
    data = extractJson(source);
  } catch {
    return { ok: false, error: { key: 'itinerary.errors.notJson' } };
  }
  const root = data as { summary?: unknown; tips?: unknown; days?: unknown };
  if (!root || typeof root !== 'object' || !Array.isArray(root.days) || !root.days.length) {
    return { ok: false, error: { key: 'itinerary.errors.noDays' } };
  }

  const items: DraftItem[] = [];
  let skipped = 0;
  root.days.slice(0, MAX_DAYS).forEach((rawDay: unknown, index: number) => {
    const day = rawDay as { day?: unknown; activities?: unknown };
    const number = Number.isInteger(day?.day) && (day.day as number) >= 1 && (day.day as number) <= 60 ? (day.day as number) : index + 1;
    const activities = Array.isArray(day?.activities) ? day.activities : [];
    const dayItems: DraftItem[] = [];
    for (const raw of activities) {
      const activity = (raw ?? {}) as ActivityShape;
      const title = text(activity?.title, 120);
      if (!title || items.length + dayItems.length >= MAX_ITEMS) {
        skipped += 1;
        continue;
      }
      dayItems.push({
        day: number,
        position: 0,
        startTime: clock(activity.start),
        endTime: clock(activity.end),
        title,
        category: category(activity.category),
        description: text(activity.description, 600),
        placeName: text(activity.place, 120),
        address: text(activity.address, 200),
        costEur: parseCost(activity.cost_eur),
        booking: text(activity.booking, 200),
        link: link(activity.link),
        tip: text(activity.tip, 300),
      });
    }
    // Dentro do dia, pela hora (o que não tem hora fica onde estava, depois do que a tem).
    const ordered = dayItems
      .map((item, order) => ({ item, order }))
      .sort((a, b) => (a.item.startTime ?? '99:99').localeCompare(b.item.startTime ?? '99:99') || a.order - b.order)
      .map(({ item }, position) => ({ ...item, position }));
    items.push(...ordered);
  });

  if (!items.length) return { ok: false, error: { key: 'itinerary.errors.noActivities' } };
  const tips = Array.isArray(root.tips) ? root.tips.map((tip) => text(tip, 300)).filter((tip): tip is string => !!tip).slice(0, 20) : [];
  return { ok: true, value: { summary: text(root.summary, 1000), tips, items }, skipped };
}

// ------------------------------------------------------------------ compor o pedido

export type Pace = 'relaxed' | 'balanced' | 'packed';

export interface RequestInput {
  /** "Salamanca, Castela e Leão, Espanha". */
  place: string;
  /** Datas fechadas, se houver. */
  startDate: string | null;
  endDate: string | null;
  /** Quantos dias, quando as datas ainda não estão fechadas. */
  days: number | null;
  people: number;
  /** Teto da viagem, em euros, para os dois. */
  budgetCap: number | null;
  origins: string[];
  stay: string | null;
  /** O que já queriam ver, fazer ou comer (da lista da viagem). */
  wishes: string[];
  pace: Pace;
  /** O que querem desta viagem, escrito à mão (o que mais pesa no roteiro). */
  notes: string;
  /** As notas do plano da viagem, se já escreveram alguma coisa. */
  planNote: string | null;
  language: Lang;
}

const LANGUAGE_NAME: Record<Lang, string> = { pt: 'português de Portugal', es: 'espanhol', en: 'inglês' };
const PACE_TEXT: Record<Pace, string> = {
  relaxed: 'calmo (poucas atividades por dia, com tempo para descansar e comer sem pressa)',
  balanced: 'equilibrado (uma manhã e uma tarde com programa, e tempo livre)',
  packed: 'intenso (aproveitar ao máximo cada dia)',
};

/** O formato exato que a app sabe ler. */
const SCHEMA = `{
  "summary": "Uma ou duas frases sobre a viagem.",
  "days": [
    {
      "day": 1,
      "activities": [
        {
          "start": "10:00",
          "end": "12:00",
          "title": "Nome curto da atividade",
          "category": "see",
          "description": "O que se faz e porque vale a pena.",
          "place": "Nome do sítio",
          "address": "Morada, se houver",
          "cost_eur": 12.5,
          "booking": "Reservar com antecedência / comprar bilhete online (só se for preciso)",
          "link": "https://… (só se tiveres a certeza)",
          "tip": "Uma dica útil."
        }
      ]
    }
  ],
  "tips": ["Dica geral 1", "Dica geral 2"]
}`;

/** O pedido completo, pronto a colar num chat. */
export function buildRequest(input: RequestInput): string {
  const when =
    input.startDate && input.endDate
      ? `de ${input.startDate} a ${input.endDate}`
      : input.days
        ? `${input.days} dias (datas ainda por fechar)`
        : 'datas ainda por fechar (propõe 3 dias)';
  const lines = [
    `Quero um roteiro de viagem para ${input.place}.`,
    '',
    'O que sabes:',
    `- Quando: ${when}.`,
    `- Quem: ${input.people} pessoas (um casal).`,
    `- Ritmo: ${PACE_TEXT[input.pace]}.`,
  ];
  if (input.budgetCap !== null) lines.push(`- Orçamento: até ${input.budgetCap} € no total para os dois, tudo incluído.`);
  if (input.origins.length) lines.push(`- Partimos de: ${input.origins.join(' e ')}.`);
  if (input.stay) lines.push(`- Alojamento: ${input.stay}.`);
  if (input.wishes.length) lines.push(`- Já queríamos incluir: ${input.wishes.join('; ')}.`);
  if (input.notes.trim()) {
    lines.push('', 'O que queremos desta viagem (é o mais importante: o roteiro tem de ir ao encontro disto):', input.notes.trim());
  }
  if (input.planNote?.trim()) lines.push('', 'Notas que já temos sobre esta viagem:', input.planNote.trim().slice(0, 1500));
  lines.push(
    '',
    'Regras:',
    `- Escreve os textos em ${LANGUAGE_NAME[input.language]}.`,
    '- Usa o dia 1, 2, 3… (não datas). Dentro de cada dia, as atividades por ordem de hora, com refeições, deslocações e descanso.',
    '- Os custos (cost_eur) são por pessoa, em euros, estimados de forma realista. Usa null quando não tiveres ideia; não inventes preços.',
    '- "category" é uma destas: see (ver), eat (comer), do (fazer), move (deslocação), rest (descanso), other.',
    '- Só põe link ou morada quando tiveres a certeza. Se pesquisares na web, confirma horários e preços atuais.',
    '- Responde só com um bloco de código JSON neste formato exato, sem mais nada:',
    '',
    '```json',
    SCHEMA,
    '```',
  );
  return lines.join('\n');
}

// ------------------------------------------------------------------ mostrar e somar

export interface DayGroup {
  day: number;
  items: ItineraryItem[];
}

export function groupByDay(items: readonly ItineraryItem[]): DayGroup[] {
  const days = new Map<number, ItineraryItem[]>();
  for (const item of items) days.set(item.day, [...(days.get(item.day) ?? []), item]);
  return [...days.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, list]) => ({ day, items: list.sort((a, b) => a.position - b.position) }));
}

/** A data do dia N da viagem, se se sabe quando começa. */
export function dayDate(startDate: string | null, day: number): string | null {
  return startDate ? addDays(startDate, day - 1) : null;
}

export interface CostSummary {
  /** Por categoria do orçamento, por pessoa. */
  byCategory: Partial<Record<ExpenseCategory, number>>;
  /** O total por pessoa. */
  total: number;
  /** Quantas atividades não têm custo estimado (para avisar). */
  unpriced: number;
}

const BUDGET_CATEGORY: Record<ItineraryCategory, ExpenseCategory> = {
  eat: 'food',
  see: 'activities',
  do: 'activities',
  move: 'transport',
  rest: 'other',
  other: 'other',
};

export function budgetCategoryOf(category: ItineraryCategory): ExpenseCategory {
  return BUDGET_CATEGORY[category];
}

export function costSummary(items: readonly ItineraryItem[]): CostSummary {
  const byCategory: Partial<Record<ExpenseCategory, number>> = {};
  let total = 0;
  let unpriced = 0;
  for (const item of items) {
    if (item.costEur === null) {
      unpriced += 1;
      continue;
    }
    const key = BUDGET_CATEGORY[item.category];
    byCategory[key] = Math.round(((byCategory[key] ?? 0) + item.costEur) * 100) / 100;
    total = Math.round((total + item.costEur) * 100) / 100;
  }
  return { byCategory, total, unpriced };
}
