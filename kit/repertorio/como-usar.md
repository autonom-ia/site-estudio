# Repertório de referências

Para o assistente. A pessoa nunca lê este arquivo: fale com ela em palavras simples, como manda o `AGENTS.md`.

São 42 fichas de sites reais e no ar, separadas pela **ação de quem visita** o site. Cada arquivo `<ação>.json` desta pasta é uma ação. O repertório vem dentro do `kit/`, então chega a todo mundo pela atualização do estúdio; não copie para a pasta da pessoa.

| Arquivo | Quem visita quer |
|---|---|
| `pedir.json` | fazer um pedido ou uma encomenda |
| `reservar.json` | marcar horário ou reservar |
| `comprar.json` | comprar e pagar |
| `simular.json` | calcular antes de decidir |
| `escolher.json` | ver como fica cada opção antes de decidir |
| `visitar.json` | ir até o lugar |
| `orcar.json` | pedir um orçamento |
| `participar.json` | se inscrever, matricular, doar ou aparecer no encontro |

## Da ação do brief ao arquivo

A ação principal do brief nem sempre tem o nome do arquivo. Ligar e chamar no WhatsApp são o canal, não a ação: o que conta é a dúvida que vem antes do contato. Pergunte-se o que a pessoa vai pedir nessa conversa e siga a tabela. Assim, o mesmo brief leva sempre ao mesmo arquivo.

| Ação no brief | Arquivo |
|---|---|
| fazer pedido, encomendar | `pedir.json` |
| reservar, marcar horário, agendar consulta ou aula | `reservar.json` |
| comprar, pagar | `comprar.json` |
| calcular, simular, cotar | `simular.json` |
| escolher entre opções, ver como fica | `escolher.json` |
| visitar, ir até o lugar | `visitar.json` |
| pedir orçamento | `orcar.json` |
| se inscrever, matricular, doar, participar | `participar.json` |
| ligar ou chamar no WhatsApp para encomendar ou pedir algo pronto | `pedir.json` |
| ligar ou chamar no WhatsApp para marcar consulta, sessão ou horário (dentista, advogado, salão) | `reservar.json` |
| ligar ou chamar no WhatsApp para saber o preço de um serviço sob medida (obra, conserto, projeto) | `orcar.json` |
| ligar ou chamar no WhatsApp para tirar dúvida antes de decidir | `escolher.json` (qual opção) ou `orcar.json` (quanto custa) |

## Só link, nunca imagem

O estúdio guarda de cada referência só o endereço público e o que aprendemos com ela. Nenhum print, logo, foto ou texto de outra marca entra no estúdio, na pasta do site ou no site. As marcas citadas pertencem aos seus donos; a lista não diz que elas apoiam o estúdio.

## O que tem em cada ficha

| Campo | O que é |
|---|---|
| `id` | nome curto da ficha, para citar no `referencias.md` |
| `nome` e `link` | o site e o endereço público (a entrada do site, que muda menos que as páginas internas) |
| `ondeVer` | o caminho do `link` até a parte da página onde o princípio aparece. Quase nunca é a capa |
| `ramo` | o ramo do site. É só contexto: nunca é o critério de escolha |
| `duvida` | a dúvida de quem visita que aquela página resolve, nas palavras de quem visita |
| `principio` | por que funciona, em uma frase |
| `comoFazemosAqui` | como o estúdio entrega a mesma ideia num site sem servidor: `padrao` (um dos cinco jeitos abaixo, ou um dos dois de 3D) e `texto` (a adaptação) |
| `noCelular` | como a ideia fica na tela pequena |
| `naoTrazer` | o que é da marca deles, ou o que não cabe num site sem servidor |
| `conferidaEm` | opcional: o dia (AAAA-MM-DD) em que a ficha foi conferida ao vivo, seguindo o `ondeVer`. Obrigatório nas fichas de 3D |

## Como escolher (etapa 3 da skill `novo-site`)

1. **Parta do brief, não do ramo.** Leia a ação principal e responda: "o que a pessoa que chega precisa saber, ou ver, para fazer isso?" Essa é a **dúvida que a página resolve**.
2. Abra o arquivo da ação principal, pela tabela "Da ação do brief ao arquivo". Se a dúvida mistura duas ações (ver o lugar e reservar), abra também o da segunda. Não leia os oito.
3. Compare a `duvida` de cada ficha com a dúvida do brief, pelo sentido. Escolha **2 ou 3** fichas. Pelo menos **2 de outro ramo**: é nelas que mora a ideia que o ramo ainda não usa. Uma do mesmo ramo pode entrar, se ensinar algo que as outras não ensinam.
4. **Confira ao vivo só as escolhidas.** Abra o `link` de cada uma, siga o `ondeVer` até a parte da página onde o princípio aparece e veja se ele ainda está lá. A capa sozinha não confere nada. Nunca abra todas.
   - **O site recusa leitura automática** (acesso negado, 403, 405, tela de "confirme que você é humano", ou nenhuma resposta enquanto os outros sites abrem): ele **não saiu do ar**. Abra no navegador do seu programa, se ele tiver um. Se esse navegador for o da própria pessoa (como a extensão do Claude no Chrome), peça licença antes, como no `ler`. Sem navegador, escolha outra ficha do mesmo arquivo e anote na coluna Observação do `referencias.md`: "trocada: o site recusa leitura automática". Nunca escreva que saiu do ar, nem a data de uma conferência que não aconteceu.
   - **O princípio mudou** (a página existe, mas não faz mais o que a ficha diz): troque de ficha e anote a troca.
   - **Saiu do ar** só quando o endereço não existe (página não encontrada, domínio sem dono).
