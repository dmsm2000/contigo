import { Injectable, isDevMode } from '@angular/core';

const KEY = 'contigo.devNow';

/** "2026-12-03T15:20" ou "2026-12-03 15:20" dão o instante local, em ms; o que não for uma data e hora válidas dá nulo. */
export function parseDevNow(value: string | null): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  // Uma data impossível (30 de fevereiro) salta para o mês seguinte: não vale.
  return date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null;
}

function readOffset(): number {
  try {
    const param = new URLSearchParams(location.search).get('now');
    if (param === 'off') {
      sessionStorage.removeItem(KEY);
      return 0;
    }
    const target = parseDevNow(param);
    if (target !== null) {
      const offset = target - Date.now();
      sessionStorage.setItem(KEY, String(offset));
      return offset;
    }
    const saved = Number(sessionStorage.getItem(KEY));
    return Number.isFinite(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

/**
 * O relógio da app. Em produção é o relógio real. No desenvolvimento (e só aí) dá para simular outra hora com
 * `?now=2026-12-03T15:20` no endereço, para ver a viagem em curso sem esperar pelo dia: a hora simulada continua
 * a andar, fica guardada durante a sessão e `?now=off` volta à real.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  /** Quanto o relógio simulado está à frente do real (ms); 0 quando não há simulação. */
  readonly offsetMs = isDevMode() ? readOffset() : 0;

  /** O instante (simulado, se for o caso) que corresponde ao instante real `realMs`. */
  at(realMs: number): Date {
    return new Date(realMs + this.offsetMs);
  }
}
