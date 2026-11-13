import { describe, expect, it } from 'vitest';
import { mapPhoton } from './geocoder';

const feature = (properties: Record<string, unknown>, coordinates: number[] = [-8.428, 41.551]) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties,
});

describe('mapPhoton', () => {
  it('fica com a cidade e põe de lado paragens de comboio', () => {
    const json = {
      features: [
        feature({ osm_type: 'R', osm_id: 4115866, osm_key: 'place', osm_value: 'city', name: 'Braga', county: 'Braga', countrycode: 'PT' }),
        feature({ osm_type: 'N', osm_id: 1, osm_key: 'railway', osm_value: 'station', name: 'Braga', countrycode: 'PT' }, [-8.434, 41.548]),
        feature({ osm_type: 'N', osm_id: 2, osm_key: 'railway', osm_value: 'stop', name: 'Braga', countrycode: 'PT' }, [-8.434, 41.549]),
      ],
    };
    const result = mapPhoton(json);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      osmRef: 'R4115866',
      name: 'Braga',
      admin1: 'Braga',
      countryCode: 'PT',
      lat: 41.551,
      lng: -8.428,
    });
  });

  it('põe de lado regiões, países e fronteiras administrativas', () => {
    const json = {
      features: [
        feature({ osm_type: 'R', osm_id: 1, osm_key: 'place', osm_value: 'province', name: 'Salamanca', countrycode: 'ES' }),
        feature({ osm_type: 'R', osm_id: 2, osm_key: 'boundary', osm_value: 'administrative', name: 'Braga', countrycode: 'PT' }),
        feature({ osm_type: 'R', osm_id: 3, osm_key: 'place', osm_value: 'country', name: 'Portugal', countrycode: 'PT' }),
      ],
    };
    expect(mapPhoton(json)).toEqual([]);
  });

  it('aceita monumentos, natureza e locais de culto', () => {
    const json = {
      features: [
        feature({ osm_type: 'W', osm_id: 10, osm_key: 'landuse', osm_value: 'religious', name: 'Santuário do Bom Jesus do Monte', countrycode: 'PT' }),
        feature({ osm_type: 'N', osm_id: 11, osm_key: 'tourism', osm_value: 'viewpoint', name: 'Miradouro', countrycode: 'PT' }, [-8.6, 41.1]),
        feature({ osm_type: 'W', osm_id: 12, osm_key: 'amenity', osm_value: 'place_of_worship', name: 'Sé', countrycode: 'PT' }, [-8.5, 41.2]),
        feature({ osm_type: 'N', osm_id: 13, osm_key: 'amenity', osm_value: 'restaurant', name: 'Tasca', countrycode: 'PT' }, [-8.4, 41.3]),
      ],
    };
    expect(mapPhoton(json).map((place) => place.name)).toEqual(['Santuário do Bom Jesus do Monte', 'Miradouro', 'Sé']);
  });

  it('não repete o mesmo sítio', () => {
    const json = {
      features: [
        feature({ osm_type: 'N', osm_id: 1, osm_key: 'place', osm_value: 'city', name: 'Aveiro', countrycode: 'PT' }),
        feature({ osm_type: 'R', osm_id: 2, osm_key: 'place', osm_value: 'city', name: 'Aveiro', countrycode: 'PT' }),
      ],
    };
    expect(mapPhoton(json)).toHaveLength(1);
  });

  it('não mostra duas entradas iguais, mesmo com coordenadas diferentes', () => {
    const json = {
      features: [
        feature({ osm_type: 'R', osm_id: 1, osm_key: 'place', osm_value: 'city', name: 'Braga', county: 'Braga', countrycode: 'PT' }, [-8.428, 41.551]),
        feature({ osm_type: 'N', osm_id: 2, osm_key: 'tourism', osm_value: 'attraction', name: 'Braga', county: 'Braga', countrycode: 'PT' }, [-8.43, 41.55]),
        feature({ osm_type: 'N', osm_id: 3, osm_key: 'place', osm_value: 'suburb', name: 'Braga', state: 'Comunidad de Madrid', countrycode: 'ES' }, [-3.7, 40.4]),
      ],
    };
    const result = mapPhoton(json);
    expect(result).toHaveLength(2);
    expect(result.map((place) => place.osmRef)).toEqual(['R1', 'N3']);
  });

  it('respeita o limite', () => {
    const features = Array.from({ length: 10 }, (_, index) =>
      feature({ osm_type: 'N', osm_id: index, osm_key: 'place', osm_value: 'town', name: `Sítio ${index}`, countrycode: 'PT' }, [-8 - index, 41]),
    );
    expect(mapPhoton({ features }, 4)).toHaveLength(4);
  });

  it('usa o estado quando não há concelho', () => {
    const json = {
      features: [feature({ osm_type: 'R', osm_id: 5, osm_key: 'place', osm_value: 'city', name: 'Segóvia', state: 'Castilla y León', countrycode: 'es' })],
    };
    const [place] = mapPhoton(json);
    expect(place.admin1).toBe('Castilla y León');
    expect(place.countryCode).toBe('ES');
  });

  it('aguenta respostas estranhas sem rebentar', () => {
    expect(mapPhoton(null)).toEqual([]);
    expect(mapPhoton({})).toEqual([]);
    expect(mapPhoton({ features: 'x' })).toEqual([]);
    expect(mapPhoton({ features: [{}, { properties: {} }, null] as never })).toEqual([]);
  });
});
