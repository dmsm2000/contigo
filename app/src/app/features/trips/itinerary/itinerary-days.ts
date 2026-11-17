/** Quantos dias tem uma viagem de `start` a `end` (os dois contam). */
export function daysBetween(start: string, end: string): number {
  const toMs = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.max(1, Math.round((toMs(end) - toMs(start)) / 86_400_000) + 1);
}
