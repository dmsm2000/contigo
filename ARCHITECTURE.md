# Contigo · proposta técnica

**Rascunho v0.1 (13 nov 2026)** · liga a [VISION.md](VISION.md)

Tudo aqui é `[proposta]` até dizermos que sim. O objetivo é a solução mais simples que cumpre a visão, a custo zero ou quase, para duas pessoas.

---

## 1. O que a visão obriga

- **PWA instalável** (iPhone e Android), privada, com 2 contas.
- **Funciona sem rede** em viagem: registar despesas, notas e fotos e sincronizar depois.
- **Fotos** das viagens guardadas com segurança.
- **Mapa** com pins e pesquisa de sítios.
- **Três línguas**, escolhida por pessoa (português por defeito).
- **Datas e horas** entre o Porto e Madrid.
- **Custo perto de zero:** dois utilizadores, uso baixo.
- **Mobile primeiro e bom no computador:** um só código, com layouts diferentes por tamanho de ecrã.

## 2. Stack proposta

| Camada | Escolha | Porquê |
|---|---|---|
| App | Angular + TypeScript, como SPA | Escolha tua. É privada e fica atrás de login, por isso não precisa de renderização no servidor. Signals e RxJS para o estado. |
| PWA | @angular/pwa (service worker do Angular) | Instalação no ecrã inicial e cache da app para abrir sem rede. |
| Cache e fila local | Dexie (sobre IndexedDB) | Guarda os dados lidos e a fila de escritas do modo offline. O service worker trata da app, não dos dados. |
| Dados | Supabase (Postgres) | Os dados são relacionais (viagens, sítios, despesas, disponibilidade) e há regras de acesso por linha. |
| Login | Supabase Auth, só por convite | Sem registo público: duas contas, com um link de convite para ela. |
| Fotos | Supabase Storage (bucket privado) | Já vem com o Supabase. |
| Tempo real | Supabase Realtime | Cada um vê o que o outro marcou. |
| Mapa | MapLibre GL com tiles gratuitos | Sem custo por visita. A pesquisa de sítios usa geocoding gratuito (a escolher). |
| Línguas | Transloco | Troca de língua em tempo real, por pessoa. O i18n embutido do Angular gera uma versão da app por língua, o que não serve para cada um escolher a sua. Português por defeito, espanhol e inglês em ficheiros à parte. |
| Componentes | Ionic, com tema próprio | Traz o painel que sobe a vários níveis (o overview do ecrã inicial, com o mapa por trás), separadores, gestos e transições de app. O aspeto vem do tema (as cores da cebola e a Fredoka). O mapa, o calendário de disponibilidade e a cerimónia do sorteio são componentes nossos. |
| Alojamento | GitHub Pages, para já | É o mais simples: o deploy faz-se com o GitHub Actions. Cada página precisa de um `404.html` igual ao `index.html`, para os links diretos (como o convite para ela) não darem erro. Pode passar para a Vercel mais tarde sem mexer na app. |
| Código | GitHub | Ligado ao deploy do Pages. |

**Layout responsivo** (mobile primeiro, e bom no computador) `[confirmado]`

- **Um só código.** Desenha-se primeiro para o telemóvel e acrescentam-se layouts a partir de cerca de 768 px (tablet) e 1024 px (computador).
- **Navegação:** separadores em baixo no telemóvel, e menu lateral fixo (o *split pane* do Ionic) no computador.
- **Ecrã inicial:** no telemóvel, o mapa ocupa tudo e o painel de overview sobe por baixo. No computador, o painel é uma coluna fixa à esquerda, com o mapa ao lado. `[proposta]`
- **Disponibilidade:** um mês de cada vez no telemóvel, com deslize entre meses. No computador, vários meses lado a lado.
- **Formulários e fotos:** no telemóvel ocupam o ecrã (a despesa rápida com teclado numérico). No computador abrem em janelas, e a galeria usa uma grelha maior.
- **Rato e teclado:** estados de hover, foco visível e navegação por Tab, além do toque. Alvos de toque de pelo menos 44 px.
- **Teste:** cada funcionalidade só fica pronta depois de vista nos dois tamanhos, por exemplo 390 px e 1280 px.
- A PWA também se instala no computador (Chrome e Edge).
- O Ionic dá a base, mas é pensado para o telemóvel: os layouts de computador (coluna lateral, janelas, grelhas) desenhamo-los nós.

**Tema e modo escuro** `[proposta]`

