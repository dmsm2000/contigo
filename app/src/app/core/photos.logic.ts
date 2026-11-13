// Lógica pura das fotos das viagens: sem Angular, sem rede e sem o browser, para se testar facilmente.

/** O lado maior da foto que se guarda (e se mostra em ecrã inteiro). */
export const FULL_SIDE = 1600;
/** O lado maior da miniatura (grelhas, capas e histórias). */
export const THUMB_SIDE = 400;
/** Quanto pesa, no máximo, a foto guardada: se passar, comprime-se mais. */
export const TARGET_BYTES = 300 * 1024;
/** A qualidade JPEG, da primeira tentativa à última. */
export const QUALITY_STEPS: readonly number[] = [0.82, 0.72, 0.62, 0.5, 0.4];
/** O maior ficheiro que se aceita escolher (uma foto de telemóvel tem 3 a 12 MB). */
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
export const MAX_CAPTION_LENGTH = 200;

export interface PhotoRow {
  id: string;
  trip_id: string;
  user_id: string | null;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  tripId: string;
  userId: string | null;
  path: string;
  thumbPath: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: string;
}

export function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    path: row.path,
    thumbPath: row.thumb_path,
    width: row.width,
    height: row.height,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

/** As medidas que cabem num quadrado de `max` pixels, sem deformar e sem ampliar. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Onde ficam no bucket: uma pasta por viagem. */
export function photoPaths(tripId: string, photoId: string): { path: string; thumbPath: string } {
  return { path: `${tripId}/${photoId}.jpg`, thumbPath: `${tripId}/${photoId}_t.jpg` };
}

export type FileCheck = 'ok' | 'notImage' | 'tooBig';

const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i;

/** Se um ficheiro escolhido serve: tem de ser uma imagem e não pode ser enorme. */
export function checkFile(file: { type: string; name: string; size: number }): FileCheck {
  const looksLikeImage = file.type.startsWith('image/') || (!file.type && IMAGE_NAME.test(file.name));
  if (!looksLikeImage) return 'notImage';
  return file.size > MAX_INPUT_BYTES ? 'tooBig' : 'ok';
}

/** Do mais antigo para o mais recente: é a ordem em que as fotos foram acrescentadas. */
export function sortPhotos(photos: readonly Photo[]): Photo[] {
  return [...photos].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function groupByTrip(photos: readonly Photo[]): Map<string, Photo[]> {
  const groups = new Map<string, Photo[]>();
  for (const photo of sortPhotos(photos)) {
    const group = groups.get(photo.tripId);
    if (group) group.push(photo);
    else groups.set(photo.tripId, [photo]);
  }
  return groups;
}

/** A capa de uma viagem é a primeira foto que lhe juntaram. */
export function coverOf(photos: readonly Photo[]): Photo | null {
  return sortPhotos(photos)[0] ?? null;
}

/** Prepara uma legenda: vazia → null, passa do limite → 'tooLong'. */
export function cleanCaption(input: string): string | null | 'tooLong' {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > MAX_CAPTION_LENGTH ? 'tooLong' : text;
}

/** Os blocos de dois em dois, para o envio não abrir dezenas de ligações ao mesmo tempo. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
