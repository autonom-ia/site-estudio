---
name: novo-site
description: Faz um site de primeira linha do começo ao fim no Site Estúdio, pelo método da fábrica de sites - coleta com fonte, brief (aprovação), referências reais lidas como princípio, direção visual com tese em uma frase, piloto do topo + parte comum + pico no computador e no celular (aprovação), construção por parte no gerador, preflight mecânico, fotos em 4 tamanhos lidas uma a uma, revisão independente com meta 8,5 e pacote pronto para hospedar. Use quando a pessoa quiser um site novo, refazer o site que já tem, continuar um parado (sites/*/andamento.md) ou mudar páginas de um site existente.
---

# Novo site

Um site de primeira linha não nasce de um molde: nasce de uma ideia visual clara, de tipografia com personalidade, de foto de verdade e de movimento que conduz o olhar. O que separa um site premium de um genérico é direção, não programa. O caminho é sempre o mesmo, e a pessoa decide em dois portões: o brief e o piloto.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`), de dentro da pasta do estúdio. Leia só a última linha (JSON): `ok`, `codigo`, `resumo`, `arquivos`, `avisos`, `dados`. Saída 2 = reprovado: corrija pela causa e rode de novo. Traduza `codigo` por `kit/mensagens.json`. No Codex, `ler`, `checar`, `prints`, `medir`, `acessibilidade`, `desempenho`, `fatos`, `preflight` e `abrir` rodam fora da área protegida.

**Regra de ouro:** código só confere fato (link morto, letra que não carregou, contraste, texto vazando, número sem fonte). Gosto, história, layout e voz são seus e dos revisores; a palavra final é da pessoa. Nenhum comando diz se o site é bonito.

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
```

Se a sessão cair, você volta daqui. Aprovação só vale com as palavras da pessoa, copiadas sem resumir. "Pode seguir", "faz tudo", "capricha" ditos antes de ver o brief ou o piloto não aprovam nada: mostre e espere.

## Etapa 0. Abrir a pasta

Escolha um nome curto (letras minúsculas, números e hífen) e rode:
`./estudio novo <nome> --titulo "<nome do negócio>"`

- `SITE_CRIADO`: a pasta está em `arquivos.pasta`, com `brief.md`, `fatos.md`, `referencias.md`, `direcao.md`, `material/`, `_gerador/` e `site/` (marca e motor de movimento já copiados, e o molde de um negócio fictício já montado, com a página inicial e uma página). Todo texto do molde será trocado. Cada seção do molde, o cabeçalho e a nota do rodapé levam `data-molde`, a `_gerador/ordem.mjs` leva `molde: true` e as linhas do `fatos.md` do molde têm a fonte "Exemplo fictício do Site Estúdio": o `checar` reprova com `resto-do-molde` e o `fatos` com `fonte-de-exemplo` enquanto sobrar algum. Tire o `data-molde` de uma parte só depois de reescrevê-la com o conteúdo do brief, apague o `molde: true` quando nome, negócio e páginas forem os de verdade, e apague do `fatos.md` toda linha do exemplo. Nunca tire a marca para passar na conferência sem trocar o conteúdo.
- Aviso `MARCA_DE_EXEMPLO`: diga em uma frase que está usando a marca de exemplo e ofereça a skill `minha-marca` depois.
- `SITE_JA_EXISTE`: pergunte se é para continuar aquele ou criar com outro nome. Nunca apague o existente.

## Etapa 1. Coleta (com fonte)

Uma pergunta por mensagem, no máximo 6, e só as que faltam:
1. O que é o negócio, para quem, e onde (cidade, bairro, online)?
2. O que a pessoa precisa fazer ao abrir o site (ligar, chamar no WhatsApp, agendar, ir até lá, pedir orçamento, comprar)? Essa é a ação principal.
3. Já existe site, Instagram, página no Google ou cardápio/catálogo? Passe os endereços.
4. Quais páginas o site precisa? (Sugira o mínimo: muitas vezes uma página inicial forte e uma ou duas de apoio bastam.)
5. Que fotos reais existem (do lugar, da equipe, do produto)? Peça os arquivos na pasta `referencias/`.
6. Tem algum site de que você gosta, de qualquer ramo? Por quê?

Leia tudo sozinho, antes de perguntar o resto. Com o @ do Instagram e o nome do negócio com a cidade, rode `./estudio ler <nome> --instagram perfil --negocio "Nome, cidade"` (o @ vai sem a arroba: no Windows, a arroba solta some do comando) (some `--site <endereço>` ou `--google <link do Google Maps>` se a pessoa passou). Sem entrar em conta nenhuma, ele lê o Instagram (legenda, data e foto de cada publicação), o perfil do Google (endereço, telefone, horário de cada dia, nota e avaliações sem o nome de quem escreveu) e o site atual inteiro (achado pelo Google ou pela bio, se a pessoa não passou). Guarda tudo em `sites/<nome>/coleta/` e anota cada fato, com fonte e data, na parte "Lido pelo estúdio" do `fatos.md`. Leia `coleta/instagram/posts.md`, `coleta/google/lugar.json` e `coleta/site/texto.md`, e traduza cada aviso pelo código. Se o Instagram faltar, siga a ação do aviso (a extensão do Claude no Chrome, com licença da pessoa; nunca peça senha). Horário vem do perfil do Google ou da pessoa, nunca de trecho de resultado de busca. Leia também os arquivos de `referencias/`. Ler a internet é permitido; publicar ou enviar qualquer coisa, não. As fotos lidas ficam em `coleta/`; copie para `material/` só o que a pessoa mandou ou autorizou usar.

Escreva `fatos.md`: cada fato com a fonte e a data em que você conferiu. Fato é todo número, preço, endereço, telefone, horário, @, e-mail, nome de pessoa, ano de fundação, prêmio e depoimento. Fonte é o documento, a página (com o endereço), a foto do cardápio, ou "a própria pessoa disse em <data>". Sem fonte, o fato fica fora do site. Siga o formato que já vem no `fatos.md` do molde, a tabela `Fato | Fonte | Data`, uma linha por fato, escrito como aparece na página (o telefone com os mesmos dígitos, o @ igual): o comando `fatos` lê essa tabela e reprova linha sem fonte. O que o `ler` anotou já está lá: confirme com a pessoa endereço, horário e telefone, e o que ela corrigir vai para a tabela de cima, com a fonte "a própria pessoa disse em <data>" (a próxima leitura troca a parte lida inteira).

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

Mostre o brief à pessoa em texto corrido e curto (objetivo, ação principal, as páginas e o que cada uma diz), sem tabela técnica. Pergunte: "Esse é o caminho do site. Posso buscar referências e desenhar o começo?" com "Pode ★", "Quero mudar algo". Ajuste até aprovar. Grave a aprovação no `andamento.md`.

## Etapa 3. Referências reais (princípio, não cópia)

Antes de desenhar, estude de 6 a 10 sites **reais** e no ar, do mesmo tipo de negócio ou com o mesmo objetivo, de preferência premiados ou de marcas que são referência no ramo. Inclua os que a pessoa indicou. Se o seu programa tiver subagentes, divida a busca entre eles, em paralelo.

Para cada referência, abra a página (e, se tiver ferramenta de navegador, tire uma foto) e escreva em `referencias.md`:
- o endereço e por que ele entrou;
- **o princípio** que faz funcionar, em uma frase (exemplo: "a foto do produto ocupa a tela inteira e o título é curto, então a vontade vem antes da explicação"; "o cardápio é tipografia pura, com preço alinhado, sem ícone");
- como esse princípio serve ao objetivo **deste** brief;
- o que **não** vale trazer (o que é da marca deles, o que não combina com o público daqui).

Nunca copie layout, texto, foto, logo ou cor de uma referência. Referência ensina por que; a solução é desta marca.

## Etapa 4. Direção visual

1. Se estiverem instaladas, carregue as skills `frontend-design` e `ui-ux-pro-max`. Use-as para a direção, a tipografia, a cor e o movimento.
2. Leia `minha-marca/marca.md` (se existir), o brief e `referencias.md`.

Escreva `sites/<nome>/direcao.md`, nesta ordem (tipografia e foto vêm antes de qualquer outra decisão):
- **Tese visual, em uma frase.** Como o site vai parecer e por quê, ligada ao negócio e ao público. Exemplo: "Uma padaria de madrugada: fundo escuro e quente, foto de forno com luz de lado, letra de título pesada e curta, como placa pintada à mão." Se a frase serve para qualquer negócio, ela ainda não é uma tese.
- **Tipografia.** As duas famílias e o papel de cada uma; a escala (título enorme, apoio, texto, legenda) com `clamp()`; altura de linha; largura máxima do texto corrido (entre 60 e 75 caracteres). A letra de título deve ter personalidade.
- **Foto.** Que tipo (gente real, produto, lugar), luz, enquadramento, cor. A melhor foto real do negócio abre a página. Sem foto boa, a direção diz como compensar (tipografia como imagem, textura, cor) e o que a pessoa pode fotografar com o celular para melhorar. Nunca use banco de imagem genérico, e imagem gerada só com o OK da pessoa.
- **Cor.** A paleta da marca e a tabela de contraste medida (mínimo 4,5:1 no texto, 3:1 no título grande).
- **Composição.** Grade, respiro, assimetria, onde a tela fica cheia e onde respira, como as partes se emendam. Sem grade de cartões com borda e fundo.
- **Movimento.** O que anima e por quê (o que conduz o olhar ou conta a história), o que nunca anima, durações e curvas, rolagem suave (Lenis) sim ou não, passagem entre páginas (View Transitions), e como fica com movimento reduzido (o conteúdo aparece inteiro, parado).
- **Nunca fazer**: as três tentações genéricas deste ramo, para evitar.

Ajuste `site/assets/marca/tokens.css` do site, se a direção pedir algo além da marca (sem mudar `minha-marca/`).

## Etapa 5. Piloto (portão 2)

Leia o gerador do site antes: `sites/<nome>/_gerador/ordem.mjs` (as páginas e a ordem das partes), os arquivos de `_gerador/secoes/` (uma parte por arquivo) e o `_gerador/montar.mjs`. O cabeçalho de cada um explica como se escreve. Leia também a pasta `site/assets/vendor/` para saber o que já está disponível (GSAP, ScrollTrigger, Lenis).

Faça só três partes da página inicial: o **topo** (a primeira tela, que diz o que é e mostra a ação principal), uma **parte comum** (a mais frequente do site) e o **pico** (o momento mais forte do brief). Elas substituem as partes do molde.

Como uma parte é feita:
- Um arquivo por parte em `_gerador/secoes/<nome>.mjs`, listado em `ordem.mjs`. O HTML de `site/` sai do `./estudio montar <nome>`; nunca edite um `index.html` de `site/` à mão. O estilo vai em `site/assets/css/site.css` e o movimento em `site/assets/js/site.js`, que o `montar` não toca.
- HTML semântico: um `h1` por página, títulos em ordem, `main`, `nav`, `footer`, botões que são `<a>` ou `<button>` de verdade, imagens com `alt` que descreve, `width` e `height` sempre.
- CSS moderno: tipografia fluida com `clamp()`, container queries, `:has()`, `color-mix()`, subgrid quando a grade pedir. Pense primeiro no celular.
- Movimento com GSAP e ScrollTrigger já copiados em `site/assets/vendor/`, Lenis quando a direção pede rolagem suave, View Transitions na passagem entre páginas. Tudo dentro de `prefers-reduced-motion: no-preference`; sem isso, o conteúdo aparece inteiro e parado. Nada fica invisível esperando um script.
- Fotos em `site/assets/`, em WebP ou JPG, na largura em que aparecem (não uma foto de 6000 px num espaço de 800). `loading="lazy"` em tudo que não está no topo.
- Contato sem servidor: link de WhatsApp, `tel:` e `mailto:`, com os dados de `fatos.md`.
- A cabeça de cada página sai do `ordem.mjs`: `idioma`, o `titulo` e a `descricao` próprios de cada página, e os dados do negócio em `site.negocio`, que viram JSON-LD (escolha o `tipo` mais certo, como `Bakery`, `Dentist` ou `LocalBusiness`), só com fatos de `fatos.md`. O endereço completo do site (`site.endereco`) e a imagem de compartilhamento (`site.imagemSocial`) ficam vazios até a pessoa ter onde hospedar (skill `hospedar`).
- Sem `<select>` nativo, sem travessão no texto (use vírgula, dois-pontos ou ponto), nenhum endereço da internet carregado pela página.

O que faz a parte ser boa:
- Hierarquia por tipografia grande, foto, luz, cor e movimento. Nada de grade de cartões, nada de lista de serviços com ícone em quadradinho, nada de "Bem-vindo ao nosso site".
- Teste anti-genérico: troque o nome do negócio; se a parte serve para outro, refaça.
- A ação principal está clara em 5 segundos, no celular, sem rolar.
- O texto soa como gente da marca falando, curto, com verbo.

Conferir antes de mostrar:
1. `./estudio montar <nome>` (`SITE_MONTADO`). `MONTAR_FALHOU`: o erro está em `dados.detalhe`, numa parte do `_gerador/`; corrija e monte de novo.
2. `./estudio checar <nome>` e `./estudio medir <nome>`. Saída 2: leia `dados.vermelhos` (cada um com `pagina`, `tipo`, `detalhe` e, no `medir`, `largura`; os tipos estão explicados em `_tipos_dos_achados` de `kit/mensagens.json`), corrija pela causa na parte certa do `_gerador/`, monte de novo e rode outra vez até `ok:true`. Leia também `dados.amarelos`: `contraste-nao-medido` (texto sobre foto ou degradê) pede olhar a foto daquele trecho.
3. `./estudio prints <nome>` (`PRINTS_PRONTOS`): fotos da página inteira e de cada parte, em 390, 768, 1440 e 1920 de largura, com o movimento assentado, em `revisao/prints-rN/` e listadas em `dados.fotos`. Aviso `FOTO_LISA`: uma foto saiu quase toda de uma cor só; se não foi de propósito, algo não carregou. Abra **cada** imagem com a ferramenta de ler arquivo, uma a uma, começando pelo celular. Procure: texto cortado, encostado ou sobreposto; foto mal cortada; espaço morto; contraste fraco; a ação principal escondida; algo que não bate com a tese. Corrija e tire as fotos de novo.
4. `./estudio abrir <nome>` (`SITE_ABERTO`; o endereço vem em `dados.endereco` e só funciona neste computador) e diga: "Abri o começo do site. Veja no computador e também com a janela estreita, como no celular."

Pergunte: "É esse o visual?" com "É esse ★", "Quero mudar algo". Ajuste até aprovar. Grave a aprovação no `andamento.md`. A partir daqui, a linguagem visual está travada: mudança de direção só com nova aprovação. Site com mais de uma página passa pelo piloto só com a página inicial; as outras herdam a direção.

## Etapa 6. Construção por parte

Faça as outras partes e páginas seguindo o mapa do brief, no mesmo idioma visual do piloto. Copie a anatomia das partes do piloto, não as do molde.
- Uma parte por arquivo; página nova é uma entrada nova em `ordem.mjs` (ela vira `site/<pagina>/index.html`).
- Depois de cada página, rode `montar`, `checar` e `medir`, e corrija os vermelhos antes de seguir.
- Se uma parte pedir algo que o brief não previu (preço novo, serviço novo, depoimento), pare e pergunte à pessoa; atualize o brief e o `fatos.md`.

## Etapa 7. Preflight

`./estudio preflight <nome>`: roda `checar`, `medir`, `acessibilidade` e `fatos` de uma vez, em todas as páginas e nos quatro tamanhos, e soma. Precisa de `ok:true` (`PREFLIGHT_OK` ou `PREFLIGHT_COM_AVISOS`). `PREFLIGHT_REPROVADO`: leia `dados.vermelhos` (cada um com `etapa`, `pagina`, `tipo` e `detalhe`).
- Vermelho de `fatos`: o número ou contato da página não está em `fatos.md`. Ou o fato tem fonte e falta registrar, ou ele sai do site. Nunca invente uma fonte.
- Vermelho de acessibilidade (grave ou crítico): corrija pela causa (rótulo, nome do botão, ordem dos títulos, contraste).
- Amarelos: leia um por um. Corrija o que for defeito e anote no `andamento.md` o que ficou de propósito e por quê.

Rode também `./estudio desempenho <nome>` (`DESEMPENHO_MEDIDO`, números em `dados.medidas`; aviso `ARQUIVO_PESADO` aponta o arquivo): peso, tempo até o maior elemento aparecer e quanto a página pula enquanto carrega. Ele só avisa, nunca reprova. Use para achar ganho fácil (foto grande demais, letra que não precisa) sem tirar o que faz o site ser especial.

## Etapa 8. Fotos lidas

`./estudio prints <nome>` de novo, depois do preflight. Abra **todas** as fotos, uma a uma: todas as páginas, nos quatro tamanhos, inteiras e por parte. Para cada página e tamanho, escreva no `andamento.md` uma linha: "<página> <largura>: ok" ou o problema e o que você corrigiu. Corrigiu algo: monte, rode o `preflight` e as fotos de novo. Nunca declare pronto pelas fotos que você não abriu.

## Etapa 9. Revisão

Skill `revisar`. Ela chama 4 revisores independentes e devolve nota e problemas. Meta 8,5, até 3 rodadas. Não bateu na terceira: mostre à pessoa o que falta e deixe ela decidir.

## Etapa 10. Entrega

1. `./estudio preflight <nome>` com `ok:true` mais uma vez, depois da última correção.
2. `./estudio pacote <nome>` (`PACOTE_PRONTO`): empacota a pasta `site/` num arquivo `.zip` pronto para hospedar, em `arquivos.zip` (`sites/<nome>/<nome>-site.zip`).
3. `./estudio abrir <nome>` e diga: "Está pronto. Abri o site para você ver." Abra também a pasta do site para a pessoa ver onde está o arquivo.
4. Explique em poucas linhas: o site inteiro está na pasta `site`; o arquivo `.zip` é o que vai para a hospedagem; nada foi publicado.
5. Pergunte: "Quer pôr o site no ar agora? Eu mostro o passo a passo." com "Quero ★" e "Depois". Se sim, skill `hospedar`.
6. Atualize `andamento.md` com `etapa: entregue`, a data e onde está o pacote.

Pergunte uma vez: "Quer guardar algo deste site como regra para os próximos? (um tom, uma cor, um tipo de parte que funcionou)" Se sim, acrescente em `minha-marca/marca.md`.

## Mudar um site que já existe

1. Leia `andamento.md`, `brief.md`, `direcao.md` e as fotos mais recentes em `revisao/`.
2. Mudança de conteúdo (texto, preço, foto, página nova): atualize o brief e o `fatos.md` primeiro, depois a parte no `_gerador/`, `montar`, `preflight`, `prints` (leia as páginas mexidas, nos quatro tamanhos) e, se mudou mais de 3 partes, uma rodada de `revisar`.
3. Mudança de visual geral: mostre uma parte de teste e peça aprovação antes de mexer nas outras.
4. Gere o pacote de novo e lembre a pessoa de subir o arquivo novo na hospedagem (skill `hospedar`).

## Onde você para e pergunta

Na coleta (só o que falta), no brief (portão 1), no piloto (portão 2), quando aparece fato novo sem fonte, e quando a revisão não bate a meta na terceira rodada. Nada mais: o resto é com você.
