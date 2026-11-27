# Contigo · design

**Rascunho v0.1 (13 nov 2026)** · liga a [VISION.md](VISION.md) e [ARCHITECTURE.md](ARCHITECTURE.md)

Protótipo navegável (privado): https://claude.ai/artifact/8gWXEbBg5hYeD5QHLSEsM7

`[confirmado]` marca o que já foi decidido e `[proposta]` o que ainda precisa de um sim.

---

## 1. Direção

Moderna, com as fotos em primeiro lugar, ao estilo do Instagram: histórias no topo, um feed de memórias e ecrãs imersivos para o sorteio e o dia de viagem. Divertida (a cebola, os confetes do sorteio), mas fácil de usar: uma ação principal por ecrã, alvos de toque de pelo menos 44 px e um botão **+** sempre à mão. `[confirmado: direção]`

## 2. Cores

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#0E0C11` | Fundo |
| `sf` | `#F5F2F6` | `#1A171E` | Cartões e campos |
| `ln` | `#ECE6EE` | `#2B2631` | Linhas e contornos |
| `tx` | `#17121B` | `#F6F2F8` | Texto |
| `mu` | `#6C6472` | `#A89FAE` | Texto secundário |
| `ac` | `#C2306F` | `#F2649F` | Acento: texto, ícones, links |
| `acs` | `#FCE7F0` | `#3A1428` | Fundo de destaque |
| `act` | `#8E1F52` | `#FF9DC6` | Texto sobre o fundo de destaque |
| `btn` | `#C2306F` | `#C2306F` | Botão principal, com texto branco |

**Turnos** (fundo / texto): manhã `#FFF0DA` / `#8A4A00`, tarde `#EEEAFE` / `#4936A6`, intermédio `#E3EFFC` / `#1B5BA6`, folga `#E2F5E9` / `#17683C`. No escuro: `#33230E` / `#FFC47E`, `#241E45` / `#BCB1FF`, `#0F2A45` / `#93C5FF`, `#12301F` / `#86E3AC`.

**Gradientes:**

- Marca: `135deg, #C2306F → #EE5A62 → #F7A55A`. Só decorativo (aros das histórias, botão +, barras de progresso), nunca por trás de texto pequeno, porque o laranja não dá contraste.
- Cartão principal: `125deg, #5E1747 → #9E2462 → #D8455E`, escuro o suficiente para texto branco.

## 3. Tipografia

- **Fredoka** (600): marca, títulos e números grandes.
- **Inter** (400 a 700): toda a interface.
- Tamanhos: título de ecrã 28, cartão principal 30, secção 20, corpo 15, legendas 12–13. Mínimo 11.

## 4. Forma e ícones

- Raios: cartões 20–28 px, botões em pílula (48–56 px de altura), chips de 40–44 px.
- Ícones de linha com 2 px; o separador ativo usa a versão preenchida.

## 5. Navegação

- **Telemóvel:** barra inferior com Início, Mapa, **+** (viagem já feita, despesa, foto, sítio para ir, ideia), Datas (a Disponibilidade) e Nós.
- **Ecrãs imersivos sem barra:** o sorteio e o dia de viagem.
- **Computador:** menu lateral, coluna principal e coluna lateral com o mapa e os sítios que cabem na janela.
- **Rotas em inglês** `[confirmado]`: `/login`, `/home`, `/trips`, `/expenses`, `/map`, `/wishlist`, `/availability`, `/ideas` e `/us`. A wishlist ("Por ir") não tem separador na barra inferior: abre-se a partir do Início ("Ver tudo"), do cartão do mapa e do menu **+**, e tem entrada própria no menu lateral do computador. Os textos que se veem continuam nas três línguas.

## 6. Padrões