- As cores, letras e raios de [DESIGN.md](DESIGN.md) passam a variáveis CSS do tema do Ionic, com um conjunto para claro e outro para escuro.
- O modo escuro segue o sistema por defeito e pode ser forçado nas definições, ficando guardado no perfil.
- As letras (Fredoka e Inter) vão dentro da app, em vez de virem da internet, para funcionar sem rede.
- A barra de baixo é a barra de separadores do Ionic com um botão central feito à medida. O sorteio e o dia de viagem abrem em ecrã inteiro, sem barra.

## 3. Offline e sincronização

- **A app:** o service worker do Angular guarda-a em cache, e abre sem rede.
- **Leituras:** cache local do mapa, da viagem atual e da disponibilidade.
- **Escritas:** uma fila local (Dexie, sobre IndexedDB) guarda despesas, notas e marcações de disponibilidade e envia-as quando volta a rede, sem perder nada.
- **Fotos:** comprimidas no telemóvel (cerca de 1600 px e 300 KB), ficam na fila e sobem quando há rede. No iPhone o envio com a app fechada não é fiável, por isso sobem quando a app abre ou volta a ter rede.
- **Conflitos:** raramente editam o mesmo registo ao mesmo tempo. Regra simples: a última escrita ganha, e cada registo guarda quem o escreveu e quando.

## 4. Dados (entidades principais)

- **Perfis (2):** nome, língua, fuso horário.
- **Sítios:** nome, país, coordenadas, link, nota "porque quero ir", duração mínima e estado (wishlist ou visitado).
- **Desejos:** o desejo de 1 a 3 estrelas de cada pessoa por sítio.
- **Viagens:** sítio, estado (sorteada, preparada, em curso, fechada ou passada), datas, teto, capa, "voltávamos?" e se foi feita pelos dois.
- **Dias da viagem:** diário, com a nota e o melhor momento.
- **Fotos:** viagem ou dia, ficheiro e legenda.
- **Despesas:** viagem, categoria, valor, data e nota.
- **Checklist:** o que queremos ver, fazer e comer, e se já foi feito.
- **Tipos de turno:** a biblioteca de cada pessoa (nome, início, fim, cor).
- **Disponibilidade:** pessoa, dia e tipo de turno ou estado (folga, férias, indisponível).
- **Definições:** dotação mensal por pessoa e moeda (euro).
- **Sorteios:** mês, candidatos, resultado e vetos usados.
- **Ideias:** texto, autor e estado.

A **cebola** calcula-se a partir das dotações e dos gastos das viagens, em vez de se guardar um saldo. Assim nunca fica desalinhada.

## 5. Fotos

- Guardam-se versões otimizadas. Os originais continuam no telemóvel.
- Bucket privado, com links temporários para as mostrar.
- Com 300 KB por foto, 1 GB dá para cerca de 3000 fotos, o suficiente para vários anos a 12 viagens por ano.
- Convém uma exportação periódica (backup), porque as fotos são as memórias.

## 6. Privacidade e login

- Registo público desligado: só existem as duas contas.
- Entra-se com **email e palavra-passe**. As duas contas são criadas por ti no painel do Supabase e cada pessoa muda a sua palavra-passe na app. `[confirmado]`
- Sem emails de login: o plano gratuito do Supabase limita-os a 2 por hora, só envia para a equipa da organização e, desde junho de 2026, não deixa editar o modelo do email. Um link ou código por email falharia a longo prazo. Mais tarde pode juntar-se Face ID / impressão digital (passkeys) como atalho, a confirmar.
- Regras de acesso por linha: só estas duas contas leem e escrevem os dados.
- Sem analítica nem rastreio.
- O repositório é **público** e só leva o código da app. As notas pessoais (o VISION.md e este documento) ficam fora dele. Proposta de pastas: `contigo/` com as notas e a pasta `brand/`, e `contigo/app/` como o repositório público. `[proposta]`
- Nada de segredos no código: a chave pública do Supabase pode estar na app (é feita para isso, e a segurança vem das regras de acesso), mas a chave de serviço nunca entra no repositório.

## 7. Datas e fusos

Madrid está uma hora à frente de Portugal continental. Por isso:

- a disponibilidade guarda-se como **datas locais**, sem fuso, e as janelas em comum calculam-se **por dia**;
- as horas dos turnos guardam-se como hora local de quem as marca;
- a app mostra os dois fusos quando fizer diferença (por exemplo, "sai às 15h em Madrid" equivale a 14h no Porto).

