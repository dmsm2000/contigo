// Enche a base de dados LOCAL com dados de exemplo (viagens, wishlist, turnos, ideias) para testar os ecrãs.
// Usa as duas contas de teste (npm run supabase:users) e apaga primeiro o que elas tinham. Nunca corre contra a nuvem.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const url = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Os dados de exemplo só vão para o Supabase local, não para ${url}.`);
}

const admin = createClient(url, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
if (listError) throw listError;
const tu = list.users.find((user) => user.email === 'tu@contigo.test');
const ela = list.users.find((user) => user.email === 'ela@contigo.test');
if (!tu || !ela) throw new Error('Faltam as contas de teste: corre primeiro "npm run supabase:users".');

async function run(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// Começa do zero (só os dados; as contas ficam). Os ficheiros das fotos também saem do bucket.
const photos = await run(admin.from('trip_photos').select('path, thumb_path'), 'ler fotos');
const files = photos.flatMap((photo) => [photo.path, photo.thumb_path]);
if (files.length) await admin.storage.from('trip-photos').remove(files);
for (const table of ['expenses', 'trip_photos', 'trips', 'place_wishes', 'availability_days', 'shift_types', 'draw_vetoes', 'ideas']) {
  const column = ['place_wishes', 'availability_days', 'draw_vetoes'].includes(table) ? 'user_id' : 'id';
  await run(admin.from(table).delete().not(column, 'is', null), `limpar ${table}`);
}
await run(admin.from('places').delete().not('id', 'is', null), 'limpar sítios');

await run(admin.from('profiles').update({ name: 'Diogo' }).eq('id', tu.id), 'nome');
await run(admin.from('profiles').update({ name: 'Lucía' }).eq('id', ela.id), 'nome');

// Sítios: os já visitados e os que estão na wishlist. Alguns nomes compridos, para testar os ecrãs.
const placeRows = [
  ['Braga', 'Braga', 'PT', 41.5503, -8.42, null],
  ['Guimarães', 'Braga', 'PT', 41.4425, -8.2918, null],
  ['Aveiro', 'Aveiro', 'PT', 40.6405, -8.6538, null],
  ['Viana do Castelo', 'Viana do Castelo', 'PT', 41.6918, -8.8345, null],
  ['Salamanca', 'Castilla y León', 'ES', 40.9701, -5.6635, null],
  ['Coimbra', 'Coimbra', 'PT', 40.2033, -8.4103, null],
  ['Uma casa de campo sem morada', null, null, null, null, null],
  ['Évora', 'Évora', 'PT', 38.571, -7.909, 'weekend'],
  ['Cáceres', 'Extremadura', 'ES', 39.4753, -6.3724, 'weekend'],
  ['Parque Nacional da Peneda-Gerês', 'Braga', 'PT', 41.7333, -8.15, 'long'],
  ['Porto Covo', 'Setúbal', 'PT', 37.8519, -8.7911, 'day'],
  ['San Lorenzo de El Escorial', 'Comunidad de Madrid', 'ES', 40.5917, -4.1474, 'day'],
];
const places = await run(
  admin
    .from('places')
    .insert(
      placeRows.map(([name, admin1, country_code, lat, lng, min_stay]) => ({
        name,
        admin1,
        country_code,
        lat,
        lng,
        min_stay,
        created_by: tu.id,
      })),
    )
    .select('id, name'),
  'criar sítios',
);
const placeId = (name) => places.find((place) => place.name === name).id;

await run(
  admin.from('places').update({ note: 'O templo romano e o Alentejo ao pôr do sol.', link: 'https://www.visitevora.net/' }).eq('id', placeId('Évora')),
  'nota de Évora',
);

const trip = (name, start, extra = {}) => ({
  place_id: placeId(name),
  status: 'past',
  start_date: start,
  date_precision: 'month',
  with_partner: true,
  created_by: tu.id,
  ...extra,
});
const createdTrips = await run(
  admin.from('trips').insert([
    trip('Braga', '2026-10-01', { would_return: 'yes', cost_eur: 140 }),
    trip('Guimarães', '2026-09-01', { would_return: 'maybe', cost_eur: 85.5, note: 'Subimos à Penha de teleférico e jantámos na praça.' }),
    trip('Aveiro', '2026-08-01', { created_by: ela.id }),
    trip('Viana do Castelo', '2026-07-01', { with_partner: false, created_by: ela.id }),
    trip('Salamanca', '2026-05-01', {
      would_return: 'yes',
      cost_eur: 310,
      note: 'A Plaza Mayor à noite, as tapas na Rúa Mayor e a rã na fachada da universidade, que demorámos meia hora a encontrar. Voltávamos já amanhã, de preferência no inverno, com menos gente.',
    }),
    trip('Coimbra', '2026-03-01', { would_return: 'no' }),
    trip('Braga', '2025-12-01', { cost_eur: 60 }),
    trip('Uma casa de campo sem morada', '2025-11-01'),
  ]).select('id, place_id, start_date'),
  'criar viagens',
);

// Despesas de três viagens (a cebola conta a partir do mês da primeira).
const tripOf = (name, start) => createdTrips.find((row) => row.place_id === placeId(name) && row.start_date === start).id;
const spent = (name, start, amount_eur, category, note, spent_on, user_id) => ({ trip_id: tripOf(name, start), amount_eur, category, note, spent_on, user_id });
await run(
  admin.from('expenses').insert([
    spent('Braga', '2026-10-01', 38.5, 'transport', 'Comboio', '2026-10-11', tu.id),
    spent('Braga', '2026-10-01', 54, 'food', 'Jantar na praça', '2026-10-11', ela.id),
    spent('Braga', '2026-10-01', 47.5, 'stay', null, '2026-10-12', tu.id),
    spent('Guimarães', '2026-09-01', 22, 'activities', 'Teleférico', '2026-09-13', ela.id),
    spent('Guimarães', '2026-09-01', 63.5, 'food', null, '2026-09-13', tu.id),
    spent('Salamanca', '2026-05-01', 120, 'stay', 'Hostal', '2026-05-16', tu.id),
    spent('Salamanca', '2026-05-01', 90, 'food', 'Tapas', '2026-05-17', ela.id),
    spent('Salamanca', '2026-05-01', 100, 'transport', 'Autocarro', '2026-05-16', ela.id),
  ]),
  'criar despesas',
);

await run(
  admin.from('place_wishes').insert([
    { place_id: placeId('Évora'), user_id: tu.id, stars: 3 },
    { place_id: placeId('Évora'), user_id: ela.id, stars: 2 },
    { place_id: placeId('Cáceres'), user_id: ela.id, stars: 3 },
    { place_id: placeId('Parque Nacional da Peneda-Gerês'), user_id: tu.id, stars: 2 },
    { place_id: placeId('Porto Covo'), user_id: tu.id, stars: 1 },
    { place_id: placeId('San Lorenzo de El Escorial'), user_id: ela.id, stars: 2 },
  ]),
  'criar desejos',
);

// Turnos (num insert de várias linhas, o que falta vai como null e não com o valor por defeito: daí o tone nos livres).
// Os tipos de cada um e quatro semanas marcadas a partir de hoje, com algumas janelas em comum.
const types = await run(
  admin
    .from('shift_types')
    .insert([
      { user_id: ela.id, name: 'Manhã 7h–15h', kind: 'busy', starts_at: '07:00', ends_at: '15:00', tone: 'morning' },
      { user_id: ela.id, name: 'Tarde 15h–23h', kind: 'busy', starts_at: '15:00', ends_at: '23:00', tone: 'afternoon' },
      { user_id: ela.id, name: 'Intermédio', kind: 'busy', starts_at: '10:00', ends_at: '18:00', tone: 'middle' },
      { user_id: ela.id, name: 'Folga', kind: 'free', tone: 'middle' },
      { user_id: tu.id, name: 'Trabalho', kind: 'busy', starts_at: '09:00', ends_at: '18:00', tone: 'middle' },
      { user_id: tu.id, name: 'Livre', kind: 'free', tone: 'middle' },
    ])
    .select('id, user_id, name'),
  'criar tipos',
);
const typeId = (userId, name) => types.find((type) => type.user_id === userId && type.name === name).id;

const pad = (value) => String(value).padStart(2, '0');
const today = new Date();
const day = (offset) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const elaPattern = ['Manhã 7h–15h', 'Manhã 7h–15h', 'Tarde 15h–23h', 'Folga', 'Folga', 'Intermédio', 'Tarde 15h–23h'];
const days = [];
for (let offset = 0; offset < 28; offset++) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  days.push({ user_id: ela.id, day: day(offset), shift_type_id: typeId(ela.id, elaPattern[offset % 7]) });
  days.push({ user_id: tu.id, day: day(offset), shift_type_id: typeId(tu.id, weekend || offset % 9 === 3 ? 'Livre' : 'Trabalho') });
}
await run(admin.from('availability_days').insert(days), 'marcar dias');

await run(
  admin.from('ideas').insert([
    { user_id: ela.id, body: 'Mostrar o preço dos comboios entre Madrid e o sítio sorteado.', status: 'open' },
    {
      user_id: tu.id,
      body: 'Uma regra para as viagens: cada um escolhe um restaurante sem o outro saber.\n\nE no fim votamos qual foi melhor.',
      status: 'planned',
    },
    { user_id: ela.id, body: 'Ver as fotos das viagens num mapa.', status: 'done' },
  ]),
  'criar ideias',
);

console.log('Dados de exemplo criados: 8 viagens (3 com despesas), 5 sítios na wishlist, 4 semanas de turnos e 3 ideias.');
console.log('Entra com tu@contigo.test (Diogo) ou ela@contigo.test (Lucía).');