- **Histórias:** cada viagem é um círculo com aro; o aro em gradiente marca memórias novas.
- **Cartão principal:** muda com a fase do mês (próxima janela e sortear, contagem decrescente, viagem em curso, viagem fechada).
- **Sítio por ir:** no mapa é o mesmo pin dos sítios visitados mas só com o contorno a tracejado e mais pequeno, para se distinguir à primeira vista; os filtros "Já fomos" e "Por ir" são botões no topo do mapa e tocar num pin por ir abre um cartão em baixo. Nas listas, as estrelas (1 a 3, em âmbar) ficam à direita; cada pessoa só mexe nas suas.
- **Surpresas:** as sugestões da Conti·GO vivem no fim da página "Por ir", com um interruptor que explica a fatia do sorteio ("cerca de 1 em cada 4 vezes").
- **Calendário da Disponibilidade:** um mês de cada vez, a começar na segunda-feira, com setas e deslize para mudar de mês. Cada dia tem a cor do tipo de turno de quem está a ver; o dia do outro aparece como um ponto no canto, e um aro cor-de-rosa marca os dias livres para os dois. Tocar num dia seleciona-o, tocar noutro estende a seleção; abre-se um painel colado ao fundo com os tipos (um toque aplica), "Novo tipo" e "Limpar marcação". As janelas em comum listam-se por baixo e a próxima aparece no cartão principal do Início.
- **Histórias e viagens:** o topo do Início tem as 8 viagens mais recentes (por data de registo) como histórias em ecrã inteiro (toque à direita passa, à esquerda volta, segurar pausa, deslizar para baixo fecha; cada viagem mostra todas as suas fotos e, se houver nota, o cartão final) e, a seguir, "Ver todas", que abre `/trips`: uma grelha de todas as viagens com a capa e o nome por cima, e um botão para as ver como histórias. As Memórias do Início mostram só as 4 primeiras e um "Ver tudo". No computador, "Viagens" tem entrada própria no menu lateral.
- **Cartão da cebola** (Início): largo, em gradiente escuro de marca. O valor em grande, as fotos de perfil dos dois sobrepostas, uma barra com o que já se gastou do mês e, por baixo, "Para gastar este mês" e "Ver despesas". O cartão do ano ocupa a largura toda, com os 12 meses numa linha.
- **Foto de perfil** (Nós): toca no círculo para escolher (galeria ou câmara); fica recortada em quadrado e pequena. Sem foto, a inicial sobre o gradiente. Aparece no cartão da cebola.
- **Mapa**: filtros numa fila que desliza (Já fomos, Por ir, Voltávamos, A seguir). As casas mostram a foto de perfil de quem lá mora (escolhido em Nós › Onde moras; sem escolha, a casinha). Os pins dos sítios visitados usam a capa da última viagem quando há fotos. A viagem sorteada é um pin maior com halo a pulsar.
- **Despesas** (`/expenses`): o cartão da **Cebola** no Início leva a este ecrã. Em cima, a cebola em grande ("+2264,50 €", em vermelho claro se for negativa) com "o que sobrou dos N meses anteriores" e, por baixo, "Para gastar este mês" (a dotação, mais a cebola, menos o que já se gastou); a dotação mensal de cada um (toca para mudar a tua); depois o gasto por categoria (barras), por viagem (toca para abrir a viagem) e as últimas despesas, com apagar. O **+** do ecrã e a ação **Despesa** do menu + abrem o ecrã de nova despesa (valor, categoria, viagem, nota, dia).
- **Ideias:** uma lista de cartões com filtros por estado (Todas, Por ver, A fazer, Feitas, cada um com a sua contagem). Cada cartão tem o texto, quem o escreveu e quando, e três botões de estado com as cores dos turnos (por ver âmbar, a fazer azul, feita verde); quem escreveu também tem os ícones de mudar e apagar. Abre-se a partir de **Nós** e do menu lateral, e o **+** abre logo o ecrã de escrever.
- **Fotos:** no detalhe da viagem, uma grelha de miniaturas quadradas (3 colunas no telemóvel, 4 no computador) com um quadrado a tracejado para juntar mais; a primeira foto é a capa no topo do ecrã, na história e no cartão de memória do Início, em vez da letra do sítio. Tocar numa miniatura abre-a em ecrã inteiro sobre preto (deslizar ou usar as setas para passar de uma a outra, um contador, a legenda, que se muda com um toque, e o caixote do lixo). Juntar fotos mostra uma barra de progresso e uma linha por foto, com o motivo e "tentar outra vez" se alguma falhar. O **+** pede primeiro a viagem.
- **Folhas que sobem:** no mapa (sítios que cabem), na nova despesa, na viagem já feita e no sítio por ir.
- **Vidro:** fundos desfocados por cima das fotos, para o texto se ler.
- **Confetes:** só no sorteio. O sorteio é um ecrã que sobe e, ao sortear, fica todo com o degradé de marca: um dado a saltar, os nomes a passar cada vez mais devagar até pararem e a revelação com o aro branco, a capa do sítio e os confetes (44 peças). Depois mostra a origem ("Da vossa lista" ou "Surpresa"), as datas e a distância, com "Boa!", "Juntar à lista Por ir" (só nas surpresas) e "Usar o meu veto". Com "reduzir movimento" não há roleta nem confetes: o resultado aparece logo.

## 6b. Movimento `[confirmado]`

Mais animação, sem pesar na interface. Tudo usa os tokens e utilitários de `src/styles.scss`:

- **Entrada em escada** (`ct-rise`, com `--i`): os blocos de cada ecrã sobem e aparecem um a seguir ao outro. Repete-se cada vez que o ecrã volta a aparecer.
- **Aparecer com mola** (`ct-pop`): o logótipo no ecrã de entrada.
- **Toque:** botões encolhem ao carregar e sobem 1 px com o rato; o **+** encolhe e o sinal roda.
- **Separador ativo:** o ícone dá um pequeno salto.
- **Seletores** (língua e aparência): o botão branco desliza para a opção escolhida.
- **Claro e escuro:** as cores passam suavemente de um modo ao outro (350 ms).
- **Vida própria:** o dado do cartão principal flutua, o aro de "Sortear" pulsa e as barras do ano acendem-se uma a uma.
- **Erros:** o campo abana uma vez e a mensagem sobe.
- **Movimento reduzido:** quem tem "reduzir movimento" ligado no sistema não vê animações nem transições.
- Nas funcionalidades novas: pins a cair no mapa, confetes no sorteio, anel do orçamento a encher-se e número da cebola a subir.

## 7. Modo claro e escuro

Segue o sistema por defeito, com interruptor manual. As fotos e os ecrãs imersivos ficam iguais nos dois modos. `[confirmado]`

## 7b. Nome e ícone `[confirmado]`

