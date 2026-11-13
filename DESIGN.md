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

- **Telemóvel:** barra inferior com Início, Mapa, **+** (foto, despesa, sítio, ideia), Datas (a Disponibilidade) e Nós.
- **Ecrãs imersivos sem barra:** o sorteio e o dia de viagem.
- **Computador:** menu lateral, coluna principal e coluna lateral com o mapa e os sítios que cabem na janela.

## 6. Padrões

- **Histórias:** cada viagem é um círculo com aro; o aro em gradiente marca memórias novas.
- **Cartão principal:** muda com a fase do mês (próxima janela e sortear, contagem decrescente, viagem em curso, viagem fechada).
- **Folhas que sobem:** no mapa (sítios que cabem) e na nova despesa.
- **Vidro:** fundos desfocados por cima das fotos, para o texto se ler.
- **Confetes:** só no sorteio.

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

- Em todo o lado onde o nome aparece (título do separador, manifesto da PWA, nome no ecrã inicial do telemóvel) escreve-se **Conti·GO**, com o GO em maiúsculas.
- O ícone do separador é `favicon.svg`: a cebola maior sobre um tile creme, para se ler a 16 px. Tem PNG de reserva (16, 32 e 48 px) para o Safari e outros browsers que ignoram SVG, e `apple-touch-icon.png` para o iPhone.

## 8. Imagens

O protótipo usa ilustrações provisórias. Na app entram as vossas fotos verdadeiras.

## 9. Por rever

1. **Ecrã inicial:** no protótipo passou a ser o Início (histórias, cartão principal, memórias) e o mapa passou a ser o segundo separador. Na visão o mapa era o ecrã inicial. `[proposta]`
2. **Separador Nós:** por desenhar (cebola, retrospetiva, ideias, definições).
3. **Ecrãs em falta:** registo de viagem passada (prioridade do Marco 0), convite e login, lista e detalhe de sítios, ideias.
