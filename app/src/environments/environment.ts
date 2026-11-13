// Produção (GitHub Pages). Os valores são preenchidos no deploy a partir das variáveis do repositório.
// A chave é a chave pública do Supabase: pode estar no browser, a segurança vem das regras de acesso.
export const environment = {
  production: true,
  supabaseUrl: '__SUPABASE_URL__',
  supabaseKey: '__SUPABASE_KEY__',
};