- **A cebola** é redonda e ligeiramente inclinada, com três traços de camadas só de um lado, sem raízes e com o pin verde no topo. Foi escolhida entre três alternativas para evitar a silhueta simétrica e a fenda vertical da primeira versão. Os ficheiros estão em `brand/` e, para a app, em `app/public/` (`favicon.svg` e `icons/`).

- Em todo o lado onde o nome aparece (título do separador, manifesto da PWA, nome no ecrã inicial do telemóvel) escreve-se **Conti·GO**, com o GO em maiúsculas.
- O ícone do separador é `favicon.svg`: a cebola maior sobre um tile creme, para se ler a 16 px. Tem PNG de reserva (16, 32 e 48 px) para o Safari e outros browsers que ignoram SVG, e `apple-touch-icon.png` para o iPhone.

## 8. Imagens

O protótipo usa ilustrações provisórias. Na app entram as vossas fotos verdadeiras.

## 9. Por rever

1. **Ecrã inicial:** no protótipo passou a ser o Início (histórias, cartão principal, memórias) e o mapa passou a ser o segundo separador. Na visão o mapa era o ecrã inicial. `[proposta]`
2. **Separador Nós:** por desenhar (cebola, retrospetiva, ideias, definições).
3. **Ecrãs em falta:** registo de viagem passada (prioridade do Marco 0), convite e login, lista e detalhe de sítios, ideias.

**Ecrã de abertura (feito):** o `#splash` vive no `index.html` (CSS e logo inline, sem depender do Angular), por isso aparece no primeiro desenho: ícone com um salto, "Conti·GO" com o gradiente e "PÃO E CEBOLA". Segue o tema guardado (ou o do telemóvel). Sai com um fade depois de pelo menos 0,9 s e de se saber se há sessão (`AuthService.ready`, em `main.ts`), para não aparecer o login por engano. Com movimento reduzido não anima. No iOS, o ecrã que o sistema mostra *antes* disto continua a ser só a cor de fundo do manifesto; uma imagem própria (`apple-touch-startup-image`) pede um ficheiro por tamanho de ecrã e ficou de fora.

**Nós e Definições (feito, 14 nov):** **Nós** ficou só com as pessoas (a minha foto e nome, a outra pessoa) e quatro portas: Por ir, Ideias, Despesas e Definições. Tudo o que se configura passou para `/settings`, em grupos: **Dinheiro** (a minha dotação mensal, com a da outra pessoa e o total só para ler), **Histórias** (tempo de cada ecrã: 3, 5, 8 ou 12 s; guardado só neste telemóvel em `SettingsService`, por defeito 5 s), **Idioma e tema**, **Perfil** (nome, onde moras) e **Conta** (palavra-passe, sair). A foto de perfil continua em Nós, onde se vê.

**Datas, 1.ª arrumação (feito, 14 nov):** o título passou a ser "Datas" (igual ao separador) com uma linha a explicar o ecrã; a próxima janela em comum sobe para um cartão em gradiente no topo ("quando podemos ir?" logo à vista); a legenda tem agora três linhas (cor = o teu tipo de dia, ponto = o dia da outra pessoa, aro = livres os dois); a lista de baixo chama-se "Todas as janelas".

**Viagens (feito, 14 nov):** a grelha agrupa-se por ano da viagem (cabeçalho com a contagem do ano), as viagens por fazer (sorteadas, preparadas, a decorrer) aparecem num cartão "A seguir" no topo, e cada cartão tem selos: coração se "voltávamos" e o número de fotos. O botão de histórias mantém a ordem de registo.

**Viagens como feed (feito, 14 nov):** por defeito a página é um feed de uma coluna (`app-trip-post`): cabeçalho com a foto de quem registou, o sítio e a data; foto 4:5 com carrossel que se desliza (contador no canto e pontos por baixo); coração "Voltávamos" e o gasto; legenda com o nome e a nota (3 linhas). Sem fotos mostra a cor do sítio com a inicial. As fotos grandes só se pedem quando o post está a 600 px do ecrã (`IntersectionObserver`). Um botão no topo alterna para a grelha com anos; a escolha guarda-se neste telemóvel (`SettingsService.tripsView`). Em ecrãs largos o feed fica com 520 px, ao centro.

**Viagem individual (feito, 14 nov):** o detalhe ganhou **Corrigir a viagem** (lápis no topo; o mesmo formulário da viagem já feita, aberto preenchido: sítio, mês, com quem, voltávamos, nota; `TripsService.updatePastTrip`, e o gatilho regista quem corrigiu) e uma secção **Despesas** (total, as 5 mais recentes e **Nova despesa** com a viagem já escolhida). O "Gastámos X" passou a ser uma só fonte (`TripLabels.cost`): a soma das despesas registadas e, só se não houver nenhuma, o valor escrito à mão na viagem. Viagens sorteadas não têm lápis.

**Despesas (feito, 14 nov):** tocar numa despesa abre-a para corrigir (valor, categoria, nota, dia; a viagem não muda), na página e no detalhe da viagem; o cartão da cebola ganhou a barra do que já se gastou este mês; a dotação passou a ser uma linha que leva às Definições (onde se muda); as últimas despesas mostram só o sítio e uma linha curta de autoria ("Diogo · há 6 horas · editada"). A autoria só diz "atualizado" quando há quem tenha alterado (linhas anteriores à funcionalidade não aparecem como atualizadas; a migração `audit` acerta o `updated_at` das despesas antigas).