5. Some as referências que a pessoa indicou, no mesmo formato. Se uma delas não está no repertório, escreva você a dúvida, o princípio e o `comoFazemosAqui`.
6. Registre no `referencias.md` do site (a tabela do molde): endereço, ramo, motivo (a dúvida que ela resolve e por que serve a este brief), princípio, como fazemos aqui, como fica no celular, a data em que conferiu ao vivo e, se houver, a observação (a troca de ficha e o porquê).
7. Diga à pessoa, em uma ou duas frases, o que vai aproveitar. Exemplo: "Vou usar a ideia de um site de óculos: três perguntas que diminuem as opções. No seu caso, para escolher o tamanho do quadro da bicicleta."

## Os cinco jeitos de fazer aqui

Tudo roda na própria página, com os dados do `fatos.md`. Nada de servidor, conta, mapa embutido ou serviço pago. Sem JavaScript, a página continua útil: aparece a primeira opção e um link simples de contato.

### `troca-de-fotos`: configurador por troca de fotos reais

- Um grupo de opções feito com botões de rádio estilizados (ou botões com `aria-pressed`), nunca `<select>`. Cada opção troca a foto real, a legenda e, se houver, o preço.
- Uma foto real por opção, no mesmo ângulo, luz e tamanho; o `width` e o `height` iguais evitam a página pular. Peça essas fotos à pessoa na coleta.
- Alvo de toque de 44 px ou mais, foco visível, o nome da opção escrito (cor não basta), o anúncio da troca num `aria-live="polite"`.
- A escolha final vai escrita no texto do WhatsApp ou ao lado do link de pagamento.

### `pedido-no-whatsapp`: pedido montado na página e enviado pelo WhatsApp

- Itens reais do `fatos.md` com preço, botões de menos e mais (com nome acessível, como "Mais uma câmara de ar") e a quantidade num `aria-live`.
- O total somado na página. O botão monta o endereço `https://wa.me/<número com país e DDD, só dígitos>?text=<mensagem>`, com a mensagem passada por `encodeURIComponent`.
- A mensagem é legível para quem atende: uma linha por item, o total e os dados que a casa pediu (bairro, data, nome).
- Sem JavaScript: um link de WhatsApp com um texto padrão. No celular, a barra com o total pode ficar presa no pé; lembre que a conferência fotografa elementos presos.

### `link-de-pagamento-ou-agenda`: link de pagamento ou de agenda

- O link é da pessoa: o link de pagamento do banco, da maquininha ou da loja, ou a página da agenda online que ela já usa. O estúdio não cria conta, não cobra e não guarda nada.
- O link entra no `fatos.md` com a fonte ("a própria pessoa mandou em <data>"). O botão diz o que acontece ("Pagar R$ 90 pelo link seguro do banco", "Ver horários livres").
- Se a pessoa não tem link, use o `pedido-no-whatsapp` e diga o que muda quando ela tiver.

### `simulador-na-pagina`: simulador feito na própria página

- Poucos campos (um ou dois números, ou perguntas em botões), conta em JavaScript no `site.js`, resultado num `aria-live`, sem recarregar.
- Toda taxa, preço ou fórmula vem do `fatos.md`, com fonte e data. Se é estimativa, a página diz que é estimativa.
- `inputmode="decimal"` nos números, rótulo escrito em cada campo, mensagem clara quando o valor não serve.
- O botão leva o resultado para o WhatsApp ou para o link da pessoa.

### `mapa-por-botao`: mapa por botão que abre o Maps ou o Waze

- Nunca embutir mapa: carrega endereço de fora (o `checar` reprova) e pesa.
- O endereço completo escrito em texto, e dois botões: `https://www.google.com/maps/search/?api=1&query=<endereço>` e `https://waze.com/ul?q=<endereço>&navigate=yes`, com o endereço do `fatos.md` passado por `encodeURIComponent`.
- Horário de hoje e uma referência de quem chega (foto real da fachada, ponto de referência) ajudam mais que o mapa.

## 3D: só com prova e com limite

