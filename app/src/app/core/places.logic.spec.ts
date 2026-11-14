import { describe, expect, it } from 'vitest';
import { findSamePlace } from './places.logic';

const braga = { name: 'Braga', osm_ref: 'R4115866', lat: 41.55, lng: -8.42 };

describe('findSamePlace', () => {
  it('reconhece o mesmo sítio vindo de outra fonte', () => {
    expect(findSamePlace({ name: 'braga', lat: 41.5503, lng: -8.4201 }, [braga])).toBe(braga);
  });

  it('ignora acentos e maiúsculas', () => {
    const coimbra = { name: 'Coimbra', osm_ref: null, lat: 40.2, lng: -8.4 };
    expect(findSamePlace({ name: 'CÓIMBRA', lat: 40.21, lng: -8.41 }, [coimbra])).toBe(coimbra);
  });

  it('um sítio com o mesmo nome mas longe é outro (Madrid na Colômbia)', () => {
    expect(findSamePlace({ name: 'Braga', lat: 4.7, lng: -74.3 }, [braga])).toBeNull();
  });

  it('sem coordenadas não arrisca juntar', () => {
    expect(findSamePlace({ name: 'Braga', lat: null, lng: null }, [braga])).toBeNull();
  });
});