**Formulário "Viagem já feita" (feito, 14 nov):** ordem nova (onde, quando, **fotos**, com quem, voltávamos, nota, gasto); as fotos escolhem-se ao registar (até 12, fila com miniaturas e ×) e enviam-se a seguir à viagem, com o botão a dizer "A enviar fotos 1/3…" (se alguma falhar, a viagem fica guardada e avisa-se); o botão de guardar vive num `<ion-footer class="form-footer">` (em `shared/_form.scss`, para os outros formulários usarem) com fundo sólido e linha em cima, fora da área que desliza, e submete o formulário pelo atributo `form`; o campo do gasto diz que, havendo despesas registadas, contam elas. Ao corrigir uma viagem não há fotos no formulário (juntam-se na galeria da viagem).

**Pesquisa de sítios (feito, 14 nov):** a pesquisa principal passou a ser o Open-Meteo (GeoNames), que entende os nomes em português, espanhol e inglês ("Munique", "Sevilha"); o Photon (OpenStreetMap) fica a completar com sítios pequenos (uma serra, um miradouro). Dá para escrever o país: "Madrid Espanha", "Madrid, Espanha" ou "Espanha, Madrid" (`core/country.logic.ts`, nomes dos países em pt/es/en e alguns apelidos como EUA); escrevendo só o país, a capital vem primeiro (tabela de capitais), a não ser que haja uma cidade com esse nome maior (Granada). A capital leva uma etiqueta. O sítio com o mesmo nome e perto de outro que já existe junta-se a ele (Braga do GeoNames e do OpenStreetMap são um só: `core/places.logic.ts`). O identificador pode agora ser `G<número>` (migração `20261114150000_places_geonames_ref.sql`). A lista de resultados é um popover por baixo do campo, com o seu deslize, que fecha ao escolher, com Esc ou ao sair do campo; o bloco que a contém fica à frente dos outros.

**Formulário "Despesa" (feito, 14 nov):** abre com o teclado no valor (uma despesa nova começa por aí), as categorias têm ícone (comboio, cama, talheres, bilhete, reticências) e o botão de guardar está no `ion-footer.form-footer`, como no da viagem.

**Dinheiro dos dois (feito, 14 nov):** no ecrã Despesas, o cartão "Dinheiro dos dois" mostra o que cada um põe por mês (a minha linha leva às Definições), o total dos dois e o que se gastou este mês, com a parte de cada um (quem registou a despesa). A secção "Mês a mês" (`monthlyLedger`, `core/expenses.logic.ts`) lista cada mês desde o primeiro gasto: o que entrou, o que se gastou e o que ficou (a cebola a crescer; o mês de hoje diz "para gastar" e bate certo com o cartão de cima). Mostram-se os 6 mais recentes, com "Ver todos os meses". As dotações têm histórico (`allowance_history`, migração `20261114160000`): quando alguém muda a sua, o gatilho guarda a mudança com o mês de hoje, e cada mês usa a dotação que valia nessa altura (`monthlyIncome`); a cebola e o mês a mês usam o mesmo histórico. Mudar duas vezes no mesmo mês fica com o último valor, e quem muda só afeta daí para a frente.

**Sítio por ir + imagem do sítio (feito, 14 nov):** ao escolher um sítio na pesquisa (viagem ou por ir, e também nas sugestões), a app vai buscar uma imagem dele à Wikipédia (`core/place-image.service.ts`: pesquisa na língua da app e, depois, em inglês; `place-image.logic.ts` escolhe o artigo que é mesmo o sítio, com coordenadas até 30 km e nome igual, e nunca bandeiras, brasões, mapas nem endereços fora do Wikimedia). A pré-visualização mostra a imagem logo ("Imagem encontrada (Wikipédia)"); ao guardar, a app descarrega-a, reduz-a em JPEG e guarda-a no bucket público `place-images` como `<id do sítio>.jpg`, com o caminho em `places.image_path` (migração `20261114170000_place_images.sql`). É melhor esforço: se falhar, o sítio guarda-se na mesma e fica com as cores. Aparece como faixa no cartão do Por ir, no carrossel do Início, nas histórias, como capa do detalhe e do feed quando a viagem ainda não tem fotos. O formulário do Por ir usa o rodapé fixo `form-footer`. Os sítios que já existiam não têm imagem; só a ganham quando alguém os voltar a escolher na pesquisa.

**Imagens dos sítios que já existiam (feito, 14 nov):** em Definições há o grupo **Sítios** com "Procurar imagens" (`PlaceImageBackfillService`): conta os sítios sem imagem, procura uma para cada (com uma pausa entre pedidos para não sobrecarregar a Wikipédia), mostra o progresso ("3 de 13 · 2 encontradas") e no fim recarrega as viagens e o Por ir. Pode repetir-se: só trata dos que ainda não têm imagem. Em local, 12 dos 13 sítios ganharam imagem (o que não tem morada não tem artigo).

**Formulário "Ideia" (feito, 14 nov):** abre com o teclado no texto (cursor no fim ao corrigir uma ideia) e o botão de guardar no `ion-footer.form-footer`. Já estão assim a viagem já feita, a despesa, o sítio por ir e a ideia; faltam a foto, o tipo de dia e o sorteio.

