// Ligações (endereços web) que se colam em notas, listas e ideias: encontram-se no texto para poderem abrir-se com um toque.
// Lógica pura, sem Angular, para se testar facilmente.

/** Um endereço começado por http(s):// ou www., até ao primeiro espaço. */
const LINK = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;

/** Quantas ligações se mostram de um texto (as outras abrem-se a partir do próprio texto, ao editar). */
export const MAX_LINKS = 4;

/** Tira a pontuação que acompanha o endereço no texto ("vê https://x.pt/a, e depois…") e fica só o endereço. */
function trimTrailing(url: string): { link: string; rest: string } {
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1];
    if (/[.,;:!?'"\]}]/.test(last)) end--;
    // Um ")" só faz parte do endereço se houver um "(" antes dele (como em /wiki/Foo_(bar)).
    else if (last === ')' && count(url.slice(0, end), ')') > count(url.slice(0, end), '(')) end--;
    else break;
  }
  return { link: url.slice(0, end), rest: url.slice(end) };
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

/** "www.booking.com/x" passa a "https://www.booking.com/x" (para o browser o abrir); os outros ficam como estão. */
function normalize(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

/** As ligações de um texto, sem repetidas e pela ordem em que aparecem (no máximo {@link MAX_LINKS}). */
export function extractLinks(text: string | null | undefined, max = MAX_LINKS): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const match of text.match(LINK) ?? []) {
    const { link } = trimTrailing(match);
    // "www." sozinho (ou "http://" sem mais nada) não é um endereço.
    if (!/[^/.:]/.test(link.replace(/^(?:https?:\/\/|www\.)/i, ''))) continue;
    const url = normalize(link);
    if (!found.includes(url)) found.push(url);
    if (found.length >= max) break;
  }
  return found;
}

/** O nome do site de uma ligação: "https://www.booking.com/hotel/x" dá "booking.com". */
export function linkHost(url: string): string {
  try {
    return new URL(normalize(url)).hostname.replace(/^www\./i, '') || url;
  } catch {
    return url;
  }
}

/** O texto com cada ligação trocada pelo nome do site, para não aparecerem endereços compridos no meio das frases. */
export function shortenLinks(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(LINK, (match) => {
    const { link, rest } = trimTrailing(match);
    return /[^/.:]/.test(link.replace(/^(?:https?:\/\/|www\.)/i, ''))
      ? `${linkHost(link)}${rest}`
      : match;
  });
}
