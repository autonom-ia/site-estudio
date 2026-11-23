---
name: minha-marca
description: Registra a marca da pessoa no Site Estúdio (cores, letras, logo e tom) em minha-marca/tokens.css e minha-marca/marca.md, confere o contraste e mostra uma página de amostra com a marca aplicada, no computador e no celular, para aprovação. Use logo depois da instalação, quando faltar minha-marca/tokens.css, ou quando a pessoa quiser mudar cores, letras, logo ou o jeito de falar dos sites.
---

# Minha marca

A marca vale para todos os sites. O comando `./estudio novo` copia para dentro de cada site novo (`site/assets/marca/`) **só o que a página usa**: `tokens.css`, os arquivos de `fontes/` (`.woff2`, `.woff` ou `.ttf`, com as licenças `OFL-*.txt`) e `logo.svg` ou `logo.png`. O `marca.md` e qualquer outro arquivo de `minha-marca/` ficam fora, porque tudo em `site/` vai para o ar. Site que já existe não muda sozinho: se a pessoa quiser a marca nova num site antigo, copie **só esses arquivos** (nunca a pasta inteira, nunca o `marca.md`) por cima de `sites/<nome>/site/assets/marca/`, rode `./estudio montar <nome>` e o `preflight` dele.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## O que sai daqui

```
minha-marca/
  tokens.css     as variáveis do tema (mesmos nomes de kit/marca-exemplo/tokens.css)
  fontes/        arquivos .woff2 e a licença de cada fonte (OFL-<Família>.txt)
  logo.svg       ou logo.png (se a pessoa tiver)
  marca.md       tom de voz, palavras que usa e que evita, regras de foto (fica só aqui: nunca vai para o site)
```

## Passo a passo

### 1. Juntar o que já existe (uma pergunta por vez)
1. "Qual é o nome do seu negócio ou projeto, e o que ele faz, em uma frase?"
2. "Onde o seu negócio aparece hoje? Pode ser o Instagram, um site, o nome no Google, ou uma foto do logo, do cartão ou da fachada. Se tiver arquivos, pode me mandar aqui mesmo." Se tiver, abra e leia as imagens e as páginas. Tire as cores reais delas (hex), não as que você imagina.
3. Opcional: "Quer me dar três palavras do jeito que a sua marca fala? Se preferir, eu decido pelo que vi." (exemplo: acolhedora, direta, curiosa). Se a pessoa delegar, tire o tom do que ela já escreve no Instagram ou no site.
4. Só se não houver nada para olhar: proponha 3 direções de cor e letra, cada uma com um nome e uma frase do porquê, e deixe a pessoa escolher. A recomendada primeiro, com ★.

Não pergunte o que dá para ver nas peças. Não pergunte código de cor. Vindo da skill `novo-site`, as perguntas 1 e 2 já foram feitas na coleta: não repita, use as respostas.

### 2. Escolher as letras
- Duas famílias no máximo: uma para título, uma para texto. A letra de título é a maior alavanca de personalidade do site: escolha com intenção, não a mais comum.
- Só fontes de licença livre (SIL Open Font License), guardadas em `minha-marca/fontes/` com a licença ao lado, **com o nome da família** (`OFL-<Família>.txt`): duas licenças chamadas `OFL.txt` na mesma pasta se sobrescrevem, e o `checar` reprova letra sem a sua licença (`fonte-sem-licenca`). Nada carregado da internet quando o site abre.
- **Letras leves.** Baixe com o estúdio, avisando antes ("Vou baixar a letra da sua marca. O {{agente}} vai pedir licença. Pode aprovar."):
  `./estudio fonte "<Família>"` (o nome exato do catálogo do Google Fonts, como "Big Shoulders Display"). Opções: `--pesos 400..800` (só os pesos que o site usa), `--italico` (só se o site usa itálico), `--larguras` (só se a assinatura do topo usa larguras diferentes; pesa mais). Ele baixa o `.woff2` já recortado no alfabeto latino (cobre o português) e a licença com o nome da família, tudo ou nada. Em `FONTE_BAIXADA`, cole `dados.css` no topo do `tokens.css`, no lugar das linhas `@font-face` antigas daquela família. `dados.letras_kb_na_pasta` é o peso total das letras: acima de 100 KB o `checar` avisa `fonte-pesada`.