Dois jeitos usam 3D. Os dois têm demo própria do estúdio em `kit/demos/3d/`, por cima do molde: `./estudio novo <nome> --demo 3d` cria o site de exemplo (página inicial com a marca em 3D, página `monte` com o configurador) para você ver, fotografar com `./estudio prints <nome>` e copiar as peças. A demo é do negócio fictício e nunca vai ao ar.

**Quando usar.** Só quando ver a peça de vários lados, ou a marca ganhar corpo, ajuda a pessoa a decidir, e o brief tem o que mostrar: um produto de forma simples com opções (cor, acabamento, um opcional) ou uma forma que já é da marca.

**Quando não usar.**
- O negócio não precisa: serviço, consulta, comida, lugar. Foto real conta mais que objeto desenhado; use `troca-de-fotos`.
- Já existem fotos reais de cada opção: `troca-de-fotos` é mais leve e mais verdadeira.
- A peça é complexa (carro inteiro, móvel com tecido, roupa no corpo): o modelo passa do limite e parece de mentira.
- O público usa celular fraco ou internet ruim: o 3D esquenta o aparelho e demora; a imagem de reserva já resolve.
- Para enfeitar: um 3D por página, no máximo, e nunca no lugar do texto ou da ação principal.

**Obrigatório, sempre** (as demos fazem assim; copie o jeito):
- Todo o código do 3D em `site/assets/3d/`. A página só baixa o carregador (`3d.js`); o motor e a cena baixam quando o palco chega perto da tela.
- Imagem de reserva no palco desde o começo (desenho parado da mesma peça): é o que aparece sem WebGL, com "reduzir movimento" ligado e se algo falhar.
- Teclado e leitor de tela: escolhas em botões de rádio dentro de `<fieldset>` com `<legend>`, a escolha escrita num `aria-live`; forma só de enfeite leva `aria-hidden`.
- Cores da marca, lidas dos tokens: a peça muda junto com a marca.
- Limite de peso: todo o código do 3D até **200 KB comprimido** e cada modelo até **1,5 MB**. Entra na conta tudo de `site/assets/3d/`, todo `.wasm` e toda biblioteca que fala com o WebGL, em qualquer pasta (o three.js sozinho passa de 170 KB). O modelo `.gltf` soma os `.bin` e as texturas dele; `.glb` e `.obj` contam sozinhos. O `checar` reprova acima (`3d-pesado`). As demos, em WebGL puro, somam cerca de 14 KB.
- As fotos de conferência esperam cada cena abrir. `CENA_3D_NAO_ABRIU` (saiu a imagem parada; o motivo vem junto), `CENA_3D_VAZIA` (o palco saiu liso) e `CENA_3D_FORA_DA_FOTO` (o palco não aparece na foto) se corrigem antes de mostrar.
- Movimento que ninguém pediu para em até 5 s (a peça gira sozinha só no começo). Falha no 3D aparece no console e o `checar` mostra; a imagem de reserva fica no lugar.

### `configurador-3d`: a peça muda na hora com cada escolha

- Demo: seção `kit/demos/3d/_gerador/secoes/configurador-3d.mjs` e cena `site/assets/3d/caramanhola-3d.js`. O perfil da peça mora na seção e serve ao 3D e à imagem de reserva.
- Poucas escolhas, todas do `fatos.md`, cada uma com o nome escrito (cor sozinha não basta). A imagem de reserva acompanha a escolha só com CSS.
- A escolha final vai escrita no texto do WhatsApp, como no `pedido-no-whatsapp`. Arrastar gira a peça; ninguém precisa girar para decidir.

### `marca-em-3d`: uma forma da marca reage à rolagem e ao ponteiro

- Demo: seção `kit/demos/3d/_gerador/secoes/abertura-3d.mjs` e cena `site/assets/3d/raio-3d.js` (a roda raiada da oficina de exemplo).
- Discreta: não gira sozinha, só responde à rolagem e ao ponteiro, e parada não gasta bateria. Fica ao lado da assinatura do topo, nunca por cima do texto.
- A forma é da marca da pessoa (o símbolo, o produto, um objeto do ofício). Sem forma própria, não use.

## Quando nenhuma ficha serve

Se nenhuma dúvida do repertório chega perto da do brief, mesmo depois da tabela "Da ação do brief ao arquivo", procure de 2 a 3 sites reais com o mesmo objetivo (de qualquer ramo) e escreva a ficha deles no `referencias.md`, no mesmo formato. Nunca invente uma referência que você não abriu.

## Para quem mantém o estúdio

`node kit/scripts/manutencao/links-do-repertorio.mjs` abre todos os links e lista os que não respondem normalmente, separando quem recusa leitura automática (está no ar) de quem saiu do ar. Fica fora do `npm test` porque depende da internet. Ficha fora do ar se troca; ficha que só recusa leitor fica, porque a instrução do passo 4 cobre.
