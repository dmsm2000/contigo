// Cria as duas contas de teste no Supabase LOCAL (supabase start). Nunca corre contra o projeto na nuvem.
// A palavra-passe abaixo só vale na base de dados local, na tua máquina.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const LOCAL_PASSWORD = 'contigo-local-2026';

const ACCOUNTS = [
  { email: 'tu@contigo.test', name: 'Tu' },
  { email: 'ela@contigo.test', name: 'Ela' },
];

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const url = status.API_URL;
const key = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error(`Este script só corre contra o Supabase local, não contra ${url}.`);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (listError) throw listError;

for (const account of ACCOUNTS) {
  const found = existing.users.find((user) => user.email === account.email);
  if (found) {
    // Repõe a palavra-passe de teste (por exemplo, se a conta foi criada antes de a entrada passar a palavra-passe).
    const { error } = await supabase.auth.admin.updateUserById(found.id, { password: LOCAL_PASSWORD });
    if (error) throw error;
    console.log(`${account.email}: palavra-passe de teste reposta`);
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: LOCAL_PASSWORD,
      email_confirm: true,
      user_metadata: { name: account.name },
    });
    if (error) throw error;
    console.log(`${account.email}: criada`);
  }
}

console.log('Pronto. A palavra-passe de teste está em scripts/create-local-users.mjs.');
