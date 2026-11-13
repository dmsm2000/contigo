# Contigo · *pão e cebola*

**Visão do projeto — rascunho v0.1 (13 nov 2026)**

Documento vivo. `[confirmado]` marca o que já foi decidido e `[proposta]` o que ainda precisa de um sim.

---

## 1. Em uma frase

Uma app só nossa para descobrirmos um sítio novo por mês: **planeamos, combinamos, vivemos e guardamos**. O orçamento (por defeito 200€ cada) é a regra do jogo que faz de cada viagem um desafio, não o produto.

## 2. O problema

O dinheiro não é o difícil. O difícil é a coordenação:

- **Quando:** os turnos dela (às vezes 1 folga, às vezes 2, a sair às 15h ou não) e as férias dele raramente coincidem.
- **Onde:** decidir sem discussões infinitas.
- **Quanto:** partimos de duas cidades (Porto e Madrid), por isso os custos não são iguais para os dois.

A ideia de partida: uma viagem curta por mês, com orçamento fixo, alojamento tipo Airbnb e comida de supermercado. Pouco dinheiro, muito tempo juntos. Quando a viagem do mês custa menos do que o orçamento, a sobra fica guardada para uma viagem maior.

## 3. Identidade

- **Nome:** Contigo. É igual em português e em espanhol e diz o essencial. `[confirmado]`
- **Logótipo:** **Conti·GO**, com o "GO" numa cor de destaque. Funciona nas três línguas, porque "go" também é inglês. `[confirmado]`
  - Desenho em [`brand/`](brand/): cebola redonda e inclinada, com os anéis só de um lado e sem raízes (a primeira versão, simétrica e com uma fenda ao meio, lia-se como uma imagem obscena), magenta `#C2306F` com pin verde `#3FA864`, GO a magenta e Fredoka no nome. `[confirmado: versão A]`
- **Lema:** *pão e cebola*, do provérbio "Contigo, pão e cebola" / "Contigo, pan y cebolla" (viver com o mínimo, desde que seja contigo). É a piada certa para 200€ e comida de supermercado. `[confirmado]` Se ela não conhecer o provérbio, explica-se na apresentação.
- **Mascote:** uma cebola com um pin de mapa. É o ícone da app. `[confirmado]`
- **Visual:** moderno, com as fotos em primeiro lugar, ao estilo do Instagram, em modo claro e escuro. Detalhes em [DESIGN.md](DESIGN.md) e no protótipo. `[confirmado: direção]`
- **Tom de voz:** a app fala como nós, com humor e nunca com tom de contabilista. Exemplos:
  - Sorteio: "O destino falou. Vamos a **Salamanca**!"
  - Veto: "Veto gasto. Esperamos que tenha sido por uma boa causa."
  - Abaixo do teto: "Sobraram 37€. A cebola agradece."
  - Acima do teto: "Passámos 12€. Foi o pão ou foi a cebola?"
- **Línguas:** português, espanhol e inglês. `[confirmado]` O português é a língua principal (ela fala português) e é o que tem de estar perfeito desde o Marco 0. O espanhol e o inglês ficam suportados desde o início na estrutura, com cada pessoa a escolher a língua da sua interface e as notas e os diários a aparecerem como foram escritos, mas sem pressa. O humor não se traduz palavra a palavra, por isso as frases de cada língua escrevem-se à parte quando lá chegarmos.

## 4. Princípios

- **Só para os dois.** Privado, sem parte social nem pública.
- **Explorar primeiro, contas depois.** O dinheiro é uma regra do jogo, em pequeno.
- **Rápido em viagem.** Cansados, de pé, com uma mão: registar uma despesa ou uma foto demora segundos.
- **Funciona sem rede.** Registos e fotos guardam-se offline e sincronizam depois.
- **Mobile primeiro, e bom no computador.** Desenhada primeiro para o telemóvel, mas a funcionar bem num ecrã grande, com o rato e o teclado. `[confirmado]`
- **Só euros.** Os dois vivem na zona euro, o que simplifica tudo.
- **Divertido antes de contabilístico.**

## 5. O ciclo mensal: Planear → Combinar → Viver → Guardar

### Planear — a wishlist

- Cada um adiciona sítios: cola um link (Instagram, Google Maps…) e escreve uma nota "porque quero ir".
- Cada sítio tem duração mínima (dia, fim-de-semana, 3+ dias), um "desejo" de 1 a 3 estrelas de cada um e o custo estimado **por origem** (Porto→X e Madrid→X são diferentes), mais alojamento, comida e extras.
- Os sítios a meio caminho entre Porto e Madrid (Salamanca, Cáceres, Coimbra…) são candidatos naturais.

