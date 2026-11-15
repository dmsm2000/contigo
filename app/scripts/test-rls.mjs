// Confirma as regras de acesso no Supabase LOCAL: quem não entrou não vê nada, e os dois utilizadores partilham tudo.
// Cria duas contas temporárias e apaga-as no fim. Nunca corre contra o projeto na nuvem.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const url = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Este teste só corre contra o Supabase local, não contra ${url}.`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, options);
const publicKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

const password = `rls-${randomUUID()}`;
const run = randomUUID().slice(0, 8);
const emails = [`rls-a-${run}@contigo.test`, `rls-b-${run}@contigo.test`];
const created = [];
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok     ' : 'FALHOU '} ${name}${ok ? '' : detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function signedIn(email) {
  const client = createClient(url, publicKey, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

try {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    created.push(data.user.id);
  }
  const [a, b] = await Promise.all(emails.map(signedIn));
  const anon = createClient(url, publicKey, options);

  // 1) Quem não entrou não pode ler nem escrever.
  const anonRead = await anon.from('trips').select('id');
  check('sem sessão: não lê viagens', !anonRead.error && anonRead.data.length === 0);
  const anonInsert = await anon.from('places').insert({ name: 'Intruso' });
  check('sem sessão: não cria sítios', Boolean(anonInsert.error));

  // 2) A pessoa A cria um sítio e uma viagem.
  const placeA = await a.from('places').insert({ name: `Teste ${run}`, osm_ref: `N${Date.now()}` }).select().single();
  check('A cria um sítio', !placeA.error, placeA.error?.message);
  const tripA = await a
    .from('trips')
    .insert({ place_id: placeA.data.id, start_date: '2026-10-01', date_precision: 'month', with_partner: true })
    .select()
    .single();
  check('A cria uma viagem', !tripA.error, tripA.error?.message);
  check('a viagem fica com o autor certo', tripA.data?.created_by === created[0]);

  // 3) A pessoa B vê, edita e apaga o que A criou.
  const seenByB = await b.from('trips').select('id, place:places(name)').eq('id', tripA.data.id);
  check('B vê a viagem de A', seenByB.data?.length === 1 && seenByB.data[0].place?.name === `Teste ${run}`);
  const edited = await b.from('trips').update({ note: 'editada por B' }).eq('id', tripA.data.id).select();
  check('B edita a viagem de A', edited.data?.length === 1 && edited.data[0].note === 'editada por B');

  // 4) Ninguém pode fingir ser outro autor.
  const forged = await b.from('places').insert({ name: 'Falso', created_by: created[0] });
  check('não se pode registar em nome do outro', Boolean(forged.error));

  // 5) Regras de dados.
  const badDate = await a
    .from('trips')
    .insert({ place_id: placeA.data.id, start_date: '2026-10-15', date_precision: 'month' });
  check('mês tem de começar no dia 1', Boolean(badDate.error));
  const badCoords = await a.from('places').insert({ name: 'Meio', lat: 41.1 });
  check('latitude sem longitude é recusada', Boolean(badCoords.error));
  const badCost = await a.from('trips').insert({ place_id: placeA.data.id, start_date: '2026-10-01', cost_eur: -5 });
  check('custo negativo é recusado', Boolean(badCost.error));

  // 6) Apagar: o sítio só sai quando já não tem viagens.
  const placeBlocked = await b.from('places').delete().eq('id', placeA.data.id);
  check('sítio com viagens não se apaga', Boolean(placeBlocked.error));
  const tripGone = await b.from('trips').delete().eq('id', tripA.data.id).select();
  check('B apaga a viagem', tripGone.data?.length === 1);
  const placeGone = await b.from('places').delete().eq('id', placeA.data.id).select();
  check('depois o sítio apaga-se', placeGone.data?.length === 1);

  // 7) Lista de sítios por ir: cada um dá as suas estrelas.
  const wished = await a
    .from('places')
    .insert({ name: `Desejo ${run}`, note: 'porque sim', min_stay: 'weekend', link: 'https://exemplo.pt' })
    .select()
    .single();
  check('A cria um sítio por ir', !wished.error, wished.error?.message);
  const wishA = await a.from('place_wishes').insert({ place_id: wished.data.id, stars: 3 }).select().single();
  check('A dá estrelas', !wishA.error, wishA.error?.message);
  check('o desejo fica com o autor certo', wishA.data?.user_id === created[0]);
  const seenWish = await b.from('place_wishes').select('stars').eq('place_id', wished.data.id);
  check('B vê as estrelas de A', seenWish.data?.length === 1 && seenWish.data[0].stars === 3);
  const stolen = await b.from('place_wishes').update({ stars: 1 }).eq('place_id', wished.data.id).eq('user_id', created[0]).select();
  check('B não altera as estrelas de A', (stolen.data ?? []).length === 0);
  const forgedWish = await b.from('place_wishes').insert({ place_id: wished.data.id, user_id: created[0], stars: 1 });
  check('não se dão estrelas em nome do outro', Boolean(forgedWish.error));
  const wishB = await b.from('place_wishes').insert({ place_id: wished.data.id, stars: 2 }).select().single();
  check('B junta as suas estrelas ao mesmo sítio', !wishB.error, wishB.error?.message);
  const tooMany = await b.from('place_wishes').update({ stars: 4 }).eq('place_id', wished.data.id).eq('user_id', created[1]);
  check('mais de 3 estrelas é recusado', Boolean(tooMany.error));
  const badLink = await a.from('places').insert({ name: 'Ligação má', link: 'javascript:alert(1)' });
  check('só se aceitam ligações http(s)', Boolean(badLink.error));
  const wishedBlocked = await a.from('places').delete().eq('id', wished.data.id);
  check('sítio com desejos não se apaga', Boolean(wishedBlocked.error));
  await a.from('place_wishes').delete().eq('place_id', wished.data.id);
  await b.from('place_wishes').delete().eq('place_id', wished.data.id);
  const wishedGone = await a.from('places').delete().eq('id', wished.data.id).select();
  check('sem desejos, o sítio apaga-se', wishedGone.data?.length === 1);

  // 6) Disponibilidade: tipos de turno e dias marcados.
  const shiftA = await a.from('shift_types').insert({ name: 'Manhã 7h–15h', kind: 'busy', starts_at: '07:00', ends_at: '15:00', tone: 'morning' }).select().single();
  check('A cria um tipo de turno', !shiftA.error, shiftA.error?.message);
  check('o tipo fica com o autor certo', shiftA.data?.user_id === created[0]);
  const seenShift = await b.from('shift_types').select('name').eq('id', shiftA.data.id);
  check('B vê os tipos de A', seenShift.data?.length === 1);
  const editedShift = await b.from('shift_types').update({ name: 'Roubado' }).eq('id', shiftA.data.id).select();
  check('B não altera os tipos de A', (editedShift.data ?? []).length === 0);
  const deletedShift = await b.from('shift_types').delete().eq('id', shiftA.data.id).select();
  check('B não apaga os tipos de A', (deletedShift.data ?? []).length === 0);
  const forgedShift = await b.from('shift_types').insert({ name: 'Falso', kind: 'free', user_id: created[0] });
  check('não se criam tipos em nome do outro', Boolean(forgedShift.error));
  const badKind = await a.from('shift_types').insert({ name: 'Mau', kind: 'talvez' });
  check('o tipo tem de ser "busy" ou "free"', Boolean(badKind.error));
  const oneTime = await a.from('shift_types').insert({ name: 'Meia hora', kind: 'busy', starts_at: '07:00' });
  check('as horas vêm as duas ou nenhuma', Boolean(oneTime.error));
  const noName = await a.from('shift_types').insert({ name: '   ', kind: 'free' });
  check('o tipo precisa de nome', Boolean(noName.error));

  const freeA = await a.from('shift_types').insert({ name: 'Folga', kind: 'free' }).select().single();
  check('A cria um tipo livre', !freeA.error, freeA.error?.message);
  const dayA = await a.from('availability_days').insert({ day: '2026-12-05', shift_type_id: freeA.data.id }).select().single();
  check('A marca um dia', !dayA.error, dayA.error?.message);
  check('o dia fica com o autor certo', dayA.data?.user_id === created[0]);
  const seenDay = await b.from('availability_days').select('day').eq('user_id', created[0]);
  check('B vê os dias de A', seenDay.data?.length === 1 && seenDay.data[0].day === '2026-12-05');
  const dayMoved = await a.from('availability_days').upsert({ day: '2026-12-05', shift_type_id: shiftA.data.id }, { onConflict: 'user_id,day' }).select();
  check('marcar outra vez o mesmo dia troca o tipo', !dayMoved.error && dayMoved.data?.length === 1 && dayMoved.data[0].shift_type_id === shiftA.data.id, dayMoved.error?.message);
  const stolenDay = await b.from('availability_days').update({ shift_type_id: freeA.data.id }).eq('user_id', created[0]).select();
  check('B não altera os dias de A', (stolenDay.data ?? []).length === 0);
  const forgedDay = await b.from('availability_days').insert({ day: '2026-12-06', shift_type_id: freeA.data.id, user_id: created[0] });
  check('não se marcam dias em nome do outro', Boolean(forgedDay.error));
  const otherType = await b.from('availability_days').insert({ day: '2026-12-06', shift_type_id: freeA.data.id });
  check('não se marca um dia com o tipo do outro', Boolean(otherType.error));
  const clearedB = await b.from('availability_days').delete().eq('user_id', created[0]).select();
  check('B não apaga os dias de A', (clearedB.data ?? []).length === 0);

  const cascade = await a.from('shift_types').delete().eq('id', shiftA.data.id).select();
  check('A apaga um tipo', cascade.data?.length === 1);
  const orphanDays = await a.from('availability_days').select('day').eq('user_id', created[0]);
  check('apagar um tipo apaga os dias que o usavam', orphanDays.data?.length === 0);
  await a.from('shift_types').delete().eq('id', freeA.data.id);

  // 7) Sorteio: viagem sorteada e vetos (um por pessoa e por mês).
  const drawnPlace = await a.from('places').insert({ name: `Sorteado ${run}` }).select().single();
  check('A cria o sítio sorteado', !drawnPlace.error, drawnPlace.error?.message);
  const drawnTrip = await a
    .from('trips')
    .insert({ place_id: drawnPlace.data.id, status: 'drawn', start_date: '2026-12-05', end_date: '2026-12-06', date_precision: 'day', draw_entry: `wish:${drawnPlace.data.id}` })
    .select()
    .single();
  check('A guarda a viagem sorteada', !drawnTrip.error, drawnTrip.error?.message);
  const seenDrawn = await b.from('trips').select('draw_entry, status').eq('id', drawnTrip.data.id);
  check('B vê de onde saiu o sorteio', seenDrawn.data?.[0]?.status === 'drawn' && seenDrawn.data[0].draw_entry === `wish:${drawnPlace.data.id}`);
  const emptyEntry = await a.from('trips').insert({ place_id: drawnPlace.data.id, status: 'drawn', start_date: '2026-12-05', draw_entry: '' });
  check('a origem do sorteio não pode ser vazia', Boolean(emptyEntry.error));

  const vetoA = await a.from('draw_vetoes').insert({ month: '2026-12-01', entry_id: `wish:${drawnPlace.data.id}` }).select().single();
  check('A usa o veto do mês', !vetoA.error, vetoA.error?.message);
  check('o veto fica com o autor certo', vetoA.data?.user_id === created[0]);
  const vetoTwice = await a.from('draw_vetoes').insert({ month: '2026-12-01', entry_id: 'suggestion:braga' });
  check('A não tem um segundo veto no mesmo mês', Boolean(vetoTwice.error));
  const vetoNext = await a.from('draw_vetoes').insert({ month: '2027-01-01', entry_id: 'suggestion:braga' });
  check('no mês seguinte há um veto novo', !vetoNext.error, vetoNext.error?.message);
  const vetoB = await b.from('draw_vetoes').insert({ month: '2026-12-01', entry_id: 'suggestion:aveiro' });
  check('B tem o seu veto, independente do de A', !vetoB.error, vetoB.error?.message);
  const seenVetoes = await b.from('draw_vetoes').select('user_id').eq('month', '2026-12-01');
  check('os dois veem os vetos do mês', seenVetoes.data?.length === 2);
  const midMonth = await a.from('draw_vetoes').insert({ month: '2027-02-15', entry_id: 'x' });
  check('o veto é do primeiro dia do mês', Boolean(midMonth.error));
  const forgedVeto = await b.from('draw_vetoes').insert({ month: '2027-03-01', entry_id: 'x', user_id: created[0] });
  check('não se usa o veto do outro', Boolean(forgedVeto.error));
  const undoVeto = await a.from('draw_vetoes').delete().eq('user_id', created[0]).select();
  check('um veto usado não se desfaz', (undoVeto.data ?? []).length === 0);
  const editVeto = await a.from('draw_vetoes').update({ entry_id: 'outra' }).eq('user_id', created[0]).select();
  check('um veto usado não se muda', (editVeto.data ?? []).length === 0);

  await a.from('trips').delete().eq('id', drawnTrip.data.id);
  await a.from('places').delete().eq('id', drawnPlace.data.id);

  // 8) Ideias: os dois leem e mudam o estado, mas o texto é de quem o escreveu.
  const ideaA = await a.from('ideas').insert({ body: 'Mostrar o preço dos voos' }).select().single();
  check('A escreve uma ideia', !ideaA.error, ideaA.error?.message);
  check('a ideia fica com o autor certo', ideaA.data?.user_id === created[0]);
  check('a ideia começa por ver', ideaA.data?.status === 'open');
  const seenIdea = await b.from('ideas').select('body').eq('id', ideaA.data.id);
  check('B vê a ideia de A', seenIdea.data?.length === 1 && seenIdea.data[0].body === 'Mostrar o preço dos voos');
  const statusB = await b.from('ideas').update({ status: 'planned' }).eq('id', ideaA.data.id).select();
  check('B muda o estado da ideia de A', statusB.data?.length === 1 && statusB.data[0].status === 'planned', statusB.error?.message);
  const bodyB = await b.from('ideas').update({ body: 'Texto roubado' }).eq('id', ideaA.data.id).select();
  check('B não muda o texto da ideia de A', Boolean(bodyB.error));
  const bodyA = await a.from('ideas').update({ body: 'Mostrar o preço dos voos e dos comboios' }).eq('id', ideaA.data.id).select();
  check('A muda o texto da sua ideia', bodyA.data?.length === 1 && bodyA.data[0].body.endsWith('comboios'), bodyA.error?.message);
  check('mudar a ideia atualiza a data', bodyA.data?.[0]?.updated_at > ideaA.data.created_at);
  const authorChange = await a.from('ideas').update({ user_id: created[1] }).eq('id', ideaA.data.id).select();
  check('uma ideia não muda de autor', Boolean(authorChange.error));
  const forgedIdea = await b.from('ideas').insert({ body: 'Falsa', user_id: created[0] });
  check('não se escrevem ideias em nome do outro', Boolean(forgedIdea.error));
  const emptyIdea = await a.from('ideas').insert({ body: '   ' });
  check('a ideia precisa de texto', Boolean(emptyIdea.error));
  const longIdea = await a.from('ideas').insert({ body: 'x'.repeat(501) });
  check('a ideia tem um limite de 500 caracteres', Boolean(longIdea.error));
  const badStatus = await a.from('ideas').update({ status: 'talvez' }).eq('id', ideaA.data.id);
  check('o estado tem de ser um dos três', Boolean(badStatus.error));
  const deleteB = await b.from('ideas').delete().eq('id', ideaA.data.id).select();
  check('B não apaga a ideia de A', (deleteB.data ?? []).length === 0);
  const deleteA = await a.from('ideas').delete().eq('id', ideaA.data.id).select();
  check('A apaga a sua ideia', deleteA.data?.length === 1);

  // 9) Fotos: registo na tabela e ficheiros no bucket privado.
  const photoPlace = await a.from('places').insert({ name: `Fotos ${run}` }).select().single();
  const photoTrip = await a.from('trips').insert({ place_id: photoPlace.data.id, start_date: '2026-10-01', date_precision: 'month' }).select().single();
  const photoId = randomUUID();
  const photoPath = `${photoTrip.data.id}/${photoId}.jpg`;
  const photoThumb = `${photoTrip.data.id}/${photoId}_t.jpg`;
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9])], { type: 'image/jpeg' });

  const anonUpload = await anon.storage.from('trip-photos').upload(`${photoTrip.data.id}/intruso.jpg`, jpeg, { contentType: 'image/jpeg' });
  check('sem sessão: não envia fotos', Boolean(anonUpload.error));
  const upA = await a.storage.from('trip-photos').upload(photoPath, jpeg, { contentType: 'image/jpeg' });
  check('A envia uma foto', !upA.error, upA.error?.message);
  const upThumb = await a.storage.from('trip-photos').upload(photoThumb, jpeg, { contentType: 'image/jpeg' });
  check('A envia a miniatura', !upThumb.error, upThumb.error?.message);
  const badType = await a.storage.from('trip-photos').upload(`${photoTrip.data.id}/ficheiro.txt`, new Blob(['olá'], { type: 'text/plain' }), { contentType: 'text/plain' });
  check('o bucket só aceita imagens JPEG ou WebP', Boolean(badType.error));
  const tooBigFile = await a.storage.from('trip-photos').upload(`${photoTrip.data.id}/enorme.jpg`, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
  check('o bucket recusa ficheiros com mais de 5 MB', Boolean(tooBigFile.error));
  const downloadB = await b.storage.from('trip-photos').download(photoPath);
  check('B descarrega a foto de A', !downloadB.error && downloadB.data?.size === jpeg.size, downloadB.error?.message);
  const anonDownload = await anon.storage.from('trip-photos').download(photoPath);
  check('sem sessão: não descarrega fotos', Boolean(anonDownload.error));
  const signed = await b.storage.from('trip-photos').createSignedUrl(photoPath, 60);
  check('B pede um link temporário', !signed.error && Boolean(signed.data?.signedUrl), signed.error?.message);
  const publicTry = await fetch(`${url}/storage/v1/object/public/trip-photos/${photoPath}`);
  check('o bucket não é público', !publicTry.ok);

  const rowA = await a
    .from('trip_photos')
    .insert({ id: photoId, trip_id: photoTrip.data.id, path: photoPath, thumb_path: photoThumb, width: 1600, height: 1200 })
    .select()
    .single();
  check('A regista a foto na viagem', !rowA.error, rowA.error?.message);
  check('a foto fica com o autor certo', rowA.data?.user_id === created[0]);
  const seenRow = await b.from('trip_photos').select('id').eq('trip_id', photoTrip.data.id);
  check('B vê as fotos da viagem', seenRow.data?.length === 1);
  const forgedPhoto = await b.from('trip_photos').insert({ trip_id: photoTrip.data.id, path: 'x/y.jpg', thumb_path: 'x/y_t.jpg', width: 10, height: 10, user_id: created[0] });
  check('não se juntam fotos em nome do outro', Boolean(forgedPhoto.error));
  const captionB = await b.from('trip_photos').update({ caption: 'Pôr do sol' }).eq('id', photoId).select();
  check('B muda a legenda', captionB.data?.length === 1 && captionB.data[0].caption === 'Pôr do sol', captionB.error?.message);
  const moveB = await b.from('trip_photos').update({ path: 'outro/sitio.jpg' }).eq('id', photoId).select();
  check('só a legenda se pode mudar', Boolean(moveB.error));
  const longCaption = await a.from('trip_photos').update({ caption: 'x'.repeat(201) }).eq('id', photoId);
  check('a legenda tem um limite de 200 caracteres', Boolean(longCaption.error));
  const badSize = await a.from('trip_photos').insert({ trip_id: photoTrip.data.id, path: 'z/z.jpg', thumb_path: 'z/z_t.jpg', width: 0, height: 10 });
  check('as medidas da foto têm de ser positivas', Boolean(badSize.error));

  const removeFiles = await a.storage.from('trip-photos').remove([photoPath, photoThumb]);
  check('A apaga os ficheiros', !removeFiles.error && removeFiles.data?.length === 2, removeFiles.error?.message);
  const photoTripGone = await a.from('trips').delete().eq('id', photoTrip.data.id).select();
  check('apagar a viagem apaga os registos das fotos', photoTripGone.data?.length === 1 && (await a.from('trip_photos').select('id').eq('id', photoId)).data?.length === 0);
  await a.from('places').delete().eq('id', photoPlace.data.id);

  // 7) Despesas e dotação mensal.
  const expPlace = await a.from('places').insert({ name: `Despesas ${run}` }).select().single();
  const expTrip = await a.from('trips').insert({ place_id: expPlace.data.id, start_date: '2026-10-01', date_precision: 'month' }).select().single();
  const expA = await a.from('expenses').insert({ trip_id: expTrip.data.id, amount_eur: 42.5, category: 'food', note: 'Jantar' }).select().single();
  check('A regista uma despesa', !expA.error, expA.error?.message);
  check('a despesa fica com o autor certo', expA.data?.user_id === created[0]);
  const expSeen = await b.from('expenses').select('id').eq('trip_id', expTrip.data.id);
  check('B vê as despesas da viagem', expSeen.data?.length === 1);
  const expAnon = await anon.from('expenses').select('id');
  check('sem sessão: não vê despesas', !expAnon.error && expAnon.data.length === 0);
  const expForged = await b.from('expenses').insert({ trip_id: expTrip.data.id, amount_eur: 5, user_id: created[0] });
  check('não se registam despesas em nome do outro', Boolean(expForged.error));
  const expFix = await b.from('expenses').update({ amount_eur: 40, category: 'transport' }).eq('id', expA.data.id).select();
  check('B corrige o valor e a categoria', expFix.data?.length === 1 && Number(expFix.data[0].amount_eur) === 40, expFix.error?.message);
  check('a despesa guarda quem a corrigiu por último', expFix.data?.[0]?.updated_by === created[1], String(expFix.data?.[0]?.updated_by));
  const tripTouch = await b.from('trips').update({ note: 'Mexido por B' }).eq('id', expTrip.data.id).select();
  check('a viagem guarda quem a alterou por último', tripTouch.data?.[0]?.updated_by === created[1], tripTouch.error?.message);
  const tripForge = await b.from('trips').update({ note: 'x', updated_by: created[0] }).eq('id', expTrip.data.id).select();
  check('não se escreve o nome de outra pessoa em updated_by', tripForge.data?.[0]?.updated_by === created[1], tripForge.error?.message);
  const expMove = await b.from('expenses').update({ user_id: created[1] }).eq('id', expA.data.id).select();
  check('uma despesa não muda de autor', Boolean(expMove.error));
  const expZero = await a.from('expenses').insert({ trip_id: expTrip.data.id, amount_eur: 0 });
  check('o valor tem de ser positivo', Boolean(expZero.error));
  const expCat = await a.from('expenses').insert({ trip_id: expTrip.data.id, amount_eur: 3, category: 'luxo' });
  check('a categoria tem de ser uma das conhecidas', Boolean(expCat.error));
  const histSeen = await b.from('allowance_history').select('user_id, month, amount').eq('user_id', created[0]);
  check('B vê o histórico das dotações de A', !histSeen.error && histSeen.data.length >= 1, histSeen.error?.message);
  const histForge = await b.from('allowance_history').insert({ user_id: created[1], month: '2020-01', amount: 999 });
  check('ninguém escreve no histórico das dotações à mão', Boolean(histForge.error));
  const histAnon = await anon.from('allowance_history').select('user_id');
  check('sem sessão: não lê o histórico das dotações', !histAnon.error && histAnon.data.length === 0);
  const allowA = await a.from('profiles').update({ monthly_allowance: 250 }).eq('id', created[0]).select();
  check('A muda a sua dotação mensal', allowA.data?.length === 1 && Number(allowA.data[0].monthly_allowance) === 250, allowA.error?.message);
  const allowB = await b.from('profiles').update({ monthly_allowance: 1 }).eq('id', created[0]).select();
  check('B não muda a dotação de A', !allowB.error && allowB.data?.length === 0);
  const allowBad = await a.from('profiles').update({ monthly_allowance: -5 }).eq('id', created[0]);
  check('a dotação não pode ser negativa', Boolean(allowBad.error));
  const histNow = await b.from('allowance_history').select('month, amount').eq('user_id', created[0]).neq('month', '2000-01');
  check('mudar a dotação deixa uma linha no histórico, com o mês de hoje', histNow.data?.length === 1 && Number(histNow.data[0].amount) === 250, histNow.error?.message);
  const allowAgain = await a.from('profiles').update({ monthly_allowance: 260 }).eq('id', created[0]).select();
  const histSame = await b.from('allowance_history').select('month, amount').eq('user_id', created[0]).neq('month', '2000-01');
  check('mudar duas vezes no mesmo mês fica com o último valor', !allowAgain.error && histSame.data?.length === 1 && Number(histSame.data[0].amount) === 260);
  const expDel = await b.from('expenses').delete().eq('id', expA.data.id).select();
  check('B apaga uma despesa', expDel.data?.length === 1);
  const expA2 = await a.from('expenses').insert({ trip_id: expTrip.data.id, amount_eur: 9 }).select().single();
  await a.from('trips').delete().eq('id', expTrip.data.id);
  check('apagar a viagem apaga as despesas', (await a.from('expenses').select('id').eq('id', expA2.data.id)).data?.length === 0);
  await a.from('places').delete().eq('id', expPlace.data.id);

  // Fotos de perfil: cada um só mexe na sua pasta.
  const avatarA = await a.storage.from('avatars').upload(`${created[0]}/1.jpg`, jpeg, { contentType: 'image/jpeg' });
  check('A envia a sua foto de perfil', !avatarA.error, avatarA.error?.message);
  const avatarForged = await b.storage.from('avatars').upload(`${created[0]}/2.jpg`, jpeg, { contentType: 'image/jpeg' });
  check('B não envia para a pasta de A', Boolean(avatarForged.error));
  const avatarSee = await b.storage.from('avatars').download(`${created[0]}/1.jpg`);
  check('B vê a foto de perfil de A', !avatarSee.error, avatarSee.error?.message);
  const avatarAnon = await anon.storage.from('avatars').download(`${created[0]}/1.jpg`);
  check('quem não entrou não vê fotos de perfil', Boolean(avatarAnon.error));
  const avatarRemoveB = await b.storage.from('avatars').remove([`${created[0]}/1.jpg`]);
  check('B não apaga a foto de A', (avatarRemoveB.data ?? []).length === 0);
  const avatarPng = await a.storage.from('avatars').upload(`${created[0]}/x.png`, new Blob(['x'], { type: 'image/png' }), { contentType: 'image/png' });
  check('só se aceita JPEG', Boolean(avatarPng.error));
  const avatarRow = await a.from('profiles').update({ avatar_path: `${created[0]}/1.jpg` }).eq('id', created[0]).select();
  check('A guarda o caminho da foto no perfil', avatarRow.data?.length === 1, avatarRow.error?.message);
  const homeOk = await a.from('profiles').update({ home: 'porto' }).eq('id', created[0]).select();
  check('A diz onde mora', homeOk.data?.length === 1 && homeOk.data[0].home === 'porto', homeOk.error?.message);
  const homeBad = await a.from('profiles').update({ home: 'lisboa' }).eq('id', created[0]);
  check('só se aceita Porto ou Madrid', Boolean(homeBad.error));
  const homeForged = await b.from('profiles').update({ home: 'madrid' }).eq('id', created[0]).select();
  check('B não muda a casa de A', !homeForged.error && homeForged.data?.length === 0);
  const avatarRemoveA = await a.storage.from('avatars').remove([`${created[0]}/1.jpg`]);
  check('A apaga a sua foto', avatarRemoveA.data?.length === 1);

  // O plano de uma viagem: partilhado pelos dois; só quem tem sessão lê e escreve; o autor não se falsifica.
  const planPlace = await a.from('places').insert({ name: 'Plano Teste' }).select().single();
  const planTrip = await a.from('trips').insert({ place_id: planPlace.data.id, status: 'planned', start_date: '2026-12-02', end_date: '2026-12-04', date_precision: 'day', dates_confirmed: false }).select().single();
  check('A cria uma viagem a planear', !planTrip.error, planTrip.error?.message);
  const stayA = await a.from('trip_stays').insert({ trip_id: planTrip.data.id, name: 'Hotel A', price_eur: 78 }).select().single();
  check('A junta um alojamento', !stayA.error, stayA.error?.message);
  const staySeen = await b.from('trip_stays').select('id').eq('trip_id', planTrip.data.id);
  check('B vê o alojamento de A', staySeen.data?.length === 1);
  const stayB = await b.from('trip_stays').update({ chosen: true }).eq('id', stayA.data.id).select();
  check('B escolhe o alojamento (é dos dois)', stayB.data?.length === 1 && stayB.data[0].updated_by === created[1], stayB.error?.message);
  const stay2 = await a.from('trip_stays').insert({ trip_id: planTrip.data.id, name: 'Hotel B', chosen: true });
  check('só há um alojamento escolhido por viagem', Boolean(stay2.error));
  const stayForged = await b.from('trip_stays').insert({ trip_id: planTrip.data.id, name: 'Falso', created_by: created[0] });
  check('não se juntam alojamentos em nome do outro', Boolean(stayForged.error));
  const optA = await a.from('trip_date_options').insert({ trip_id: planTrip.data.id, start_date: '2026-12-02', end_date: '2026-12-04', preferred: true });
  const optBad = await a.from('trip_date_options').insert({ trip_id: planTrip.data.id, start_date: '2026-12-04', end_date: '2026-12-02' });
  check('as datas têm de estar por ordem', !optA.error && Boolean(optBad.error));
  const optTwo = await a.from('trip_date_options').insert({ trip_id: planTrip.data.id, start_date: '2026-12-09', end_date: '2026-12-11', preferred: true });
  check('só há uma opção de datas preferida', Boolean(optTwo.error));
  const lineA = await a.from('trip_budget_lines').upsert({ trip_id: planTrip.data.id, category: 'food', amount_eur: 80 }, { onConflict: 'trip_id,category' });
  const lineAgain = await b.from('trip_budget_lines').upsert({ trip_id: planTrip.data.id, category: 'food', amount_eur: 90 }, { onConflict: 'trip_id,category' });
  check('a estimativa de uma categoria muda em vez de repetir', !lineA.error && !lineAgain.error && (await a.from('trip_budget_lines').select('id').eq('trip_id', planTrip.data.id)).data?.length === 1);
  const legBad = await a.from('trip_legs').insert({ trip_id: planTrip.data.id, origin: 'Porto', mode: 'teletransporte' });
  check('o meio de transporte tem de ser um dos conhecidos', Boolean(legBad.error));
  const planAnon = await anon.from('trip_stays').select('id');
  check('sem sessão: não lê o plano', !planAnon.error && planAnon.data.length === 0);
  const stateBad = await a.from('trips').update({ status: 'voando' }).eq('id', planTrip.data.id);
  check('o estado da viagem tem de ser um dos conhecidos', Boolean(stateBad.error));
  await a.from('trips').delete().eq('id', planTrip.data.id);
  check('apagar a viagem apaga o plano', (await a.from('trip_stays').select('id').eq('trip_id', planTrip.data.id)).data?.length === 0);
  await a.from('places').delete().eq('id', planPlace.data.id);

  // Passar a "preparada": só com datas, alojamento e deslocação escolhidos e a aprovação de quem vai.
  const gPlace = await a.from('places').insert({ name: 'Regra Teste' }).select().single();
  const gTripBoth = await a.from('trips').insert({ place_id: gPlace.data.id, status: 'planned', start_date: '2026-12-02', date_precision: 'day', dates_confirmed: false }).select().single();
  const blockedBoth = await a.from('trips').update({ status: 'prepared' }).eq('id', gTripBoth.data.id);
  check('uma viagem de dois não passa a preparada sem as decisões', Boolean(blockedBoth.error) && /plan_not_ready/.test(blockedBoth.error.message), blockedBoth.error?.message);
  const gTrip = await a.from('trips').insert({ place_id: gPlace.data.id, status: 'planned', start_date: '2026-12-02', date_precision: 'day', dates_confirmed: false, with_partner: false }).select().single();
  const gStay = await a.from('trip_stays').insert({ trip_id: gTrip.data.id, name: 'Hotel Regra', price_eur: 80 }).select().single();
  const gLegPorto = await a.from('trip_legs').insert({ trip_id: gTrip.data.id, origin: 'Porto', mode: 'car', chosen: true }).select().single();
  const gLegMadrid = await a.from('trip_legs').insert({ trip_id: gTrip.data.id, origin: 'Madrid', mode: 'train' }).select().single();
  const gLegPorto2 = await a.from('trip_legs').insert({ trip_id: gTrip.data.id, origin: 'porto', mode: 'bus', chosen: true });
  check('só há uma deslocação escolhida por origem', Boolean(gLegPorto2.error));
  const tryPrepare = async () => a.from('trips').update({ status: 'prepared' }).eq('id', gTrip.data.id);
  const miss1 = await tryPrepare();
  check('sem datas, alojamento, Madrid sem deslocação nem aprovação: bloqueia', /dates,stay,transport,approval/.test(miss1.error?.message ?? ''), miss1.error?.message);
  await a.from('trips').update({ dates_confirmed: true }).eq('id', gTrip.data.id);
  await a.from('trip_stays').update({ chosen: true }).eq('id', gStay.data.id);
  await a.from('trip_legs').update({ chosen: true }).eq('id', gLegMadrid.data.id);
  const miss2 = await tryPrepare();
  check('com as 3 decisões mas sem aprovação: bloqueia', /plan_not_ready: approval/.test(miss2.error?.message ?? ''), miss2.error?.message);
  const approvalForged = await b.from('trip_plan_approvals').insert({ trip_id: gTrip.data.id, user_id: created[0] });
  check('ninguém aprova em nome do outro', Boolean(approvalForged.error));
  const approveA = await a.from('trip_plan_approvals').insert({ trip_id: gTrip.data.id });
  check('A aprova', !approveA.error, approveA.error?.message);
  const seenB = await b.from('trip_plan_approvals').select('user_id').eq('trip_id', gTrip.data.id);
  check('B vê a aprovação de A', seenB.data?.length === 1);
  const dropB = await b.from('trip_plan_approvals').delete().eq('trip_id', gTrip.data.id).select();
  check('B não retira a aprovação de A', !dropB.error && dropB.data?.length === 0);
  await a.from('trip_stays').update({ price_eur: 90 }).eq('id', gStay.data.id);
  const afterChange = await a.from('trip_plan_approvals').select('user_id').eq('trip_id', gTrip.data.id);
  check('mudar o alojamento escolhido apaga as aprovações', afterChange.data?.length === 0);
  await a.from('trip_plan_approvals').insert({ trip_id: gTrip.data.id });
  const prepared = await tryPrepare();
  check('com tudo decidido e aprovado, passa a preparada', !prepared.error, prepared.error?.message);
  await a.from('trips').delete().eq('id', gTripBoth.data.id);
  await a.from('trips').delete().eq('id', gTrip.data.id);
  await a.from('places').delete().eq('id', gPlace.data.id);

  // Último acesso: cada um regista o seu (com a hora do servidor) e o outro vê.
  const seenBefore = await b.from('profiles').select('last_seen_at').eq('id', created[0]).single();
  const touchA = await a.rpc('touch_last_seen');
  const seenAfter = await b.from('profiles').select('last_seen_at').eq('id', created[0]).single();
  check('A regista que entrou e B vê a hora', !touchA.error && seenBefore.data?.last_seen_at === null && Boolean(seenAfter.data?.last_seen_at), touchA.error?.message);
  const touchB = await b.rpc('touch_last_seen');
  const aStill = await b.from('profiles').select('last_seen_at').eq('id', created[0]).single();
  check('B só regista o seu acesso, nunca o de A', !touchB.error && aStill.data?.last_seen_at === seenAfter.data?.last_seen_at);
  const touchAnon = await anon.rpc('touch_last_seen');
  check('sem sessão não se regista acessos', Boolean(touchAnon.error));

  // Imagens dos sítios: partilhadas pelos dois, públicas para ler, só ficheiros com o id de um sítio no nome.
  const placeFile = `${crypto.randomUUID()}.jpg`;
  const imgA = await a.storage.from('place-images').upload(placeFile, jpeg, { contentType: 'image/jpeg', upsert: true });
  check('A guarda a imagem de um sítio', !imgA.error, imgA.error?.message);
  const imgB = await b.storage.from('place-images').upload(placeFile, jpeg, { contentType: 'image/jpeg', upsert: true });
  check('B também pode trocar a imagem de um sítio (os sítios são dos dois)', !imgB.error, imgB.error?.message);
  const imgAnonUp = await anon.storage.from('place-images').upload(`${crypto.randomUUID()}.jpg`, jpeg, { contentType: 'image/jpeg' });
  check('sem sessão: não se guardam imagens de sítios', Boolean(imgAnonUp.error));
  const imgBadName = await a.storage.from('place-images').upload('qualquer-coisa.jpg', jpeg, { contentType: 'image/jpeg' });
  check('o nome da imagem tem de ser o id de um sítio', Boolean(imgBadName.error));
  const imgPng = await a.storage.from('place-images').upload(`${crypto.randomUUID()}.jpg`, new Blob(['x'], { type: 'image/png' }), { contentType: 'image/png' });
  check('só se aceita JPEG nas imagens dos sítios', Boolean(imgPng.error));
  const imgPublic = await fetch(a.storage.from('place-images').getPublicUrl(placeFile).data.publicUrl);
  check('qualquer um lê a imagem do sítio pelo endereço público', imgPublic.ok);
  const versioned = `${crypto.randomUUID()}-${Date.now()}.jpg`;
  const imgVersioned = await a.storage.from('place-images').upload(versioned, jpeg, { contentType: 'image/jpeg' });
  check('a imagem de um sítio pode ter um número de versão no nome', !imgVersioned.error, imgVersioned.error?.message);
  await a.storage.from('place-images').remove([versioned]);
  await a.storage.from('place-images').remove([placeFile]);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
}

if (failures) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nTodas as regras de acesso estão como esperado.');
