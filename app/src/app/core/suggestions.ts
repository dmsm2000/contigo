// Sugestões da Conti·GO: sítios para visitas curtas a partir do Porto ou de Madrid, que entram na rotação do
// sorteio ao lado dos da wishlist. Lista curada à mão, sem custos nem pedidos a serviços de fora.
// As coordenadas são aproximadas (chegam para o mapa e para as distâncias em linha reta).

export type MinStay = 'day' | 'weekend' | 'long';
export type SuggestionTag = 'city' | 'village' | 'nature' | 'coast' | 'heritage';

export interface Suggestion {
  /** Identificador estável (não mudar: é com ele que se lembram vetos e escolhas). */
  id: string;
  name: string;
  countryCode: 'PT' | 'ES';
  admin1: string;
  lat: number;
  lng: number;
  minStay: MinStay;
  tags: readonly SuggestionTag[];
}

const s = (
  id: string,
  name: string,
  countryCode: 'PT' | 'ES',
  admin1: string,
  lat: number,
  lng: number,
  minStay: MinStay,
  ...tags: SuggestionTag[]
): Suggestion => ({ id, name, countryCode, admin1, lat, lng, minStay, tags });

export const SUGGESTIONS: readonly Suggestion[] = [
  // Norte de Portugal
  s('braga', 'Braga', 'PT', 'Braga', 41.5503, -8.42, 'day', 'city', 'heritage'),
  s('guimaraes', 'Guimarães', 'PT', 'Braga', 41.4425, -8.2918, 'day', 'city', 'heritage'),
  s('viana-do-castelo', 'Viana do Castelo', 'PT', 'Viana do Castelo', 41.6918, -8.8345, 'day', 'city', 'coast'),
  s('ponte-de-lima', 'Ponte de Lima', 'PT', 'Viana do Castelo', 41.7678, -8.5833, 'day', 'village'),
  s('geres', 'Gerês', 'PT', 'Braga', 41.7333, -8.15, 'weekend', 'nature'),
  s('amarante', 'Amarante', 'PT', 'Porto', 41.27, -8.08, 'day', 'village'),
  s('pinhao', 'Pinhão e o Douro', 'PT', 'Vila Real', 41.189, -7.546, 'weekend', 'nature', 'village'),
  s('vila-real', 'Vila Real', 'PT', 'Vila Real', 41.3006, -7.7441, 'day', 'city'),
  s('chaves', 'Chaves', 'PT', 'Vila Real', 41.74, -7.47, 'day', 'city'),
  s('braganca', 'Bragança', 'PT', 'Bragança', 41.806, -6.7567, 'weekend', 'city', 'heritage'),
  s('miranda-do-douro', 'Miranda do Douro', 'PT', 'Bragança', 41.495, -6.274, 'weekend', 'village', 'nature'),
  // Centro de Portugal
  s('aveiro', 'Aveiro', 'PT', 'Aveiro', 40.6405, -8.6538, 'day', 'city', 'coast'),
  s('coimbra', 'Coimbra', 'PT', 'Coimbra', 40.2033, -8.4103, 'day', 'city', 'heritage'),
  s('viseu', 'Viseu', 'PT', 'Viseu', 40.6566, -7.9125, 'day', 'city'),
  s('guarda', 'Guarda', 'PT', 'Guarda', 40.5373, -7.2678, 'day', 'city'),
  s('serra-da-estrela', 'Serra da Estrela', 'PT', 'Guarda', 40.404, -7.534, 'weekend', 'nature'),
  s('monsanto', 'Monsanto', 'PT', 'Castelo Branco', 40.039, -7.115, 'day', 'village', 'heritage'),
  s('castelo-branco', 'Castelo Branco', 'PT', 'Castelo Branco', 39.8222, -7.4909, 'day', 'city'),
  s('tomar', 'Tomar', 'PT', 'Santarém', 39.603, -8.41, 'day', 'city', 'heritage'),
  s('batalha', 'Batalha', 'PT', 'Leiria', 39.659, -8.825, 'day', 'village', 'heritage'),
  s('nazare', 'Nazaré', 'PT', 'Leiria', 39.601, -9.07, 'day', 'coast', 'village'),
  s('obidos', 'Óbidos', 'PT', 'Leiria', 39.36, -9.157, 'day', 'village', 'heritage'),
  s('peniche-berlengas', 'Peniche e as Berlengas', 'PT', 'Leiria', 39.3558, -9.3811, 'weekend', 'coast', 'nature'),
  // Lisboa e Alentejo
  s('sintra', 'Sintra', 'PT', 'Lisboa', 38.797, -9.387, 'day', 'village', 'heritage'),
  s('lisboa', 'Lisboa', 'PT', 'Lisboa', 38.7223, -9.1393, 'weekend', 'city', 'coast'),
  s('evora', 'Évora', 'PT', 'Évora', 38.571, -7.909, 'weekend', 'city', 'heritage'),
  s('marvao', 'Marvão', 'PT', 'Portalegre', 39.394, -7.378, 'day', 'village', 'heritage'),
  s('elvas', 'Elvas', 'PT', 'Portalegre', 38.881, -7.163, 'day', 'city', 'heritage'),
  // Castela e Leão
  s('salamanca', 'Salamanca', 'ES', 'Salamanca', 40.965, -5.664, 'weekend', 'city', 'heritage'),
  s('ciudad-rodrigo', 'Ciudad Rodrigo', 'ES', 'Salamanca', 40.596, -6.532, 'day', 'village', 'heritage'),
  s('zamora', 'Zamora', 'ES', 'Zamora', 41.503, -5.744, 'day', 'city', 'heritage'),
  s('valladolid', 'Valladolid', 'ES', 'Valladolid', 41.6523, -4.7245, 'weekend', 'city'),
  s('avila', 'Ávila', 'ES', 'Ávila', 40.656, -4.7, 'day', 'city', 'heritage'),
  s('segovia', 'Segóvia', 'ES', 'Segóvia', 40.948, -4.118, 'day', 'city', 'heritage'),
  s('pedraza', 'Pedraza', 'ES', 'Segóvia', 41.1, -3.81, 'day', 'village'),
  s('gredos', 'Sierra de Gredos', 'ES', 'Ávila', 40.206, -5.091, 'weekend', 'nature'),
  s('leon', 'León', 'ES', 'León', 42.5987, -5.5671, 'weekend', 'city', 'heritage'),
  s('burgos', 'Burgos', 'ES', 'Burgos', 42.344, -3.697, 'weekend', 'city', 'heritage'),
  // Castela-A Mancha e Madrid
  s('toledo', 'Toledo', 'ES', 'Toledo', 39.8628, -4.0273, 'weekend', 'city', 'heritage'),
  s('cuenca', 'Cuenca', 'ES', 'Cuenca', 40.0704, -2.1374, 'weekend', 'city', 'heritage'),
  s('siguenza', 'Sigüenza', 'ES', 'Guadalajara', 41.069, -2.643, 'day', 'village', 'heritage'),
  s('alcala-de-henares', 'Alcalá de Henares', 'ES', 'Madrid', 40.4818, -3.364, 'day', 'city', 'heritage'),
  s('aranjuez', 'Aranjuez', 'ES', 'Madrid', 40.033, -3.602, 'day', 'city', 'nature'),
  s('el-escorial', 'El Escorial', 'ES', 'Madrid', 40.589, -4.148, 'day', 'village', 'heritage'),
  // Estremadura
  s('caceres', 'Cáceres', 'ES', 'Cáceres', 39.4753, -6.3724, 'weekend', 'city', 'heritage'),
  s('trujillo', 'Trujillo', 'ES', 'Cáceres', 39.459, -5.88, 'day', 'village', 'heritage'),
  s('plasencia', 'Plasencia', 'ES', 'Cáceres', 40.03, -6.09, 'day', 'city'),
  s('valle-del-jerte', 'Valle del Jerte', 'ES', 'Cáceres', 40.215, -5.75, 'day', 'nature', 'village'),
  s('merida', 'Mérida', 'ES', 'Badajoz', 38.9161, -6.3437, 'day', 'city', 'heritage'),
  // Galiza
  s('santiago-de-compostela', 'Santiago de Compostela', 'ES', 'A Coruña', 42.8782, -8.5448, 'weekend', 'city', 'heritage'),
  s('vigo', 'Vigo', 'ES', 'Pontevedra', 42.2406, -8.7207, 'day', 'city', 'coast'),
  s('pontevedra', 'Pontevedra', 'ES', 'Pontevedra', 42.43, -8.644, 'day', 'city'),
  s('ilhas-cies', 'Ilhas Cíes', 'ES', 'Pontevedra', 42.229, -8.904, 'day', 'nature', 'coast'),
  s('a-coruna', 'A Coruña', 'ES', 'A Coruña', 43.3623, -8.4115, 'weekend', 'city', 'coast'),
  s('ourense', 'Ourense', 'ES', 'Ourense', 42.3358, -7.8639, 'day', 'city'),
  s('ribeira-sacra', 'Ribeira Sacra', 'ES', 'Lugo', 42.4, -7.59, 'weekend', 'nature', 'village'),
  s('lugo', 'Lugo', 'ES', 'Lugo', 43.0097, -7.5567, 'day', 'city', 'heritage'),
];