- Nunca baixe `.ttf` do repositório do Google à mão: é a mesma letra três vezes mais pesada, inteira, e a licença vem com nome genérico.
- Fonte livre que não está no Google (a pessoa mandou o arquivo e a licença): use-a, guarde a licença como `OFL-<Família>.txt` e diga em uma frase que o site fica um pouco mais pesado se não for `.woff2`. Fonte paga ou sem licença clara: use uma livre parecida e diga isso em uma frase.
- Sem fonte definida: a letra sai da direção da marca. Escolha pelo ramo e pelas três palavras da etapa 1 (uma clínica não pede a letra de uma oficina) e baixe com `./estudio fonte`. As letras de `kit/marca-exemplo/fontes/` foram escolhidas para um negócio de exemplo, não para o seu: use-as só como último recurso (sem internet para baixar) e diga isso à pessoa em uma frase.

### 3. Escrever `minha-marca/tokens.css`
Abra `kit/marca-exemplo/tokens.css`, copie a estrutura e troque os valores. Mantenha **todos** os nomes de variável que estão lá, porque o molde e as partes das páginas usam esses nomes. Escreva um comentário curto no topo dizendo de onde veio cada cor.

- Os `@font-face` apontam para `fontes/<arquivo>` (caminho relativo), com `font-display: swap`.
- A marca define só cores e famílias de letra. Os tamanhos ficam no CSS de cada site (`site/assets/css/site.css`), já fluidos com `clamp()`; se mexer neles, no celular o texto corrido fica em 16 px ou mais.
- Nenhum endereço da internet dentro do arquivo.

### 4. Conferir o contraste
Calcule a razão de contraste (fórmula WCAG de luminância relativa) de cada par de texto sobre fundo que o tema usa (texto principal, texto de apoio, destaque, texto sobre a cor escura) e escreva o resultado no `marca.md`:
- Texto corrido: no mínimo 4,5:1. Prefira 7:1 para o texto principal.
- Título grande (24 px ou mais, ou 19 px em negrito): no mínimo 3:1.
- Botão e link: o texto no mínimo 4,5:1 sobre o próprio fundo, e o botão no mínimo 3:1 contra o que está em volta.

Se algum par não passar, ajuste a cor (mais escura ou mais clara, mesmo tom) e diga em uma frase o que mudou e por quê. O `medir` confere de novo no site pronto, depois do movimento assentar.

### 5. Escrever `minha-marca/marca.md`
- O nome e a frase do negócio.
- As três palavras do tom e como cada uma aparece no texto (exemplo: "direta: frase curta, verbo no começo").
- Palavras e assuntos que a marca evita (pergunte só se a pessoa mencionar; não invente proibições).
- Regras de foto: tipo de foto (pessoas reais, produto, lugar), luz, enquadramento, o que nunca usar.
- A tabela de contraste do passo 4.

### 6. Mostrar a amostra
1. Rode `./estudio novo amostra-da-marca --titulo "<nome do negócio>"`. Se vier `SITE_JA_EXISTE`, use outro nome (`amostra-da-marca-2`).
2. Rode `./estudio montar amostra-da-marca` e `./estudio prints amostra-da-marca`. A amostra é o molde com a sua marca: não rode `checar` nem `preflight` nela (eles reprovam de propósito, com `resto-do-molde` e `fonte-de-exemplo`, porque o texto ainda é do negócio fictício). Abra as fotos do computador e do celular e confira se as letras carregaram e se nada está apertado.
3. Rode `./estudio abrir amostra-da-marca` (no Codex, fora da área protegida). Diga: "Abri uma página de exemplo com a sua marca, no celular e no computador lado a lado."
4. Pergunte: "Ficou com a cara da sua marca?" com "Ficou ★", "Mudar as cores" e "Mudar as letras".
5. Ajuste e mostre de novo até a pessoa aprovar. A amostra pode ser apagada depois, a pedido dela.

## Regras

- Cor tirada de peça real vence cor inventada.
- Nunca use marca, logo ou fonte de outra empresa.
- Nada de fonte ou imagem carregada da internet no site: tudo em `minha-marca/`.
- Não edite `kit/marca-exemplo/`: ele é do estúdio.
