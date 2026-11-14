import { describe, expect, it } from 'vitest';
import { boundsOf, Box, clusterPoints, curve, LngLat, pinsFromTrips, visibleLabels } from './map.logic';
import { Place, Trip } from './trips.logic';

const place = (id: string, name: string, coords: [number, number] | null): Place => ({
  id,
  name,
  admin1: null,
  countryCode: 'PT',
  lng: coords ? coords[0] : null,
  lat: coords ? coords[1] : null,
  osmRef: null,
});

const trip = (id: string, p: Place, startDate: string): Trip => ({
  id,
  placeId: p.id,
  status: 'past',
  startDate,
  endDate: null,
  datePrecision: 'month',
  withPartner: true,
  wouldReturn: null,
  costEur: null,
  note: null,
  drawEntry: null,
  createdBy: null,
  createdAt: '2026-11-13T18:00:00Z',
  updatedBy: null,
  updatedAt: '2026-11-13T18:00:00Z',
  place: p,
});

describe('pinsFromTrips', () => {
  const braga = place('p1', 'Braga', [-8.428, 41.551]);
  const aveiro = place('p2', 'Aveiro', [-8.65, 40.64]);
  const soNome = place('p3', 'Um sítio sem localização', null);

  it('faz um pin por sítio com coordenadas', () => {
    const { pins, withoutLocation } = pinsFromTrips([trip('t1', braga, '2026-10-01'), trip('t2', aveiro, '2026-09-01')]);
    expect(pins.map((pin) => pin.name)).toEqual(['Braga', 'Aveiro']);
    expect(withoutLocation).toBe(0);
    expect(pins[0]).toMatchObject({ lng: -8.428, lat: 41.551, trips: 1, initial: 'B', latestTripId: 't1' });
  });

  it('junta as viagens ao mesmo sítio num só pin e conta-as', () => {
    const { pins } = pinsFromTrips([trip('t1', braga, '2026-10-01'), trip('t2', braga, '2025-03-01')]);
    expect(pins).toHaveLength(1);
    expect(pins[0].trips).toBe(2);
  });

  it('o pin aponta para a viagem mais recente, mesmo com a lista fora de ordem', () => {
    const { pins } = pinsFromTrips([trip('antiga', braga, '2024-05-01'), trip('recente', braga, '2026-10-01'), trip('meio', braga, '2025-08-01')]);
    expect(pins[0].latestTripId).toBe('recente');
  });

  it('põe de lado os sítios sem coordenadas e conta-os uma vez cada', () => {
    const { pins, withoutLocation } = pinsFromTrips([trip('t1', soNome, '2026-10-01'), trip('t2', soNome, '2026-08-01'), trip('t3', braga, '2026-07-01')]);
    expect(pins).toHaveLength(1);
    expect(withoutLocation).toBe(1);
  });

  it('sem viagens não há pins', () => {
    expect(pinsFromTrips([])).toEqual({ pins: [], withoutLocation: 0 });
  });

  it('dá sempre a mesma cor ao mesmo sítio', () => {
    const a = pinsFromTrips([trip('t1', braga, '2026-10-01')]).pins[0].colors;
    const b = pinsFromTrips([trip('t2', braga, '2025-01-01')]).pins[0].colors;
    expect(a).toEqual(b);
  });
});

describe('boundsOf', () => {
  it('devolve o retângulo que contém os pontos', () => {
    const points: LngLat[] = [
      [-8.6, 41.1],
      [-3.7, 40.4],
      [-6, 42],
    ];
    expect(boundsOf(points)).toEqual([
      [-8.6, 40.4],
      [-3.7, 42],
    ]);
  });

  it('um só ponto dá um retângulo de tamanho zero', () => {
    expect(boundsOf([[-8, 41]])).toEqual([
      [-8, 41],
      [-8, 41],
    ]);
  });

  it('sem pontos não há retângulo', () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe('curve', () => {
  const porto: LngLat = [-8.611, 41.15];
  const madrid: LngLat = [-3.704, 40.417];

  it('começa e acaba nos pontos pedidos', () => {
    const line = curve(porto, madrid, 20);
    expect(line).toHaveLength(21);
    expect(line[0]).toEqual(porto);
    expect(line[20][0]).toBeCloseTo(madrid[0], 10);
    expect(line[20][1]).toBeCloseTo(madrid[1], 10);
  });

  it('curva para norte, sem passar abaixo da linha reta', () => {
    const line = curve(porto, madrid, 20);
    const middle = line[10];
    const straightMiddleLat = (porto[1] + madrid[1]) / 2;
    expect(middle[1]).toBeGreaterThan(straightMiddleLat);
  });

  it('com dobra zero é uma linha reta', () => {
    const line = curve(porto, madrid, 4, 0);
    expect(line[2][0]).toBeCloseTo((porto[0] + madrid[0]) / 2, 10);
    expect(line[2][1]).toBeCloseTo((porto[1] + madrid[1]) / 2, 10);
  });

  it('curva para norte também quando se vai de Madrid para o Porto', () => {
    const line = curve(madrid, porto, 20);
    expect(line[10][1]).toBeGreaterThan((porto[1] + madrid[1]) / 2);
  });
});

describe('visibleLabels', () => {
  const box = (left: number, top: number, width: number, height = 20): Box => ({ left, top, right: left + width, bottom: top + height });

  it('mostra os nomes que não se tocam', () => {
    const visible = visibleLabels([], [
      { id: 'a', priority: 1, box: box(0, 0, 80) },
      { id: 'b', priority: 1, box: box(200, 0, 80) },
    ]);
    expect([...visible].sort()).toEqual(['a', 'b']);
  });

  it('quando dois nomes se tapam, fica o mais importante', () => {
    const visible = visibleLabels([], [
      { id: 'por-ir', priority: 2, box: box(0, 0, 120) },
      { id: 'casa', priority: 0, box: box(60, 5, 80) },
    ]);
    expect([...visible]).toEqual(['casa']);
  });

  it('com a mesma importância, fica o primeiro', () => {
    const visible = visibleLabels([], [
      { id: 'primeiro', priority: 1, box: box(0, 0, 120) },
      { id: 'segundo', priority: 1, box: box(100, 0, 120) },
    ]);
    expect([...visible]).toEqual(['primeiro']);
  });

  it('um nome nunca tapa um pin', () => {
    const visible = visibleLabels([box(50, 0, 40, 40)], [{ id: 'a', priority: 0, box: box(0, 10, 120) }]);
    expect(visible.size).toBe(0);
  });

  it('deixa uma pequena folga entre nomes', () => {
    const visible = visibleLabels([], [
      { id: 'a', priority: 1, box: box(0, 0, 100) },
      { id: 'b', priority: 1, box: box(101, 0, 100) },
    ], 3);
    expect([...visible]).toEqual(['a']);
  });
});

describe('clusterPoints', () => {
  it('junta pontos próximos e deixa os afastados sozinhos', () => {
    const groups = clusterPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 20, y: 10 },
        { id: 'c', x: 300, y: 300 },
      ],
      40,
    );
    expect(groups).toEqual([['a', 'b'], ['c']]);
  });

  it('une em cadeia: quem está perto de um membro entra no grupo', () => {
    const groups = clusterPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 35, y: 0 },
        { id: 'c', x: 70, y: 0 },
      ],
      40,
    );
    expect(groups).toEqual([['a', 'b', 'c']]);
  });

  it('sem pontos não há grupos', () => {
    expect(clusterPoints([], 40)).toEqual([]);
  });
});