**Formulário "Juntar fotos" (feito, 14 nov):** as fotos escolhidas aparecem como uma grelha de miniaturas (sem nomes de ficheiro), cada uma com o seu estado por cima: a enviar (roda), enviada (visto) ou erro (toca para tentar outra vez, com o motivo); há um quadrado + para juntar mais; o botão do rodapé fixo muda de "x de y enviadas" (desligado) para "Concluir". Antes de escolher há só a caixa grande de escolher, sem rodapé repetido.

**Seta de voltar (feito, 14 nov):** as páginas secundárias (Viagens, Por ir, Despesas, Ideias, Definições) tinham a seta a apontar sempre para o mesmo ecrã (o Início ou Nós), por isso a partir de Nós ou do Mapa ela ia para o sítio errado. Agora `appBack="/home"` (diretiva em `shared/back.directive.ts`) volta ao ecrã de onde se veio (`NavigationHistory` conta as navegações da app e usa o histórico do browser); só quando se entra diretamente na página (um link, abrir a app nela) vai para o ecrã por defeito.

**Formulário "Tipo de dia" (feito, 14 nov):** abre com o teclado no nome, mostra no topo "Como vai aparecer" (o tipo na cor e com o horário que vai ter nos dias, a mudar enquanto se escreve) e o botão de guardar está no rodapé fixo; apagar o tipo (ao corrigir) fica no fim do formulário. Só falta o sorteio dos ecrãs sem o rodapé fixo.

**Sorteio (feito, 14 nov):** o botão "Sortear" está no rodapé fixo (`form-footer`) em vez de no fim da lista; enquanto a roleta gira a app procura (sem esperar mais de 2,5 s) uma imagem do sítio sorteado, e o resultado mostra-a em grande como um postal (em vez do quadrado com a inicial), guardando-a no sítio se ele ainda não tinha. Com isto, todos os ecrãs que sobem por cima têm o botão principal à vista.

**O plano e o ciclo da viagem (feito, 15 nov):** uma viagem que ainda não acabou tem um plano, venha de um sorteio ou de **Planear uma viagem** (menu +, estado `planned`; sítio com imagem, quem vai e as datas, se já se sabem). O ciclo é *a planear → preparada → em curso → fechada* (`trip-plan.logic.ts`, com o botão do passo seguinte e "Voltar a…"). **Dar como preparada tem uma regra dura** (ver mais abaixo): só com as 3 decisões tomadas e a aprovação dos dois. O plano (`app-trip-plan`, no detalhe da viagem) tem: **Datas** (várias opções com a preferida, "Escolher" fixa as datas), **Como chegar** (uma linha por origem: meio, duração, preço, nota), **Alojamento** (opções com preço total, nota e ligação; uma escolhida), **Orçamento** (estimativa por pessoa e por categoria, "Preencher com o que já sei" a partir do alojamento escolhido e do meio mais barato de cada origem, teto da viagem e o anel do que já se gastou face ao teto), **O que fazer** (ver, fazer, comer, tratar) e **Notas**. Fechar a viagem pede "voltávamos?" e uma nota, mostra se ficaram dentro do teto e guarda o gasto na viagem; passa a memória (feed, mapa, histórias). O cartão do Início e o do Viagens mostram a viagem viva com o passo atual ("Datas por decidir · A planear"); enquanto houver uma viva, não se sorteia outra. Dados: migração `20261115100000_trip_plan.sql` (estado `planned`, `budget_cap_eur`, `dates_confirmed`, `plan_note` em `trips`; tabelas `trip_date_options`, `trip_stays`, `trip_legs`, `trip_budget_lines`, `trip_checklist`; todos leem e escrevem tudo, o autor fica registado, uma só opção escolhida/preferida por viagem). Falta: despesas em viagem com o anel no ecrã de despesas, notificações, partilhar o plano em PDF, e um plano em branco a partir de um modelo (o plano de Salamanca já se passou à mão como teste).

**Início: Por ir com 5 e "Para descobrir" (feito, 15 nov):** o carrossel de "Por ir" mostra até 5 sítios (eram 3). Quando a lista tem menos de 5, aparece por baixo um segundo carrossel, "Para descobrir", com as 8 sugestões mais perto de casa (cada uma com um + que abre o formulário já preenchido). A pesquisa de imagens passou a recusar também bandeiras, brasões e mapas em espanhol e português ("Bandera de…", "Provincia…") e artigos sem coordenadas quando o sítio as tem; antes a Cáceres ficava com um mapa da província.

