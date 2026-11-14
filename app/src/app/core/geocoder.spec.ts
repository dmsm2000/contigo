import { describe, expect, it } from 'vitest';
import { mapMeteo, mapPhoton, mergeCandidates } from './geocoder';

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

describe('mapMeteo', () => {
  const result = (over: Record<string, unknown>) => ({ id: 1, name: 'X', latitude: 1, longitude: 2, country_code: 'ES', feature_code: 'PPL', population: 0, ...over });

  it('põe a capital à frente de cidades com o mesmo nome e traduz o código', () => {
    const out = mapMeteo(
      {
        results: [
          result({ id: 3675707, name: 'Madrid', admin1: 'Cundinamarca', country_code: 'CO', feature_code: 'PPLA2', population: 135000 }),
          result({ id: 3117735, name: 'Madrid', admin1: 'Comunidade de Madrid', feature_code: 'PPLC', population: 3255944 }),
        ],
      },
      'Madrid',
    );
    expect(out.map((place) => place.countryCode)).toEqual(['ES', 'CO']);
    expect(out[0]).toMatchObject({ osmRef: 'G3117735', capital: true });
  });

  it('o nome exato vem antes de um que só começa assim', () => {
    const out = mapMeteo({ results: [result({ id: 2, name: 'Madridejos', population: 11000 }), result({ id: 3, name: 'Madrid', population: 5 })] }, 'madrid');
    expect(out.map((place) => place.name)).toEqual(['Madrid', 'Madridejos']);
  });

  it('deixa de fora aeroportos e outros sítios que não são destino', () => {
    const out = mapMeteo({ results: [result({ name: 'Aeroporto', feature_code: 'AIRP' }), result({ id: 9, name: 'Serra', feature_code: 'MT' })] }, 'x');
    expect(out.map((place) => place.name)).toEqual(['Serra']);
  });

  it('junta resultados sem repetir nome e país', () => {
    const a = { osmRef: 'G1', name: 'Braga', admin1: null, countryCode: 'PT', lat: 1, lng: 1 };
    const b = { ...a, osmRef: 'R2' };
    expect(mergeCandidates([[a], [b, { ...a, name: 'Guimarães', osmRef: 'R3' }]]).map((place) => place.osmRef)).toEqual(['G1', 'R3']);
  });

  it('respostas estranhas não rebentam', () => {
    expect(mapMeteo(null, 'x')).toEqual([]);
    expect(mapMeteo({ results: 'nada' }, 'x')).toEqual([]);
  });
});
