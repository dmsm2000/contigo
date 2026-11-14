// Lógica pura das "histórias" do Início: sem Angular, para se testar facilmente.

/** Um ecrã de uma história: uma foto da viagem, ou o cartão com o texto (quando não há fotos ou há nota). */
export type StorySlide = { kind: 'photo'; photoId: string } | { kind: 'card' };

/** Onde se está: que viagem (grupo) e que ecrã dentro dela. */
export interface StoryPosition {
  group: number;
  slide: number;
}

/** Os ecrãs de uma viagem: primeiro as fotos; o cartão fecha se houver nota e é o único se não houver fotos. */
export function buildSlides(photoIds: readonly string[], hasNote: boolean): StorySlide[] {
  const slides: StorySlide[] = photoIds.map((photoId) => ({ kind: 'photo', photoId }));
  if (!slides.length || hasNote) slides.push({ kind: 'card' });
  return slides;
}

/** O ecrã a seguir: passa à viagem seguinte no fim de uma; nulo no fim de todas (a história fecha). */
export function nextPosition(at: StoryPosition, slideCounts: readonly number[]): StoryPosition | null {
  if (at.slide + 1 < (slideCounts[at.group] ?? 0)) return { group: at.group, slide: at.slide + 1 };
  if (at.group + 1 < slideCounts.length) return { group: at.group + 1, slide: 0 };
  return null;
}

/** O ecrã anterior: volta ao último ecrã da viagem anterior; no primeiro de todos, fica onde está. */
export function previousPosition(at: StoryPosition, slideCounts: readonly number[]): StoryPosition {
  if (at.slide > 0) return { group: at.group, slide: at.slide - 1 };
  if (at.group > 0) return { group: at.group - 1, slide: 0 };
  return at;
}

/** Tocar no terço esquerdo volta, no resto avança (como no Instagram). */
export function tapAction(x: number, width: number): 'previous' | 'next' {
  return x < width / 3 ? 'previous' : 'next';
}

/** As viagens já vistas, guardadas no telemóvel (só uma comodidade: o anel da história fica cinzento). */
const SEEN_KEY = 'contigo.storiesSeen';

export function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeSeen(seen: ReadonlySet<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    // Sem armazenamento (janela privada): perde-se só o anel cinzento.
  }
}