**Regra para dar a viagem como preparada (feito, 15 nov, migração `20261115110000_plan_approvals.sql`):** só passa de *a planear* a *preparada* com (1) as **datas confirmadas**, (2) o **alojamento escolhido**, (3) a **deslocação escolhida** (uma por origem: Porto e Madrid têm cada uma a sua, as outras da mesma origem são alternativas) e (4) a **aprovação dos dois** (de quem vai, se não vão os dois). Tudo o resto (orçamento, teto, lista, notas) pode ficar vazio. A regra vive na base de dados (gatilho `trips_guard_prepared`, que responde `plan_not_ready: dates,stay,transport,approval`), por isso não há forma de a contornar. Cada pessoa aprova por si (`trip_plan_approvals`, só se insere e apaga a própria) o conjunto das 3 decisões, num cartão **Decisões** no topo do plano que mostra o resumo ( "2 a 4 de dezembro · Hotel Condal · Porto: carro 3h30, Madrid: comboio 1h37"), a foto de cada um com visto quando aprovou e o botão "Aprovo estas decisões" (só ativo depois das 3 decisões). **Mudar uma das 3 decisões apaga as aprovações** (gatilhos em `trips`, `trip_stays` e `trip_legs`), para ninguém ficar aprovado a uma coisa que já mudou. O botão "Dar como preparada" fica desligado e diz o que falta ("confirmar as datas · escolher o alojamento · a aprovação de Diogo"); a aprovação do outro chega em tempo real. A primeira deslocação de uma origem fica escolhida sozinha. Está testado com 10 verificações de acesso e no browser.

**Última vez que cada um entrou (feito, 15 nov, migração `20261115120000_last_seen.sql`):** `profiles.last_seen_at`, escrita pela função `touch_last_seen()` (a hora é a do servidor; cada um só regista a sua; sem sessão não se regista). A app regista ao entrar e sempre que volta ao primeiro plano, no máximo de 5 em 5 minutos. Em **Nós**, o cartão do outro mostra "Esteve aqui há 3 horas" (ou "Está aqui agora", com um ponto verde, se foi há menos de 2 minutos); lê-se ao abrir Nós e de minuto a minuto enquanto lá estás. Os dois veem o do outro; não há ainda uma opção para esconder o próprio.

**Imagens dos sítios, 2.ª versão (feito, 15 nov, migração `20261115130000_place_image_choice.sql`):** a pesquisa automática deixou de usar a "imagem principal" da Wikipédia (muitas vezes antiga, um mapa ou nada) e passou a procurar no **Wikimedia Commons** (`place-image.service.ts`, `pickCommons` em `place-image.logic.ts`): primeiro as fotografias marcadas como *Quality images*, depois as outras; só JPEG grandes (1600 px as de qualidade, 2000 as outras), na horizontal, com o nome do sítio no título (para não ser o castelo de uma vila ao lado), sem bandeiras, mapas, brasões, carros, animais nem portas, e uma de cada série do mesmo autor. Antes disso, tenta a **imagem principal do Wikidata** (propriedade P18, escolhida por pessoas para aquele sítio: mesmo nome, até 30 km); só se não houver, usa as pesquisas acima. A Wikipédia fica só de reserva. Cada imagem guarda o crédito (autor, licença, fonte) e quem a escolheu (`image_source`: `auto` ou `user`). **Escolher a imagem à mão:** o botão da imagem no cartão do Por ir (e no detalhe das viagens por fazer) abre "Imagem do sítio" com a atual, até 9 sugestões para tocar, "Usar uma foto nossa" (da galeria ou câmara) e "Sem imagem". Nas Definições, "Refazer as imagens automáticas" volta a procurar as que a app escolheu sozinha (nunca as escolhidas à mão). Cada troca usa um ficheiro novo (`<id>-<número>.jpg`) para não ficar em cache. A pesquisa pausa 1,2 s entre sítios porque o Wikimedia recusa pedidos a mais (erro 429). O OpenStreetMap não tem fotografias: só mapas e etiquetas.

**Retoques nas memórias e nas histórias (feito, 15 nov):** na linha de ações do cartão da viagem (`trip-post`) o "Voltávamos", as bolinhas e o custo passaram a ter uma zona cada, por isso as bolinhas já não tapam o "Voltávamos"; mostram-se no máximo 7, e a janela acompanha a foto atual. Nas histórias, mudar de viagem tem agora uma transição própria: o painel da viagem nova gira para dentro (de lado, como o cubo do Instagram; ao voltar atrás entra pelo outro lado) e o avatar faz um pequeno salto; passar de foto na mesma viagem continua sem animação. Com movimento reduzido não anima.

**Ecrã de arranque sem branco (feito, 15 nov):** o iOS mostra, ao abrir a app instalada e antes de a página carregar, uma imagem própria; sem ela é sempre branco (o `background_color` do manifesto não conta no iPhone). Há agora 22 imagens em `public/splash/` (11 tamanhos de iPhone × claro e escuro, com o ícone, "Conti·GO" e "PÃO E CEBOLA" ao centro, na mesma posição do splash da página para a passagem não saltar) ligadas no `index.html` com `apple-touch-startup-image` e `prefers-color-scheme`. Gerar de novo: `zsh scripts/make-splash.sh` (a partir de `app/`, usa o Chrome). O iOS só lê isto quando a app é adicionada ao ecrã principal: é preciso apagar e adicionar outra vez. Falta o iPad (a app é pensada para o telemóvel).

**Apagar uma viagem sorteada (feito, 15 nov):** o detalhe da viagem sorteada ganhou o botão "Apagar viagem" por baixo do veto, com um aviso próprio ("sai do sorteio e do plano; podem sortear outra vez"). Antes só havia o veto.

