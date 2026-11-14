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
