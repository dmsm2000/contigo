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

- **Telemóvel:** barra inferior com Início, Mapa, **+** (viagem já feita, foto, sítio para ir, ideia; a despesa entra no menu quando existir, sem um "em breve" antes), Datas (a Disponibilidade) e Nós.
- **Ecrãs imersivos sem barra:** o sorteio e o dia de viagem.
- **Computador:** menu lateral, coluna principal e coluna lateral com o mapa e os sítios que cabem na janela.
- **Rotas em inglês** `[confirmado]`: `/login`, `/home`, `/map`, `/wishlist`, `/availability`, `/ideas` e `/us`. A wishlist ("Por ir") não tem separador na barra inferior: abre-se a partir do Início ("Ver tudo"), do cartão do mapa e do menu **+**, e tem entrada própria no menu lateral do computador. Os textos que se veem continuam nas três línguas.

## 6. Padrões

- **Histórias:** cada viagem é um círculo com aro; o aro em gradiente marca memórias novas.
- **Cartão principal:** muda com a fase do mês (próxima janela e sortear, contagem decrescente, viagem em curso, viagem fechada).
- **Sítio por ir:** no mapa é o mesmo pin dos sítios visitados mas só com o contorno a tracejado e mais pequeno, para se distinguir à primeira vista; os filtros "Já fomos" e "Por ir" são botões no topo do mapa e tocar num pin por ir abre um cartão em baixo. Nas listas, as estrelas (1 a 3, em âmbar) ficam à direita; cada pessoa só mexe nas suas.
- **Surpresas:** as sugestões da Conti·GO vivem no fim da página "Por ir", com um interruptor que explica a fatia do sorteio ("cerca de 1 em cada 4 vezes").
- **Calendário da Disponibilidade:** um mês de cada vez, a começar na segunda-feira, com setas e deslize para mudar de mês. Cada dia tem a cor do tipo de turno de quem está a ver; o dia do outro aparece como um ponto no canto, e um aro cor-de-rosa marca os dias livres para os dois. Tocar num dia seleciona-o, tocar noutro estende a seleção; abre-se um painel colado ao fundo com os tipos (um toque aplica), "Novo tipo" e "Limpar marcação". As janelas em comum listam-se por baixo e a próxima aparece no cartão principal do Início.
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
