---
name: novo-site
description: Faz um site de primeira linha do começo ao fim no Site Estúdio, pelo método da fábrica de sites - coleta com fonte, brief (aprovação), referências reais lidas como princípio, direção visual com tese em uma frase, piloto do topo + parte comum + pico no computador e no celular (aprovação), construção por parte no gerador, preflight mecânico, fotos em 4 tamanhos lidas uma a uma, revisão independente com meta 8,5 e pacote pronto para hospedar. Use quando a pessoa quiser um site novo, refazer o site que já tem, continuar um parado (sites/*/andamento.md) ou mudar páginas de um site existente.
---

# Novo site

Um site de primeira linha não nasce de um molde: nasce de uma ideia visual clara, de tipografia com personalidade, de foto de verdade e de movimento que conduz o olhar. O que separa um site premium de um genérico é direção, não programa. O caminho é sempre o mesmo, e a pessoa decide em dois portões: o brief e o piloto.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`), de dentro da pasta do estúdio. Leia só a última linha (JSON): `ok`, `codigo`, `resumo`, `arquivos`, `avisos`, `dados`. Saída 2 = reprovado: corrija pela causa e rode de novo. Traduza `codigo` por `kit/mensagens.json`. No Codex, os comandos que rodam fora da área protegida são os do `AGENTS.md`, seção das caixinhas de permissão.

**Regra de ouro:** código só confere fato (link morto, letra que não carregou, contraste, texto vazando, número sem fonte). Gosto, história, layout e voz são seus e dos revisores; a palavra final é da pessoa. Nenhum comando diz se o site é bonito.

## As quatro regras da primeira versão

Um piloto com um negócio de verdade mostrou o que leva a primeira versão de "parece modelo" para "ficou muito bom" sem rodadas a mais de revisão. Valem desde o primeiro desenho:

1. **Coleta visual antes da direção.** Antes de escrever `direcao.md`, junte em `material/fotos/` até 20 fotos reais do negócio (o lugar, a gente, o trabalho), cada uma com a legenda e a data de onde veio. Entram só as fotos que a pessoa mandou e as lidas que ela autorizou no portão 1 (o brief). Foto que a pessoa manda vai para `material/fotos/` com a legenda e a data; se ela pôs em `referencias/`, copie de lá. Os sites de referência vêm do repertório na Etapa 3, guardados só pelo endereço: nenhum print de outra marca entra na pasta. Sem fotos e referências, a direção nasce da imaginação e sai genérica. Foto tirada de rede social chega pequena: avise a pessoa em uma frase e peça os arquivos originais. Se a pessoa não tem foto nenhuma, não trave: a Etapa 4 diz como seguir.
2. **Assinatura tipográfica no topo.** A primeira tela não é "título com subtítulo": é o nome ou a promessa composta como cartaz, em linhas com pesos (ou larguras) diferentes da letra de título da marca. A anatomia está em `_gerador/secoes/abertura.mjs` do molde.
3. **Um único momento forte, com a ação logo abaixo.** A página inicial tem um pico só, o "momento mais forte" do brief: uma foto, um número ou uma frase em tamanho de cartaz. A ação principal vem logo abaixo dele, não três telas depois. Dois picos na mesma página se anulam.
4. **Fotos reais pequenas e agrupadas, nunca esticadas.** Foto de celular ou de rede social não aguenta a tela inteira. Em grupo, cada uma no máximo do tamanho do arquivo, ela mostra o lugar e a gente de verdade. Nunca exiba uma foto maior que o arquivo dela. A anatomia está em `_gerador/secoes/fotos.mjs` do molde.

**E a ação principal funciona sozinha desde a primeira versão.** Quem chega faz o passo sem perguntar nada a ninguém: a página diz o que dá para pedir, marcar ou comprar, a partir das linhas do `fatos.md`; a mensagem pronta do WhatsApp nunca sai vazia e não repete palavra; nenhuma opção vem marcada por padrão sem um fato com fonte que a sustente (um dia, um tamanho, "para quem"). Pedido montado na página segue a seção `pedido-no-whatsapp` de `kit/repertorio/como-usar.md` e usa a peça pronta `kit/pecas/pedido.js`, que junta a mensagem e só avisa o leitor de tela quando a pessoa termina um campo; o botão nasce com `whatsapp(número, abertura)` do gerador, que codifica a mensagem. A peça não acrescenta palavra: o texto da abertura e dos rótulos é do autor, e é ele quem cuida para não repetir palavra. Sem fonte do que dá para pedir, não há pedido montado: o botão de WhatsApp leva a mensagem pronta e a pergunta vai para as Pendências do `andamento.md`.

E as letras nascem leves: baixe com `./estudio fonte` (skill `minha-marca`), que traz só o alfabeto latino em `.woff2` e a licença com o nome da família. O `checar` reprova letra sem licença (`fonte-sem-licenca`) e avisa letra pesada (`fonte-pesada`).

## O andamento

Cada site tem `sites/<nome>/andamento.md`, que você escreve e atualiza ao fim de cada etapa:

```
# Andamento: <nome>
etapa: <coleta | brief | referencias | direcao | piloto | construcao | preflight | prints | revisao | entrega | entregue>
brief aprovado: <data e as palavras da pessoa, ou "não">
piloto aprovado: <data e as palavras da pessoa, ou "não">
revisão: <rodada N, nota>
avisos aceitos: <cada amarelo que ficou de propósito, com o porquê>
próximo passo: <uma frase>

## Pendências
- <o que só a pessoa resolve, como confirmar um horário ou autorizar uma foto; apague quando ela resolver>
```

Se a sessão cair, você volta daqui. Aprovação só vale com as palavras da pessoa, copiadas sem resumir. "Pode seguir", "faz tudo", "capricha" ditos antes de ver o brief ou o piloto não aprovam nada: mostre e espere.

## Etapa 0. Abrir a pasta

Se ainda não sabe o nome do negócio, faça antes a pergunta 1 da coleta (etapa 1): é dela que sai o nome. Escolha um nome curto (letras minúsculas, números e hífen) e rode:
`./estudio novo <nome> --titulo "<nome do negócio>"`

- `SITE_CRIADO`: a pasta está em `arquivos.pasta`, com `brief.md`, `fatos.md`, `referencias.md`, `direcao.md`, `material/`, `_gerador/` e `site/` (marca e motor de movimento já copiados, e o molde de um negócio fictício já montado, com a página inicial e uma página). O molde é uma oficina de bicicletas inventada: ele mostra a anatomia das quatro regras, não a direção do seu site. Todo texto do molde será trocado. Cada seção do molde, o cabeçalho e a nota do rodapé levam `data-molde`, a `_gerador/ordem.mjs` leva `molde: true` e as linhas do `fatos.md` do molde têm a fonte "Exemplo fictício do Site Estúdio": o `checar` reprova com `resto-do-molde` e o `fatos` com `fonte-de-exemplo` enquanto sobrar algum. Tire o `data-molde` de uma parte só depois de reescrevê-la com o conteúdo do brief, apague o `molde: true` quando nome, negócio e páginas forem os de verdade, e apague do `fatos.md` toda linha do exemplo. Nunca tire a marca para passar na conferência sem trocar o conteúdo.
- Aviso `MARCA_DE_EXEMPLO`: diga em uma frase que está usando a marca de exemplo e ofereça a skill `minha-marca` depois.
- `SITE_JA_EXISTE`: pergunte se é para continuar aquele ou criar com outro nome. Nunca apague o existente.

## Etapa 1. Coleta (duas perguntas, o resto com fonte)

**Perguntas obrigatórias (só estas duas)**, uma por mensagem, e só a que a pessoa ainda não respondeu:
1. "Qual é o nome do seu negócio e o que ele faz? Conte do seu jeito, em uma ou duas frases."
2. "Onde o seu negócio aparece hoje? Pode ser o Instagram, um site ou o nome no Google."

Todo o resto você descobre lendo, e propõe no brief em vez de perguntar: para quem é, onde fica, a ação principal (o WhatsApp da bio, o telefone do Google, o botão de agendar), as páginas, as fotos que existem, as cores, o tom. Não pergunte o que dá para ver.

Depois das duas, uma mensagem só, opcional: "Quer me contar mais alguma coisa? Um site de que você gosta, uma cor que não quer, fotos que estão no computador. Se preferir, eu decido." com "Pode decidir por mim ★" e "Quero contar". Gosto visual e sites favoritos são sempre opcionais: se a pessoa delegar, siga sem perguntar de novo. Se ela não tiver Instagram, site nem Google, siga só com a primeira resposta e diga no brief o que falta.

Leia tudo sozinho, antes de perguntar o resto. Com o @ do Instagram e o nome do negócio com a cidade, rode `./estudio ler <nome> --instagram perfil --negocio "Nome, cidade"` (o @ vai sem a arroba: no Windows, a arroba solta some do comando) (some `--site <endereço>` ou `--google <link do Google Maps>` se a pessoa passou). Rode com timeout de 10 minutos (no Claude Code, `timeout` 600000). Sem entrar em conta nenhuma (ou, no Instagram, com o login que a pessoa fez pela janela do estúdio), ele lê o Instagram (legenda, data e foto de cada publicação), o perfil do Google (endereço, telefone, horário de cada dia, nota e avaliações sem o nome de quem escreveu) e o site atual inteiro (achado pelo Google ou pela bio, se a pessoa não passou). Guarda tudo em `sites/<nome>/coleta/` e anota cada fato, com fonte e data, na parte "Lido pelo estúdio" do `fatos.md`. Leia `coleta/instagram/posts.md`, `coleta/google/lugar.json` e `coleta/site/texto.md`, e traduza cada aviso pelo código. Se o Instagram faltar, siga a ação do aviso. Primeiro, ofereça à pessoa entrar na conta dela por uma janela do estúdio: rode `./estudio instagram entrar` (sem `--confirmar`, ele não abre janela e devolve `INSTAGRAM_ANTES_DE_ENTRAR`, o aviso de que o Instagram pode mandar "alguém entrou na sua conta"). Diga o texto desse código e, só com o sim, rode `./estudio instagram entrar --confirmar`, com timeout de 10 minutos. Ele devolve `INSTAGRAM_JA_ENTROU` se o login guardado ainda vale; senão abre uma janela normal do Chrome no Instagram, a pessoa entra do jeito de sempre (a senha fica só com o Instagram) e ele percebe sozinho, fecha a janela e guarda o login neste computador. Depois, rode o mesmo `ler` de novo: com o login, ele lê até 40 publicações. Se vier `LER_INSTAGRAM_PEDIU_VERIFICACAO`, o estúdio já deixou o login de lado até amanhã: não ofereça entrar de novo no mesmo dia e siga a reserva. A reserva, se ela não quiser ou não der certo, é a extensão do Claude no Chrome, com licença da pessoa. Nunca peça senha, nunca digite nada na janela por ela e nunca abra a pasta onde o estúdio guarda o login. Se ela pedir para tirar o login do estúdio, rode `./estudio instagram sair`. Horário vem do perfil do Google ou da pessoa, nunca de trecho de resultado de busca. Leia também os arquivos de `referencias/`. Ler a internet é permitido; publicar ou enviar qualquer coisa, não. As fotos lidas ficam em `coleta/`; copie para `material/fotos/` só as que a pessoa autorizar no portão 1 (Etapa 2).

Sem marca guardada (`minha-marca/tokens.css`), faça a marca agora com a skill `minha-marca`, sem nenhuma pergunta e sem amostra para aprovar: ela usa as duas respostas e o que você leu, e quem mostra a marca à pessoa é o piloto (portão 2). Copie a marca para o site como diz o `MARCA_DE_EXEMPLO`.

Faça a coleta visual da regra 1 agora com as fotos que a pessoa mandou, e separe as fotos lidas que servem ao site para mostrar no portão 1. As que ela autorizar ali entram em `material/fotos/` com a legenda e a data.

Escreva `fatos.md`: cada fato com a fonte e a data em que você conferiu. Fato é todo número, preço, endereço, telefone, horário, @, e-mail, nome de pessoa, ano de fundação, prêmio e depoimento. Fonte é o documento, a página (com o endereço), a foto da tabela de preços, ou "a própria pessoa disse em <data>". Sem fonte, o fato fica fora do site. Siga o formato que já vem no `fatos.md` do molde, a tabela `Fato | Fonte | Data`, uma linha por fato, escrito como aparece na página (o telefone com os mesmos dígitos, o @ igual): o comando `fatos` lê essa tabela e reprova linha sem fonte. O que o `ler` anotou já está lá. Endereço, horário e telefone lidos não viram pergunta separada: você confirma no portão 1 (Etapa 2), na mesma pergunta do brief. O que ela confirmar ou corrigir vai para a tabela de cima, com a fonte "a própria pessoa disse em <data>" (a próxima leitura troca a parte lida inteira).

**Todo texto da página nasce de uma linha do `fatos.md`.** Não só número e contato: cada frase sobre o negócio (o que faz, como faz, para quem, desde quando) tem a linha dela, escrita como a fonte diz. A frase da página pode ser mais bonita que a linha, mas nunca diz mais do que ela: não generalize ("o melhor do bairro"), não invente costume, lugar ou produto que a fonte não cita. Sem linha, a frase sai ou vira pergunta para a pessoa. O comando `fatos` confere número, contato e @; a frase quem confere é o revisor de fatos (skill `revisar`), lendo uma por uma contra o `fatos.md`.

## Etapa 2. Brief (portão 1)

Escreva `sites/<nome>/brief.md` por cima do molde, com:
- **Objetivo**: o que a pessoa que chega ao site deve fazer, numa frase. É a régua de tudo.
- **Para quem**: quem chega, de onde (busca, Instagram, indicação), no celular ou no computador, o que já sabe e o que desconfia.
- **Ação principal** e no máximo duas secundárias.
- **Mapa do site**: as páginas, e em cada uma a sequência de partes (o topo, as partes do meio, o fecho), com a mensagem única de cada parte em uma frase.
- **O momento mais forte**: a parte que a pessoa vai lembrar (uma foto, um número, uma demonstração, uma história). É o pico do piloto.
- **O que fica de fora**, de propósito.
- **Como saber se deu certo** (mais ligações, mais mensagens, mais pedidos), em palavras simples.
- **Insumos faltando**: o que você assumiu por falta de material, e o que melhora se a pessoa mandar.

Mostre o brief à pessoa em texto corrido e curto (objetivo, ação principal, as páginas e o que cada uma diz), sem tabela técnica. Logo abaixo, mostre o endereço, o horário e o telefone que o estúdio leu, como estão no `fatos.md`, e as fotos lidas que você quer usar no site (abra as fotos para ela ver). Pergunte uma vez só: "Esse é o caminho do site. Está certo, e posso usar estas fotos?" com "Pode ★", "Quero mudar algo". O sim aprova o brief, confirma os dados mostrados e autoriza as fotos mostradas: passe os dados para a tabela de cima do `fatos.md` e copie as fotos para `material/fotos/` com a legenda e a data. Foto que ela recusar fica só em `coleta/`. Ajuste até aprovar. Grave a aprovação no `andamento.md`.

## Etapa 3. Referências reais (princípio, não cópia)

O estúdio traz um repertório de 42 sites reais, separados pelo que quem visita quer fazer. Leia `kit/repertorio/como-usar.md` e siga. Em resumo:

1. **A escolha parte da ação principal do brief e da dúvida que a página resolve** ("o que quem chega precisa saber, ou ver, para fazer isso?"). O ramo do negócio é só contexto, nunca o critério.
2. Abra só o arquivo da ação (`kit/repertorio/<ação>.json`), pela tabela "Da ação do brief ao arquivo" do `como-usar.md`. Ligar e chamar no WhatsApp são o canal: a tabela leva à dúvida que vem antes do contato. Compare a dúvida de cada ficha com a do brief, pelo sentido. Escolha 2 ou 3 fichas, com pelo menos **2 de outro ramo**: é delas que vem a ideia que o ramo ainda não usa.
3. **Confira ao vivo só as escolhidas**: abra o endereço de cada uma, siga o `ondeVer` da ficha até a parte da página onde o princípio aparece e veja se ele ainda está lá. O princípio mudou: troque por outra ficha. Site que recusa leitura automática (acesso negado, tela de verificação) não saiu do ar: use o navegador do seu programa ou troque de ficha, como diz o `como-usar.md`, sem anotar conferência que não aconteceu. Nunca abra todas.
4. Some as referências que a pessoa indicou, no mesmo formato.
5. **3D só com prova e com limite.** Ficha com jeito `configurador-3d` ou `marca-em-3d` só entra quando o brief tem a peça (produto de forma simples com opções) ou a forma da marca, e quando ver de vários lados ajuda a decidir. Siga "3D: só com prova e com limite" do `como-usar.md`, inclusive o "Quando não usar". Para ver e mostrar como fica, `./estudio novo <nome> --demo 3d` cria o exemplo com as duas demos.

Escreva em `referencias.md` (a tabela do molde), para cada uma: o endereço, o ramo, o **motivo** (a dúvida que ela resolve e por que serve a este brief), o princípio em uma frase, **como fazemos aqui** (o jeito do repertório, adaptado a este negócio), **como fica no celular**, a data em que você conferiu ao vivo e, se trocou de ficha, a **observação** (como "trocada: o site recusa leitura automática"). Diga à pessoa, em uma ou duas frases e sem nome técnico, que ideia vai aproveitar e de onde ela veio.

Guarde só o endereço: nenhum print, logo, foto ou texto de outra marca entra no site nem na pasta dele. Nunca copie layout, texto, foto, logo ou cor de uma referência. Referência ensina por que; a solução é desta marca.

## Etapa 4. Direção visual

1. Confira a coleta visual (regra 1) e as referências da Etapa 3 em `referencias.md`. As referências você escolhe sozinho: faltando, volte à Etapa 3 antes de escrever a direção. As fotos dependem da pessoa: se ela não tem nenhuma (o negócio vai abrir, ou não há foto agora), não trave. Anote em `brief.md` > **Insumos faltando**, siga com uma direção que compensa (tipografia como imagem, textura, cor) e diga à pessoa, em uma frase, o que fotografar com o celular.
2. Se estiverem instaladas, carregue as skills `frontend-design` e `ui-ux-pro-max`. Use-as para a direção, a tipografia, a cor e o movimento.
3. Leia `minha-marca/marca.md` (se existir), o brief, `referencias.md` e olhe as fotos de `material/`.

Escreva `sites/<nome>/direcao.md`, nesta ordem (tipografia e foto vêm antes de qualquer outra decisão):
- **Tese visual, em uma frase.** Como o site vai parecer e por quê, ligada ao negócio e ao público. Exemplo: "Um consultório de fisioterapia que parece manhã: branco quente, foto de gente se movendo com luz de janela, letra de título leve e larga." Se a frase serve para qualquer negócio, ela ainda não é uma tese.
- **Assinatura tipográfica do topo** (regra 2). As linhas do cartaz e o peso de cada uma.
- **O momento forte e a ação** (regra 3). Qual é o pico único da página inicial e qual ação vem logo abaixo.
- **Tipografia.** As duas famílias e o papel de cada uma, baixadas leves com `./estudio fonte`; a escala (título enorme, apoio, texto, legenda) com `clamp()`; altura de linha; largura máxima do texto corrido (entre 60 e 75 caracteres). A letra de título deve ter personalidade.
- **Foto.** Que tipo (gente real, produto, lugar), luz, enquadramento, cor, vindas da coleta. Fotos reais pequenas e agrupadas, nunca esticadas (regra 4); só uma foto que aguenta a tela inteira (original grande e nítido) pode abrir a página. Sem foto boa, a direção diz como compensar (tipografia como imagem, textura, cor) e o que a pessoa pode fotografar com o celular para melhorar. Nunca use banco de imagem genérico, e imagem gerada só com o OK da pessoa.
- **Cor.** A paleta da marca e a tabela de contraste medida (mínimo 4,5:1 no texto, 3:1 no título grande).
- **Composição.** Grade, respiro, assimetria, onde a tela fica cheia e onde respira, como as partes se emendam. Sem grade de cartões com borda e fundo.
- **Movimento.** O que anima e por quê (o que conduz o olhar ou conta a história), o que nunca anima, durações e curvas, rolagem suave (Lenis) sim ou não (se não, ponha `lenis: false` em `_gerador/ordem.mjs` e apague `site/assets/vendor/lenis/`: a página para de carregar o Lenis e a conferência deixa de pedir por ele), passagem entre páginas (View Transitions), e como fica com movimento reduzido (o conteúdo aparece inteiro, parado).
- **Nunca fazer**: as três tentações genéricas deste ramo, para evitar.

Ajuste `site/assets/marca/tokens.css` do site, se a direção pedir algo além da marca (sem mudar `minha-marca/`).

## Etapa 5. Piloto (portão 2)

Leia o gerador do site antes: `sites/<nome>/_gerador/ordem.mjs` (as páginas e a ordem das partes), os arquivos de `_gerador/secoes/` (uma parte por arquivo) e o `_gerador/montar.mjs`. O cabeçalho de cada um explica como se escreve. Leia também a pasta `site/assets/vendor/` para saber o que já está disponível (GSAP, ScrollTrigger, Lenis).

Faça só três partes da página inicial: o **topo** (a primeira tela, com a assinatura tipográfica da regra 2, que diz o que é e mostra a ação principal), uma **parte comum** (a mais frequente do site) e o **pico** (o único momento forte do brief, com a ação logo abaixo, regra 3). Elas substituem as partes do molde.

Como uma parte é feita:
- Um arquivo por parte em `_gerador/secoes/<nome>.mjs`, listado em `ordem.mjs`. O HTML de `site/` sai do `./estudio montar <nome>`; nunca edite um `index.html` de `site/` à mão. O estilo vai em `site/assets/css/site.css` e o movimento em `site/assets/js/site.js`, que o `montar` não toca.
- HTML semântico: um `h1` por página, títulos em ordem, `main`, `nav`, `footer`, botões que são `<a>` ou `<button>` de verdade, imagens com `alt` que descreve, `width` e `height` sempre.
- CSS moderno: tipografia fluida com `clamp()`, container queries, `:has()`, `color-mix()`, subgrid quando a grade pedir. Pense primeiro no celular.
- Movimento com GSAP e ScrollTrigger já copiados em `site/assets/vendor/`, Lenis quando a direção pede rolagem suave, View Transitions na passagem entre páginas. Tudo dentro de `prefers-reduced-motion: no-preference`; sem isso, o conteúdo aparece inteiro e parado. Nada fica invisível esperando um script.
- Fotos em `site/assets/`, em WebP ou JPG, na largura em que aparecem (não uma foto de 6000 px num espaço de 800) e nunca exibidas maiores que o arquivo (regra 4). `loading="lazy"` em tudo que não está no topo.
- Contato sem servidor: link de WhatsApp, `tel:` e `mailto:`, com os dados de `fatos.md`. O link de WhatsApp sempre leva uma mensagem pronta que diz o que a pessoa quer; pedido montado na página usa `kit/pecas/pedido.js` (copie para `site/assets/js/`).
- A cabeça de cada página sai do `ordem.mjs`: `idioma`, o `titulo` e a `descricao` próprios de cada página, e os dados do negócio em `site.negocio`, que viram JSON-LD (escolha o `tipo` mais certo, como `Dentist`, `HairSalon` ou `LocalBusiness`), só com fatos de `fatos.md`. O endereço completo do site (`site.endereco`) e a imagem de compartilhamento (`site.imagemSocial`) ficam vazios até a pessoa ter onde hospedar (skill `hospedar`).
- Sem `<select>` nativo, sem travessão no texto (use vírgula, dois-pontos ou ponto), nenhum endereço da internet carregado pela página.

O que faz a parte ser boa:
- Hierarquia por tipografia grande, foto, luz, cor e movimento. Nada de grade de cartões, nada de lista de serviços com ícone em quadradinho, nada de "Bem-vindo ao nosso site".
- Teste anti-genérico: troque o nome do negócio; se a parte serve para outro, refaça.
- A ação principal está clara em 5 segundos, no celular, sem rolar.
- O texto soa como gente da marca falando, curto, com verbo, e cada frase tem a sua linha no `fatos.md`.

Conferir antes de mostrar:
1. `./estudio montar <nome>` (`SITE_MONTADO`). `MONTAR_FALHOU`: o erro está em `dados.detalhe`, numa parte do `_gerador/`; corrija e monte de novo.
2. `./estudio checar <nome>` e `./estudio medir <nome>`. Saída 2: leia `dados.vermelhos` (cada um com `pagina`, `tipo`, `detalhe` e, no `medir`, `largura`; os tipos estão explicados em `_tipos_dos_achados` de `kit/mensagens.json`), corrija pela causa na parte certa do `_gerador/`, monte de novo e rode outra vez até `ok:true`. Leia também `dados.amarelos`: `contraste-nao-medido` (texto sobre foto ou degradê) pede olhar a foto daquele trecho.
3. `./estudio prints <nome>` (`PRINTS_PRONTOS`): fotos da página inteira e de cada parte, em 390, 768, 1440 e 1920 de largura, com o movimento assentado, em `revisao/prints-rN/` e listadas em `dados.fotos`. Aviso `FOTO_LISA`: uma foto saiu quase toda de uma cor só; se não foi de propósito, algo não carregou. Abra **cada** imagem com a ferramenta de ler arquivo, uma a uma, começando pelo celular. Procure: texto cortado, encostado ou sobreposto; foto mal cortada; espaço morto; contraste fraco; a ação principal escondida; algo que não bate com a tese. Corrija e tire as fotos de novo.
4. `./estudio abrir <nome>` (`SITE_ABERTO`): o navegador abre a prévia lado a lado, o celular e o computador na mesma tela (`dados.previa`; o site sozinho fica em `dados.endereco`, e os dois só funcionam neste computador). Diga: "Abri o começo do site, no celular e no computador lado a lado."

Pergunte: "É esse o visual?" com "É esse ★", "Quero mudar algo". Ajuste até aprovar; pedido vago ("mais caseiro", "mais elegante") segue o "Pedido vago: antes e depois", mais abaixo. Grave a aprovação no `andamento.md`. A partir daqui, a linguagem visual está travada: mudança de direção só com nova aprovação. Site com mais de uma página passa pelo piloto só com a página inicial; as outras herdam a direção.

## Etapa 6. Construção por parte

Faça as outras partes e páginas seguindo o mapa do brief, no mesmo idioma visual do piloto. Copie a anatomia das partes do piloto, não as do molde.
- Uma parte por arquivo; página nova é uma entrada nova em `ordem.mjs` (ela vira `site/<pagina>/index.html`).
- Depois de cada página, rode `montar`, `checar` e `medir`, e corrija os vermelhos antes de seguir.
- Parte com 3D: parta da demo de `kit/demos/3d/` (seção e `site/assets/3d/`), com a imagem de reserva, o carregamento perto da tela e o limite de peso do `como-usar.md` ("3D: só com prova e com limite"). O `checar` reprova acima do limite (`3d-pesado`).
- Se uma parte pedir algo que o brief não previu (preço novo, serviço novo, depoimento), pare e pergunte à pessoa; atualize o brief e o `fatos.md`.

## Etapa 7. Preflight

`./estudio preflight <nome>`: roda `checar`, `medir`, `acessibilidade` e `fatos` de uma vez, em todas as páginas e nos quatro tamanhos, e soma. Precisa de `ok:true` (`PREFLIGHT_OK` ou `PREFLIGHT_COM_AVISOS`). `PREFLIGHT_REPROVADO`: leia `dados.vermelhos` (cada um com `etapa`, `pagina`, `tipo` e `detalhe`).
- Vermelho de `fatos`: o número ou contato da página não está em `fatos.md`. Ou o fato tem fonte e falta registrar, ou ele sai do site. Nunca invente uma fonte.
- Vermelho de acessibilidade (grave ou crítico): corrija pela causa (rótulo, nome do botão, ordem dos títulos, contraste).
- Amarelos: leia um por um. Corrija o que for defeito e anote no `andamento.md` o que ficou de propósito e por quê.

Rode também `./estudio desempenho <nome>` (`DESEMPENHO_MEDIDO`, números em `dados.medidas`; aviso `ARQUIVO_PESADO` aponta o arquivo): peso, tempo até o maior elemento aparecer e quanto a página pula enquanto carrega. Ele só avisa, nunca reprova. Use para achar ganho fácil (foto grande demais, letra que não precisa) sem tirar o que faz o site ser especial.

## Etapa 8. Fotos lidas

`./estudio prints <nome>` de novo, depois do preflight. Abra **todas** as fotos, uma a uma: todas as páginas, nos quatro tamanhos, inteiras e por parte. Para cada página e tamanho, escreva no `andamento.md` uma linha: "<página> <largura>: ok" ou o problema e o que você corrigiu. Corrigiu algo: monte, rode o `preflight` e as fotos de novo. Nunca declare pronto pelas fotos que você não abriu. Parte em 3D: as fotos esperam a cena abrir; `CENA_3D_NAO_ABRIU`, `CENA_3D_VAZIA` ou `CENA_3D_FORA_DA_FOTO` se corrigem antes de seguir, e `./estudio prints <nome> --reduzido` mostra a imagem de reserva.

## Etapa 9. Revisão

A pessoa não espera de tela vazia. Antes de começar, rode `./estudio abrir <nome>` e diga o texto de `ANDAMENTO_ABRI`. Depois, antes de cada etapa, uma frase de andamento de `kit/mensagens.json`: `ANDAMENTO_CONFERENCIA` (preflight e desempenho), `ANDAMENTO_FOTOS` (prints), `ANDAMENTO_OLHARES` (as 4 lentes; na primeira vez, o aviso da skill `revisar` vai no lugar dele), `ANDAMENTO_AJUSTES` (correções) e `ANDAMENTO_PRONTO` (passou). Nunca diga nota, número de vezes nem nome de etapa técnica.

Skill `revisar`. Ela chama 4 revisores independentes e devolve nota e problemas. Meta 8,5, até 3 rodadas. Não bateu na terceira: mostre à pessoa o que falta e deixe ela decidir.

## Etapa 10. Entrega

1. `./estudio preflight <nome>` com `ok:true` mais uma vez, depois da última correção.
2. `./estudio pacote <nome>` (`PACOTE_PRONTO`): empacota a pasta `site/` num arquivo `.zip` pronto para hospedar, em `arquivos.zip` (`sites/<nome>/<nome>-site.zip`).
3. `./estudio abrir <nome>` e diga: "Está pronto. Abri o site para você ver." Abra também, no seu computador, o lugar onde o arquivo do site ficou, para a pessoa ver onde ele está.
4. Diga, em poucas linhas: "O seu site está guardado no seu computador. Deixei pronto o arquivo para pôr no ar, e nada foi publicado."
5. Pergunte: "Quer pôr o site no ar agora?" com "Quero ★" e "Depois". Se sim, skill `hospedar`.
6. Atualize `andamento.md` com `etapa: entregue`, a data e onde está o pacote.

Pergunte uma vez: "Quer guardar algo deste site como regra para os próximos? (um tom, uma cor, um tipo de parte que funcionou)" Se sim, acrescente em `minha-marca/marca.md`.

## Pedido vago: antes e depois

"Mais caseiro", "mais elegante", "mais moderno", "não sei, não gostei": você traduz em 2 ou 3 mudanças concretas, que se veem (a letra, a cor, a foto, o espaço, o movimento, o texto), e mostra o antes e o depois. Nunca pergunte "o que você quer dizer com isso?": proponha e mostre.
1. `./estudio antes <nome>` (`ANTES_GUARDADO`): guarda o site e o `_gerador/` como estão, antes de mexer. `ANTES_EM_ABERTO` (saída 2): a pessoa ainda não escolheu na comparação anterior; rode o `escolher` do passo 5 com a resposta dela, nunca um antes novo por cima.
2. Faça as 2 ou 3 mudanças no `_gerador/` e em `site/assets/`, cada uma ligada ao pedido, e rode `montar`.
3. Escreva `arquivos.mudancas` (`revisao/antes-depois/mudancas.json`) com as palavras da pessoa em `pedido` e cada mudança com `titulo` (o que mudou, em palavras do dia a dia) e `porque` (como atende o pedido).
4. `./estudio comparar <nome>` (`COMPARACAO_PRONTA`): abre o antes e o depois lado a lado, com as mudanças numeradas. Saída 2: `POUCAS_MUDANCAS` (menos de 2) ou `NADA_MUDOU` (faltou montar); corrija e rode de novo.
5. Diga em uma frase cada mudança e pergunte: "Qual fica?" com "O depois ★", "Voltar como estava" e "Outro caminho". Com a resposta, rode `./estudio escolher <nome> depois`, `antes` ou `outro`. Nunca desfaça de memória:
   - "O depois": `FICOU_O_DEPOIS`. Grave no `andamento.md` o que ficou.
   - "Voltar como estava": `VOLTOU_COMO_ESTAVA`. O site e o `_gerador/` voltaram ao que o passo 1 guardou; abra o site de novo.
   - "Outro caminho": `PRONTO_PARA_OUTRO_CAMINHO`. O site voltou ao original e o antes continua guardado. Pule o passo 1: faça outra leitura do pedido a partir do passo 2, e a nova comparação mostra o original contra a tentativa nova.

## Mudar um site que já existe

1. Leia `andamento.md`, `brief.md`, `direcao.md` e as fotos mais recentes em `revisao/`.
2. Mudança de conteúdo (texto, preço, foto, página nova): atualize o brief e o `fatos.md` primeiro, depois a parte no `_gerador/`, `montar`, `preflight`, `prints` (leia as páginas mexidas, nos quatro tamanhos) e, se mudou mais de 3 partes, uma rodada de `revisar`.
3. Mudança de visual geral, ou pedido vago: siga o "Pedido vago: antes e depois" numa parte de teste e peça aprovação antes de mexer nas outras.
4. Gere o pacote de novo. Se o site está em sites.autonomia.site, publique de novo com o sim dela (skill `hospedar`); se está em outro lugar, lembre a pessoa de subir o arquivo novo onde ele estiver hospedado.

## Onde você para e pergunta

Na coleta (só as duas perguntas, e a opcional), no brief (portão 1, que na mesma pergunta confirma o endereço, o horário e o telefone lidos e pede licença para usar as fotos lidas), no antes e depois, no piloto (portão 2), quando aparece fato novo sem fonte, quando uma correção da revisão contraria o que a pessoa aprovou, e quando a revisão não bate a meta na terceira rodada. A marca do primeiro site não abre pergunta nenhuma (a skill `minha-marca` vinda daqui não pergunta). Nada mais: o resto é com você.