### Combinar — janelas e sorteio

- **Disponibilidade:** um menu próprio onde ela marca dias e janelas. `[confirmado]`
  - Os tipos de turno não vêm fixos: ela cria os seus (nome, hora de início e de fim), por exemplo "Manhã 7h–15h" ou "Sai às 15h", e depois aplica-os com um toque a um dia ou a um intervalo de dias.
  - Se o tipo de que precisa não existir, cria-o na hora e fica guardado numa biblioteca, pronto a usar noutros dias e noutros sítios da app.
  - Pode também marcar uma janela inteira (folga, férias, indisponível). Ele marca as férias da mesma forma.
  - A app calcula as **janelas em comum** (um dia, fim-de-semana, 3+ dias).
- **Sorteio do mês:** filtra a wishlist pelo que cabe na janela, no teto e no tempo de viagem. Sorteia com mais peso para o que mais desejamos e cada um tem **1 veto por mês**. Tem uma pequena cerimónia visual. `[confirmado: filtro + peso + veto]`
- **A rotação inclui sugestões que não estão na wishlist** `[confirmado: o pedido; proposta: o como]`. O sorteio não fica limitado ao que já conhecem: junta à wishlist uma lista curada de sugestões (sítios entre o Porto e Madrid e arredores, sem os que já visitaram nem os que já estão na wishlist). Cada fonte tem a sua fatia da probabilidade (por defeito, 25% para as sugestões, o que não muda se a wishlist for grande) e há um interruptor para as desligar. Uma sugestão sorteada pode ir para a wishlist, e o veto também vale para elas.

### Viver — a viagem

Estados: *Sorteada → Preparada → Em curso → Fechada*.

- **Preparar:** lista leve do que queremos ver, fazer e comer, e o custo estimado contra o teto.
- **Durante:** diário do dia (fotos e uma linha), despesas em segundos por categoria (transporte, alojamento, supermercado, restaurante, atividades, outros) e o **anel do orçamento** ("312 de 400€").
- **Fecho:** capa da viagem, melhores momentos, "voltávamos?", "ficámos dentro do teto?" e onde gastámos mais. A sobra (ou a falta) vai para a cebola.

### Guardar — memórias

- Linha do tempo e mapa com tudo o que já visitámos.
- **Viagens já feitas:** podemos registar viagens passadas (sítio, datas, fotos e o custo, se o soubermos) sem passar pelo sorteio nem pelo teto. Entram no mapa como pins cheios e na linha do tempo. As viagens que já fizemos a várias cidades à volta do Porto serão as primeiras entradas, registadas na própria app antes da apresentação. `[confirmado]`
- Retrospetiva do ano ("em 2027: 12 sítios, X€, o mais barato, o mais caro").
- Os gostos acumulados ("gostamos de cidades pequenas e comida de mercado") alimentam o próximo Planear.

## 6. Ecrã inicial

> **Atualização (protótipo de 13 nov):** o ecrã inicial passa a ser o **Início**, ao estilo do Instagram (histórias, cartão principal, memórias), e o mapa passa a ser o segundo separador. A tabela abaixo continua a valer para o cartão principal do Início. `[proposta]`

O **mapa** é o palco: pins cheios são os sítios onde já fomos e pins vazios os que faltam. `[confirmado]` Por cima, um **painel de overview** que sobe (como no Google Maps) e muda conforme a fase do mês: `[confirmado: mapa + overview]`

| Fase do mês | O painel mostra |
|---|---|
| Antes do sorteio | A próxima janela livre e o botão "Sortear" |
| Preparada | Contagem decrescente, checklist e custo estimado contra o teto |
| Em curso | O dia de hoje: o gasto de hoje e atalhos para foto e despesa |
| Fechada | A capa da viagem e o "voltávamos?" |

Sempre visíveis: o progresso do ano ("3 de 12") e a cebola.

No computador, o painel de overview deixa de subir por baixo e passa a uma coluna fixa à esquerda, com o mapa ao lado, como no Google Maps. `[proposta]`

## 7. O dinheiro, em pequeno

- **Dotação mensal:** o que cada um põe por mês. Por defeito 200€ cada, configurável nas definições. `[confirmado: configurável]`
- **Teto da viagem:** configurável em cada viagem. É a dotação mais o que decidirmos tirar da cebola (ex.: "400€ + 100€ da cebola"). `[confirmado: configurável]`
- **A cebola:** o que sobra de cada viagem e dos meses sem viagem acumula-se num número no ecrã inicial ("+140€ de cebola"), para uma viagem maior. Se uma viagem passar o teto, a cebola desce: a app avisa, mas não impede. `[confirmado: o nome; regras a testar na prática]`
- **Sem contas por pessoa na v1:** não registamos quem pagou nem fazemos acertos, só o total por viagem e por categoria. Se fizer falta, acrescenta-se. `[confirmado]`
- A cebola é só um registo, não é dinheiro real.

