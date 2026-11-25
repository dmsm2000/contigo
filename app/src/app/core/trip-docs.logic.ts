// Documentos da viagem: post-its com informação importante e ficheiros (bilhetes, reservas, seguros…).

export const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'orange'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_MAX = 600;
export const DOC_NAME_MAX = 120;
export const DOC_NOTE_MAX = 300;
/** O mesmo limite do bucket: 10 MB por ficheiro. */
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

/** O que se aceita: PDF e imagens (os bilhetes costumam ser um ou outro). */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export interface NoteRow {
  id: string;
  trip_id: string;
  body: string;
  color: string;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TripNote {
  id: string;
  tripId: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface DocRow {
  id: string;
  trip_id: string;
  path: string;
  name: string;
  mime: string;
  size_bytes: number;
  note: string | null;
  leg_id?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TripDoc {
  id: string;
  tripId: string;
  path: string;
  name: string;
  mime: string;
  sizeBytes: number;
  note: string | null;
  /** A deslocação a que o documento pertence (o bilhete da ida, por exemplo). */
  legId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function toNote(row: NoteRow): TripNote {
  return {
    id: row.id,
    tripId: row.trip_id,
    body: row.body,
    color: (NOTE_COLORS as readonly string[]).includes(row.color) ? (row.color as NoteColor) : 'yellow',
    pinned: row.pinned,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toDoc(row: DocRow): TripDoc {
  return {
    id: row.id,
    tripId: row.trip_id,
    path: row.path,
    name: row.name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    note: row.note,
    legId: row.leg_id ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Os post-its fixados primeiro; dentro de cada grupo, pela ordem em que foram escritos. */
export function sortNotes(notes: readonly TripNote[]): TripNote[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));
}

/** A cor do post-it seguinte, para os novos não saírem todos amarelos. */
export function nextColor(count: number): NoteColor {
  return NOTE_COLORS[count % NOTE_COLORS.length];
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** O tipo do ficheiro; alguns telemóveis (HEIC, por exemplo) não o dizem, e então vê-se pela extensão. */
export function mimeOf(file: { type: string; name: string }): string | null {
  const type = file.type.toLowerCase();
  if (type in EXTENSION_BY_MIME) return type;
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? null;
}

export type DocCheck = 'ok' | 'empty' | 'tooBig' | 'unsupported';

export function checkDoc(file: { size: number; type: string; name: string }): DocCheck {
  if (!mimeOf(file)) return 'unsupported';
  if (file.size <= 0) return 'empty';
  if (file.size > MAX_DOC_BYTES) return 'tooBig';
  return 'ok';
}

/** Onde fica no bucket: "<viagem>/<documento>.<extensão>" (o nome verdadeiro fica na tabela). */
export function docPath(tripId: string, id: string, mime: string): string {
  return `${tripId}/${id}.${EXTENSION_BY_MIME[mime] ?? 'bin'}`;
}

/** "Bilhete Porto-Madrid.pdf" vira "Bilhete Porto-Madrid", sem passar do limite. */
export function nameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).replace(/[_]+/g, ' ').trim();
  return (base || 'Documento').slice(0, DOC_NAME_MAX);
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

/** "180 KB", "2,4 MB". */
export function formatSize(bytes: number, locale = 'pt-PT'): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}
