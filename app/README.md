# Contigo · pão e cebola

Uma app só para dois: um sítio novo por mês, com orçamento, sorteio, disponibilidade e memórias.
PWA feita com Angular, Ionic e Supabase.

## O que é preciso

- Node 24 ou mais recente
- Docker a correr
- [Supabase CLI](https://supabase.com/docs/guides/local-development)

## Correr na tua máquina

```bash
npm install
npm run supabase:start   # Supabase local (Docker)
npm run supabase:users   # cria as duas contas de teste
npm start                # app em http://localhost:4200
```

Para entrar, usa `tu@contigo.test` ou `ela@contigo.test`. A palavra-passe de teste está em `scripts/create-local-users.mjs` e só vale na base de dados local.

O Supabase local da Contigo usa as portas 553xx (API 55321, base de dados 55322, Studio 55323), para não chocar com outros projetos Supabase na mesma máquina.

## Pacotes: só do registo público

O `.npmrc` do projeto força o registo público do npm (`registry.npmjs.org`), mesmo que a tua máquina tenha outro configurado em `~/.npmrc` (por exemplo, o de uma empresa). Assim o `package-lock.json` nunca leva endereços internos para o repositório público, e o deploy no GitHub consegue instalar tudo. `npm run check:registry` confirma isto, e corre também antes de cada deploy. Nunca escrevas credenciais no `.npmrc` do projeto.

| Comando | O que faz |
|---|---|
| `npm start` | App em modo de desenvolvimento |
| `npm test` | Testes |
| `npm run build` | Compilação de produção |
| `npm run supabase:stop` | Para o Supabase local |
| `npm run test:rls` | Confirma as regras de acesso da base de dados (cria e apaga duas contas temporárias) |
| `npm run check:registry` | Confirma que os pacotes vêm só do registo público |

## O que já está feito

- Entrar com email e palavra-passe, claro e escuro, português, espanhol e inglês.
- Viagens já feitas (com pesquisa de sítios), memórias, mapa com pins e tempo real entre as duas contas.
- Wishlist "Por ir": cada um dá de 1 a 3 estrelas, com nota, link e duração mínima; aparece no Início e no mapa. A lista de sugestões que entram na rotação do sorteio está pronta (`src/app/core/suggestions.ts`).
- Disponibilidade: cada um cria os seus tipos de dia ("Manhã 7h–15h", "Folga"…), marca dias ou intervalos no calendário e a app mostra as janelas em que os dois estão livres, também no Início.
- Sorteio do mês: escolhe-se a janela (ou "qualquer data"), sorteia-se entre a wishlist e as surpresas que cabem nela, com cerimónia, e o resultado fica como viagem sorteada, visível aos dois no Início. Cada um tem um veto por mês.
- Ideias: uma lista dos dois (em **Nós**, ou no **+**), com estado por ver, a fazer e feita; qualquer um muda o estado, só quem escreveu muda o texto.
- Fotos nas viagens: escolhem-se (da galeria ou da câmara), a app reduz e comprime cada uma no telemóvel e guarda-as num bucket privado; há galeria, ecrã inteiro com legenda, apagar, e a primeira foto serve de capa no Início.
- Falta: o teto de gastos, despesas, o diário por dia, o envio de fotos sem rede, o convite para ela e a identidade final.

## Base de dados

O esquema e as regras de acesso estão em `supabase/migrations`. O registo público está desligado em `supabase/config.toml`: só existem as contas criadas por ti.

## Entrar na app

Entra-se com email e palavra-passe (mínimo 8 caracteres). Não há emails de login: o plano gratuito do Supabase limita-os a 2 por hora e não deixa editar o modelo. Cada pessoa muda a sua palavra-passe no separador **Nós**. Se alguém se esquecer da sua, repõe-se no painel do Supabase (Authentication › Users).

## Publicar (GitHub Pages)

O site fica em `https://<utilizador>.github.io/<nome-do-repositório>/` (a app é compilada com esse caminho, e o `404.html` faz os links diretos funcionarem). Faz-se uma vez, por esta ordem:

**1. Supabase na nuvem** (numa conta só para a Contigo)

1. Em supabase.com, na conta da Contigo, cria um projeto (região perto de vocês, por exemplo `eu-west`) e guarda a palavra-passe da base de dados.
2. Na pasta `app/`, liga o projeto com essa conta. Se a CLI já estiver com outra conta (por exemplo, a de outro projeto teu), não lhe mexas: usa um token só para esse terminal. Gera-o em supabase.com/dashboard/account/tokens, na conta da Contigo, e guarda-o assim (o nome da variável escreve-se à letra e o token cola-se no prompt silencioso, nunca na linha de comando):

   ```bash
   read -s SUPABASE_ACCESS_TOKEN && export SUPABASE_ACCESS_TOKEN
   npx supabase projects list
   npx supabase link --project-ref <ref-do-projeto>
   ```

   Confirma no `projects list` que só aparece o projeto da Contigo. Na CLI 3, os comandos de base de dados correm **na base local por defeito**: para a nuvem tens de passar `--remote`. Primeiro vê o que vai ser aplicado e depois aplica:

   ```bash
   npx supabase db push --remote --skip-vault --dry-run
   npx supabase db push --remote --skip-vault
   npx supabase migration list --remote
   ```

   O último comando tem de mostrar as migrações todas também na coluna **Remote**. O `db push` aplica as tabelas, as regras de acesso e o bucket privado `trip-photos`. Nunca uses `supabase config push`: copiaria o `config.toml` local (com `localhost`) para a nuvem. Quando acabares, revoga o token no mesmo sítio onde o geraste.
3. No painel, em Authentication: desliga os registos novos (*Allow new users to sign up*), põe o mínimo de 8 caracteres na palavra-passe e, em Users › Add user, cria as duas contas com palavra-passe e a opção de confirmar o email já marcada. O nome não se põe aqui: cada pessoa escreve o seu em **Nós**, na primeira vez que entra (até lá aparece "Sem nome").
4. Em Project Settings › API, copia o **URL** do projeto e a chave **publishable** (nunca a `secret`).

**2. GitHub**

1. Settings › Pages › Source: **GitHub Actions** (antes do primeiro envio, senão o deploy falha).
2. Settings › Secrets and variables › Actions › **Variables**: cria `SUPABASE_URL` e `SUPABASE_KEY` com os valores do passo anterior.
3. Faz `git push` para `master`. Cada envio que mexa em `app/` (ou no workflow) testa, compila e publica (`.github/workflows/deploy.yml`, na raiz do repositório). Também se pode correr à mão em Actions › Deploy para o GitHub Pages › Run workflow.

**3. Depois do primeiro deploy**

- Abre o site, entra com uma das contas e confirma que o mapa aparece (se o mapa disser que não consegue, o worker `maplibre/maplibre-gl-worker.mjs` não está a ser servido como JavaScript: `curl -I https://<utilizador>.github.io/<repositório>/maplibre/maplibre-gl-worker.mjs`).
- No telemóvel, abre o site e usa "Adicionar ao ecrã principal" para instalar a PWA. A PWA abre sempre na raiz do site, que é onde o service worker se regista.
- Para atualizar o site basta um novo `git push`; a PWA instalada atualiza-se sozinha na vez seguinte em que for aberta.