**Sítios por completar para o sorteio (feito, 15 nov, migração `20261115140000_best_months.sql`):** um sítio por ir está *pronto* quando tem duração mínima, estrelas dos dois, **altura ideal** (campo novo `places.best_months`, os meses 1–12; os 12 = "o ano todo") e coordenadas; o custo estimado é opcional e nunca conta (`wish-readiness.logic.ts`). O sorteio é **equilibrado**: os incompletos continuam a poder sair, mas com metade do peso (`INCOMPLETE_WEIGHT` em `buildPool`). A altura ideal **só informa**: aparece no cartão ("Melhor em abril a junho") e não pesa no sorteio; mas se o sorteado cai fora dela, o resultado avisa e oferece **"Sortear outro (não gasta o veto)"**, que apaga essa viagem, deixa a opção de fora e sorteia outra (as opções postas de lado valem só enquanto o ecrã está aberto). O assistente **Preencher** (`complete-wishes.modal`) passa pelos sítios a que falta algo, um de cada vez e só com o que falta: duração, as minhas estrelas (as da outra pessoa só ela as dá: aparece "à espera de …"), meses (`app-month-picker`, também no formulário de juntar um sítio) e localização (pesquisa no geocoder). Abre-se por um aviso no topo do Por ir ("N sítios por completar · Preencher"), pela linha "Falta: …" de cada cartão, pelo sorteio (linha no resumo da rotação e "Completar este sítio" no resultado).

**Ecrã de arranque, ajuste (15 nov):** as imagens que dependiam do tema (`prefers-color-scheme` no `media`) não resultaram no iPhone, por isso ficou só a versão **escura**, sem condição de tema, para 12 tamanhos (agora também os "mini", 360×780). Quem tem a app em tema claro vê um arranque escuro. É preciso apagar a app do ecrã principal e adicioná-la outra vez.

## Contagem decrescente no Início

Com uma viagem sorteada e datas confirmadas, a folha do cartão grande deixa de mostrar o mês/dia e passa a mostrar a contagem: "12 dias" (o número grande, "dias" na faixa). Durante a viagem mostra "DIA 2" e o texto "Dia 2 de 4". A data continua escrita por baixo do nome. Lógica em `tripCountdown` (`trips.logic.ts`). Sem viagem sorteada, a folha mostra a próxima janela livre como antes.

## Splash (ajuste final)

O `#splash` ultrapassa 120 px o ecrã em cima e em baixo (cobre a zona do indicador de início), `html`/`body` ficam escuros desde o primeiro desenho e o `background_color` do manifest é escuro.

## Contagem decrescente no Início

Com uma viagem sorteada e datas confirmadas, a folha do cartão grande deixa de mostrar o mês/dia e passa a mostrar a contagem: "12 dias" (o número grande, "dias" na faixa). Durante a viagem mostra "DIA 2" e o texto "Dia 2 de 4". A data continua escrita por baixo do nome. Lógica em `tripCountdown` (`trips.logic.ts`). Sem viagem sorteada, a folha mostra a próxima janela livre como antes.

## Splash (ajuste final)

O `#splash` ultrapassa 120 px o ecrã em cima e em baixo (cobre a zona do indicador de início), `html`/`body` ficam escuros desde o primeiro desenho e o `background_color` do manifest é escuro.

## Encontros (visitas sem ser viagem)

Tabela `meetings` (`20261115150000_meetings.sql`): dias em que estão juntos sem ser uma viagem. Tem `at_place` (`porto`, `madrid`, `other`), por isso serve nos dois sentidos (ela vem ao Porto ou ele vai a Madrid) e lê-se bem a partir dos dois telemóveis. O contador do Início conta para o próximo momento juntos: o que estiver a decorrer ou o que começar primeiro entre os encontros e a viagem sorteada (só com datas confirmadas); `nextEncounter` em `meetings.logic.ts`. Marcar: menu "+", botão no cartão do Início e secção "Encontros" na página Datas. Sem nada marcado, a folha mostra "dias ?".

## Dias juntos (página Nós)

Cartão entre o cartão do outro e os atalhos: "23 dias juntos em 2026" e "O último encontro foi há 9 dias". `togetherStats` (`meetings.logic.ts`) junta os dias dos encontros e das viagens feitas a dois com o dia exato (as só com o mês ficam de fora), sem duplicar sobreposições, só até hoje e só do ano em curso. Sem nada marcado mostra 0 e um convite a marcar encontros.

## Splash sem salto

A imagem de arranque do iOS (grande: ícone a 30% da largura, nome a 11%, legenda a 4%) e o `#splash` da página tinham tamanhos diferentes, e o da página entrava com animação a partir de opacidade 0: o logótipo parecia desaparecer e voltar. Agora o `#splash` usa as mesmas proporções (em `vw`, com limite em ecrãs largos) e, na app instalada (`navigator.standalone` ou `display-mode: standalone`), fica escuro e parado, igual à imagem, e só depois esmorece. No browser normal mantém a animação de entrada.

## Atualizações sem interromper

O `UpdateService` já não recarrega a página quando acha uma versão nova a meio do uso (o que fazia o splash aparecer outra vez por cima da app). Procura ao abrir e ao voltar ao primeiro plano, só regista que há versão nova, e aplica-a (recarrega) apenas no momento em que a app volta ao primeiro plano, antes de lhe tocarem: parece uma abertura normal.

## Splash: passagem para a app

