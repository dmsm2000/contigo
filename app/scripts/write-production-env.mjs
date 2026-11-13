// Escreve src/environments/environment.ts com o Supabase da nuvem. Corre no deploy (GitHub Actions).
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_KEY?.trim();

if (!url || !key) {
  console.error('Faltam as variáveis SUPABASE_URL e SUPABASE_KEY.');
  process.exit(1);
}

if (!/^https:\/\//.test(url)) {
  console.error('SUPABASE_URL tem de começar por https://');
  process.exit(1);
}

// A chave secreta dá acesso total à base de dados: nunca pode ir para o browser.
if (/^sb_secret_/.test(key) || /service_role/.test(Buffer.from(key.split('.')[1] ?? '', 'base64').toString())) {
  console.error('SUPABASE_KEY tem de ser a chave pública (publishable/anon), não a secreta.');
  process.exit(1);
}

writeFileSync(
  'src/environments/environment.ts',
  `export const environment = {
  production: true,
  supabaseUrl: ${JSON.stringify(url)},
  supabaseKey: ${JSON.stringify(key)},
};
`,
);

console.log('environment.ts escrito para produção.');
