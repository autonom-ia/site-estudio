# Repertório de referências

Para o assistente. A pessoa nunca lê este arquivo: fale com ela em palavras simples, como manda o `AGENTS.md`.

São 40 fichas de sites reais e no ar, separadas pela **ação de quem visita** o site. Cada arquivo `<ação>.json` desta pasta é uma ação. O repertório vem dentro do `kit/`, então chega a todo mundo pela atualização do estúdio; não copie para a pasta da pessoa.

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
| `comoFazemosAqui` | como o estúdio entrega a mesma ideia num site sem servidor: `padrao` (um dos cinco abaixo) e `texto` (a adaptação) |
| `noCelular` | como a ideia fica na tela pequena |
| `naoTrazer` | o que é da marca deles, ou o que não cabe num site sem servidor |

## Como escolher (etapa 3 da skill `novo-site`)

1. **Parta do brief, não do ramo.** Leia a ação principal e responda: "o que a pessoa que chega precisa saber, ou ver, para fazer isso?" Essa é a **dúvida que a página resolve**.
2. Abra o arquivo da ação principal, pela tabela "Da ação do brief ao arquivo". Se a dúvida mistura duas ações (ver o lugar e reservar), abra também o da segunda. Não leia os oito.
3. Compare a `duvida` de cada ficha com a dúvida do brief, pelo sentido. Escolha **2 ou 3** fichas. Pelo menos **2 de outro ramo**: é nelas que mora a ideia que o ramo ainda não usa. Uma do mesmo ramo pode entrar, se ensinar algo que as outras não ensinam.
4. **Confira ao vivo só as escolhidas.** Abra o `link` de cada uma, siga o `ondeVer` até a parte da página onde o princípio aparece e veja se ele ainda está lá. A capa sozinha não confere nada. Nunca abra as 40.
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

- **A página diz o que dá para pedir.** Cada item é uma linha do `fatos.md`, com a fonte: o produto, o tamanho, o sabor, o serviço, e o preço e o prazo quando a fonte traz. Se a fonte só cita o tipo de coisa (por exemplo, a bio diz "rodas montadas sob encomenda"), esses tipos viram as opções. Se nenhuma fonte diz o que dá para pedir, não monte o pedido: use um botão de WhatsApp com a mensagem pronta e ponha "o que dá para pedir, e com quanto tempo de antecedência" nas Pendências do `andamento.md`. Um campo de texto livre sozinho ("escreva o que você quer") não é pedido montado.
- **Nada vem marcado sem fonte.** Nenhuma opção começa marcada (dia, tamanho, para quem), a não ser que uma linha do `fatos.md` sustente a escolha (o único tamanho que existe, o único dia de entrega). Opção marcada por padrão põe na boca de quem visita uma promessa ou uma escolha que a casa não fez.
- **Use a peça pronta `kit/pecas/pedido.js`.** Copie para `site/assets/js/pedido.js` e carregue no fim da parte do pedido; o cabeçalho dela diz os atributos que a parte escreve. Ela junta a mensagem, soma o total, monta o endereço `https://wa.me/<número com país e DDD, só dígitos>?text=<mensagem>` e avisa o leitor de tela. Não reescreva essa conta à mão: é nela que nascem a mensagem vazia e a palavra repetida.
- **A mensagem pronta nunca sai vazia.** A abertura (`data-mensagem`) é uma frase completa que diz sozinha o que a pessoa quer ("Olá! Quero encomendar na <nome da casa>."), sem dois-pontos no fim. Abaixo dela, uma linha por item escolhido, o total e uma linha por campo preenchido ("Para o dia: 25/12/2026"). Os rótulos não repetem palavra da abertura: se a abertura diz "Quero", nenhum rótulo diz "Quero" de novo. O botão já sai do gerador com a abertura no endereço: sem JavaScript, ele funciona.
- **O leitor de tela fala uma vez, não a cada letra.** O resumo visível da mensagem nunca é região viva (sem `aria-live`). Quem fala é uma linha à parte com `role="status"`, e só quando a pessoa termina um campo ou envia (a peça faz assim). Botões de menos e mais têm nome acessível ("Mais uma câmara de ar").
- No celular, a barra com o total pode ficar presa no pé; lembre que a conferência fotografa elementos presos.

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

## Quando nenhuma ficha serve

Se nenhuma dúvida do repertório chega perto da do brief, mesmo depois da tabela "Da ação do brief ao arquivo", procure de 2 a 3 sites reais com o mesmo objetivo (de qualquer ramo) e escreva a ficha deles no `referencias.md`, no mesmo formato. Nunca invente uma referência que você não abriu.

## Para quem mantém o estúdio

`node kit/scripts/manutencao/links-do-repertorio.mjs` abre os 40 links e lista os que não respondem normalmente, separando quem recusa leitura automática (está no ar) de quem saiu do ar. Fica fora do `npm test` porque depende da internet. Ficha fora do ar se troca; ficha que só recusa leitor fica, porque a instrução do passo 4 cobre.