## 8. Custos e armadilhas

- **Supabase, plano gratuito:** 500 MB de base de dados e 1 GB de ficheiros. O projeto é **pausado após cerca de uma semana sem atividade**: os dados mantêm-se e retoma-se no painel. Como a app pode ficar semanas parada, a proposta é uma tarefa agendada gratuita (por exemplo, no GitHub) que faz um pedido por semana. A alternativa é o plano pago, por volta de 25 $ por mês. Atenção: em repositórios públicos o GitHub desliga as tarefas agendadas após 60 dias sem atividade no repositório (a confirmar), e nesse caso usa-se um serviço externo gratuito de ping.
- **Conta Supabase própria:** a Contigo tem uma conta nova, separada da rally app, para não misturar projetos nem limites. O plano gratuito permite 2 projetos ativos por conta (número de blogs, a confirmar). Convém uma região da UE, a mais próxima (por exemplo, Paris ou Frankfurt), e autenticação em dois passos na conta.
- **GitHub Pages:** com conta gratuita só funciona em repositório **público** (em privado exige plano pago, a confirmar). Isso não expõe os dados: o código de uma app web é sempre visível no browser, e os dados ficam protegidos pelo login e pelas regras do Supabase. As notas pessoais (como o VISION.md) ficam fora do repositório público.
- **Sem regras de rotas:** o GitHub Pages não redireciona, por isso o truque do `404.html` é obrigatório. Se o site ficar num endereço do tipo `utilizador.github.io/contigo/`, a app é compilada com esse caminho base.
- **Firebase (posto de lado):** tem offline embutido no Firestore, mas o armazenamento de fotos exige desde 3 de fevereiro de 2026 o plano pago Blaze, com cartão associado, e os dados são menos naturais para calendário e despesas.
- **Cloudflare (plano B):** R2 para fotos e D1 para dados são gratuitos e sem pausas, mas obrigam a montar o login e a sincronização à mão.

*Verificado a 13 nov 2026 a partir de resultados de pesquisa. Só o [FAQ da Supabase sobre pausas](https://supabase.com/kb/faqs/platform/free-project-pausing) e o [FAQ da Firebase sobre o armazenamento](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) são fontes oficiais. Os números do Cloudflare vêm de blogs. Confirmar preços e limites antes de decidir.*

## 9. Desenvolvimento e ordem de construção

**Desenvolvimento local:** o Supabase corre na máquina (Supabase CLI com Docker), por isso não precisamos da conta nem do projeto na nuvem para começar. `[confirmado]`

- A máquina já tem o necessário: Docker a correr (com 8 GB), Supabase CLI, Node, git e GitHub CLI.
- A base de dados, o login, as fotos e o tempo real correm localmente. O Supabase local da Contigo usa as portas 553xx, para não chocar com outros projetos Supabase na mesma máquina.
- O esquema e as regras de acesso vivem no repositório, em migrações (`supabase/migrations`), e os dados de exemplo em `supabase/seed.sql`, só com viagens inventadas. Mais tarde, as mesmas migrações aplicam-se ao projeto na nuvem.
- Limite: testar a PWA instalada no telemóvel pede HTTPS e acesso à rede, por isso essa parte faz-se contra o projeto na nuvem, já com a conta nova.
- O projeto na nuvem só é preciso quando quisermos mostrar a app a ela.
- O Node está na versão 26: confirmo a compatibilidade com o Angular ao criar o projeto.

**Marco 0 (a apresentação a ela):**

1. Esqueleto: repositório, PWA, deploy, línguas (português primeiro) e login por convite.
2. Mapa e sítios: pesquisa e pins.
3. Viagens já feitas: formulário rápido.
4. Wishlist, com o desejo de cada um.
5. Disponibilidade: tipos de turno, marcar dias e janelas, janelas em comum.
6. Sorteio com cerimónia.
7. Convite para ela, lista de ideias, ícone e identidade.

**Fase 1 (a primeira viagem nova):** sorteio filtrado, viagem (offline, fotos, despesas, anel do orçamento), cebola e links de preços.

## 10. Por decidir

**Decidido:** Angular, Supabase (numa conta nova, só para a Contigo; dados, login e fotos), GitHub (repositório público) e GitHub Pages para já. A Vercel fica para depois, se fizer falta. `[confirmado]`

**Escolha minha, a rever se quiseres:** Ionic com tema próprio. `[proposta]`

1. **Supabase:** tarefa semanal para não pausar (proposta) ou pagar o plano?
