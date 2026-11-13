// Lógica pura do mapa: sem Angular nem MapLibre, para se testar facilmente.
import { initialOf, tileColors, Trip } from './trips.logic';

export type LngLat = [number, number];

/** Um pin no mapa: um sítio, mesmo que tenhamos lá estado mais do que uma vez. */
export interface MapPin {
  placeId: string;
  name: string;
  initial: string;
  lng: number;
  lat: number;
  /** Quantas viagens a este sítio. */
  trips: number;
  /** A viagem mais recente, que é a que se abre ao tocar no pin. */
  latestTripId: string;
  colors: { from: string; to: string };
}

export interface PinSummary {
  pins: MapPin[];
  /** Sítios guardados só com o nome, que não têm onde ficar no mapa. */
  withoutLocation: number;
}

/** Agrupa as viagens por sítio. Cada sítio com coordenadas vira um pin. */
export function pinsFromTrips(trips: readonly Trip[]): PinSummary {
  const pins = new Map<string, MapPin>();
  const latestDate = new Map<string, string>();
  const unplaced = new Set<string>();

  for (const trip of trips) {
    const { place } = trip;
    if (place.lat === null || place.lng === null) {
      unplaced.add(place.id);
      continue;
    }
    const existing = pins.get(place.id);
    if (!existing) {
      pins.set(place.id, {
        placeId: place.id,
        name: place.name,
        initial: initialOf(place.name),
        lng: place.lng,
        lat: place.lat,
        trips: 1,
        latestTripId: trip.id,
        colors: tileColors(place.name),
      });
      latestDate.set(place.id, trip.startDate);
      continue;
    }
    existing.trips += 1;
    // A lista pode não vir ordenada: fica sempre a viagem com a data mais recente.
    if (trip.startDate > (latestDate.get(place.id) ?? '')) {
      latestDate.set(place.id, trip.startDate);
      existing.latestTripId = trip.id;
    }
  }
  return { pins: [...pins.values()], withoutLocation: unplaced.size };
}

/** O retângulo mínimo que contém todos os pontos, ou nulo se não houver nenhum. */
export function boundsOf(points: readonly LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/**
 * Uma linha curva entre dois pontos (uma curva de Bézier), para a "raia" entre o Porto e Madrid
 * não ser uma régua. `bend` é o quanto a curva sobe, em fração da distância; positivo curva para norte.
 */
export function curve(from: LngLat, to: LngLat, steps = 32, bend = 0.18): LngLat[] {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  // A perpendicular à linha, virada para cima (norte).
  let px = -dy / length;
  let py = dx / length;
  if (py < 0) {
    px = -px;
    py = -py;
  }
  const cx = (x0 + x1) / 2 + px * length * bend;
  const cy = (y0 + y1) / 2 + py * length * bend;
  const points: LngLat[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const u = 1 - t;
    points.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return points;
}