Medido a gravar o arranque no simulador (capturas seguidas): o splash da página animava a entrada (logótipo a saltar, nome a subir), saía antes de a primeira página estar desenhada (ficava um ecrã em branco) e a página de entrada repetia a animação do logótipo, parecendo um segundo splash. Agora o splash da página é parado (igual à imagem de arranque do iOS), só sai quando a primeira navegação acabou e foi desenhada (`firstPageDrawn` em `main.ts`, com limite de 4 s) e esmorece só com opacidade; o logótipo da página de entrada já não "salta".

O "piscar" na troca da imagem de arranque do iOS para a página tinha duas causas prováveis: o ícone do splash era um ficheiro à parte (aparecia depois do fundo) e o fundo escuro dependia de um script. Agora o ícone vai inline (`data:`) no `index.html` e `@media (display-mode: standalone)` põe o fundo e o splash escuros logo no primeiro desenho, sem esperar pelo script.

Visto num vídeo do iPhone (frames seguidas): na troca da imagem de arranque para o splash da página havia ~25 px de diferença na vertical (dois logótipos sobrepostos um instante), porque a altura que o iOS dá à página no primeiro desenho não é a final. Na app instalada o script fixa agora a altura do splash à do ecrã (`screen.height`, `top: 0`), que não muda, e o logótipo fica sempre no centro exato, onde a imagem de arranque o tem.

## Hora nos encontros e contador ao vivo

`meetings.start_time` (opcional, migração `20261116150000_meeting_time.sql`). Com hora e a menos de 24 h, a folha do Início vira um relógio ("FALTAM 2:26:55") que avança de segundo a segundo, e o texto diz "daqui a 2 h 26 min"; a 24 h ou mais conta dias de calendário, e depois da hora mostra "DIA 1/2". Sem hora, tudo como antes. O relógio da página só corre de segundo a segundo quando há horas a contar (senão, de minuto a minuto). A ordem dos encontros no mesmo dia usa a hora. `meetingCountdown` e `clockParts` em `meetings.logic.ts`.

A tabela `meetings` ganhou `updated_by`: a função `set_updated_at()` (audit) escreve nessa coluna, e sem ela qualquer edição de um encontro falhava.

## Roteiro da viagem (pedir a um chat, colar a resposta)

Sem IA dentro da app (não há chave de API): o detalhe da viagem tem a secção "Roteiro". "Pedir roteiro" compõe um pedido com o que a app sabe (sítio, datas, orçamento, pontos de partida, alojamento escolhido, o que já queriam ver/fazer/comer, as notas do plano), o ritmo e uma descrição livre do que querem (o que mais pesa), mais o formato JSON da resposta (`buildRequest` em `itinerary.logic.ts`). Copia-se, cola-se num chat, e a resposta cola-se de volta em "Colar roteiro": `parseItinerary` valida e corrige (horas, custos, categorias, só ligações http(s)) e conta o que não aproveitou. Entra como **rascunho** (`trip_itineraries`, status `draft`, com `trip_itinerary_items`), com aviso "sugestão do chat, confirma antes de ir"; só passa a roteiro aceite quando se toca em "Aceitar" (substitui o anterior). Cada viagem tem no máximo um rascunho e um roteiro aceite. Cada atividade: dia (1, 2, 3…, serve com datas por fechar), horas, título, categoria (ver/comer/fazer/deslocação/descanso/outro), descrição, sítio, morada (ligação ao mapa), custo estimado por pessoa, reserva a tratar, ligação e dica; mais um resumo e dicas gerais. Do roteiro aceite sai o custo estimado por categoria, e "Usar no orçamento" põe-no nas estimativas de comida, atividades, transportes e outros (só as categorias que o roteiro tem). Migração `20261116160000_trip_itinerary.sql`.

## Documentos da viagem

- No detalhe da viagem, a secção **Documentos** (a seguir ao Roteiro) tem **post-its** (texto até 600 caracteres, 5 cores, fixar no topo) e **ficheiros** (PDF e imagens até 10 MB: bilhetes, reservas, seguros).
- Os post-its são sempre claros, com letra escura, também no modo escuro, e levemente inclinados: é o que lhes dá o ar de papel. Os novos saem de cores diferentes (rodam).
- Os ficheiros vão para o bucket privado `trip-documents` (`<viagem>/<documento>.<extensão>`); o nome verdadeiro e a nota ficam na tabela `trip_documents`. Abrem-se com um link temporário (10 min), numa janela aberta no toque (o iOS bloqueia janelas abertas depois de esperar).
- Apagar a viagem apaga também os ficheiros do bucket (`TripDocsService.removeFilesOfTrip`).
- SQL: `app/supabase/migrations/20261118100000_trip_documents.sql` e a versão repetível `app/supabase/manual/documentos.sql`.

## A cebola e os depósitos

A cebola é **tudo o que os dois têm para gastar agora**: o que sobrou dos meses fechados, mais o que entrou este mês
(as dotações de cada um e os depósitos), menos o que já se gastou. Pôr dinheiro faz o número subir no mesmo instante.
O ecrã Despesas mostra a conta à vista (de trás, dotações, depósitos, gasto) e tem "Como funciona a cebola". Os
depósitos (`onion_deposits`) são dinheiro avulso, com dia e nota, que conta para o mês desse dia; um depósito marcado
para depois de hoje só conta quando chegar. A lógica vive em `core/expenses.logic.ts` (`cebola`, `monthlyLedger`) e
`core/deposits.logic.ts`.