## 8. Preços

Queremos preços reais, mas "ao vivo dentro da app" não é barato nem fiável hoje.

1. **Links pré-preenchidos (v1).** Em cada sítio, botões "ver preços Porto→X / Madrid→X" abrem o Google Flights, o Skyscanner, o Omio, a Renfe, a FlixBus… já com origem, destino e datas. O preço é sempre real e guarda-se na app com a data em que o vimos. `[proposta]`
2. **Estimativas em cache (Fase 2).** A API de dados da Aviasales/Travelpayouts é gratuita para parceiros e dá os preços mais baixos por dia, baseados em pesquisas das últimas 48h. Serve para um calendário de "dias mais baratos", só para voos.
3. **Ao vivo dentro da app (não agora).** A Amadeus Self-Service foi desativada em julho de 2026, a Duffel é pensada para vender bilhetes e a Skyscanner só dá acesso a parceiros. Para comboios e autocarros não há APIs públicas oficiais da Renfe, da CP ou da FlixBus.

Ajudas extra:

- **Livro de preços próprio:** com as viagens feitas, "Porto→Salamanca de autocarro: ~18€" vem dos nossos gastos reais e as estimativas melhoram sozinhas.
- **Gratuitos e fáceis:** tempo e distância por estrada, e previsão do tempo para a data da viagem.

*A pesquisa sobre APIs foi feita a 13 nov 2026 a partir de resultados de pesquisa, na sua maioria blogs de fornecedores. Confirmar na documentação oficial antes de construir.*

## 9. O que a app não é

Não é um Splitwise, nem um Booking, nem um planeador de roteiros minuto a minuto. É um mapa e um diário nossos, com um sorteio por cima.

## 10. Fases

- **Marco 0: a apresentação a ela** (sem data: quando estiver pronta o suficiente para a apresentarmos juntos e ela dar ideias). A app abre já com o mapa preenchido, com as viagens que já fizemos registadas como primeiras entradas, para termos o que mostrar. Precisa de login para os dois (com convite para ela), registo de viagens passadas, mapa com pins, uma wishlist com alguns sítios, o menu de Disponibilidade (ela cria os seus tipos de turno, marca dias e janelas, e a app mostra as janelas em comum), o sorteio com a sua cerimónia e a identidade (nome, logótipo, cebola). `[confirmado]`
  - **Pronta o suficiente** quer dizer que ela consegue entrar com a conta dela, ver o mapa com as viagens feitas, acrescentar um sítio à wishlist, criar um tipo de turno e marcar alguns dias na Disponibilidade, ver o sorteio acontecer e deixar ideias (uma lista de "Ideias" na app, ou anotamos nós). Não precisa de estar completa nem perfeita: é para desenharmos o resto com ela. `[proposta]`
- **Fase 1: a primeira viagem nova, marcada com a app** (sem data: a primeira viagem é marcada usando a própria app). Tudo o do Marco 0, mais o sorteio filtrado pelas janelas e pelo teto e a viagem (checklist, diário com fotos, despesas, anel do orçamento), a cebola, os links de preços e o funcionamento offline. `[confirmado: a Disponibilidade no Marco 0; proposta: o sorteio filtrado na Fase 1, porque é com ele que marcamos a primeira viagem]`
- **Fase 2: estimativas e preços.** Custo estimado por origem (Porto e Madrid) e calendário de preços de voos.
- **Fase 3: guardar a sério.** Linha do tempo, retrospetiva anual, mapa de regiões visitadas (distritos e províncias) e gostos.

## 11. Por decidir e por fazer

**Por decidir:** nada que bloqueie o arranque.

**Por fazer, dentro da app e antes da apresentação:**

- Registar as viagens já feitas: sítio, mês e se foram os dois. Fotos, custos e notas são opcionais. Durante a construção usamos viagens de exemplo.
## 12. Parte técnica

A proposta técnica está em [ARCHITECTURE.md](ARCHITECTURE.md). Notas que vêm da visão:

- PWA instalável, com login só para duas contas.
- Offline-first para despesas e fotos.
- Armazenamento de fotos: compressão e limites.
- Texto traduzido em três línguas, com a língua escolhida por utilizador.
- Biblioteca de mapas a escolher.
- Notificações: no iOS exigem a app instalada no ecrã inicial.
