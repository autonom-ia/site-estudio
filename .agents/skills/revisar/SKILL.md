---
name: revisar
description: Revisa um site do Site Estúdio com 4 revisores independentes (diretor de arte, diretor geral, revisor de fatos e QA), cada um sem o histórico da conversa, com nota de 0 a 10 por página e problemas com conserto concreto; meta 8,5 em até 3 rodadas, e na terceira sem meta para e mostra à pessoa o que falta. Use na etapa de revisão da novo-site e quando a pessoa pedir "dá uma nota", "revisa", "está bom?".
---

# Revisar

Quem fez não dá nota. Esta skill abre 4 revisores novos, que não viram nada desta conversa, entrega a cada um só o pacote do site e a lente dele, e junta o resultado. Ela não pergunta nada à pessoa, a não ser no fim da terceira rodada sem meta.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## 1. Antes de chamar os revisores

A checagem mecânica vem antes do julgamento: o diretor de arte não gasta olho com link morto. Rode e leia (N = número da rodada):
1. `./estudio montar <nome>` e `./estudio preflight <nome>`: precisa de `ok:true`. Vermelho não vai para revisor: corrija antes.
2. `./estudio desempenho <nome>`: só relatório.
3. `./estudio prints <nome> --rodada N`: fotos novas de todas as páginas, nos quatro tamanhos, inteiras e por parte, em `sites/<nome>/revisao/prints-rN/` (código `PRINTS_PRONTOS`, lista em `dados.fotos`). Olhe primeiro o celular (390) e depois o tablet (768). Aviso `FOTO_LISA`: abra a foto antes de seguir; algo pode não ter carregado. Cabeçalho e barra presos saem só no topo, onde a pessoa os vê ao abrir; não precisa avisar o revisor. Um `prints` por vez: `PRINTS_EM_ANDAMENTO` quer dizer que outro já está fotografando a mesma rodada.
4. Guarde a última linha do `preflight` em `sites/<nome>/revisao/preflight-rN.json` e a do `desempenho` em `sites/<nome>/revisao/desempenho-rN.json`.
5. `./estudio revisao <nome> --rodada N` (código `REVISAO_PRONTA`): escreve `sites/<nome>/revisao/contexto-rN.md`, com a régua das notas e o que as rodadas anteriores aceitaram e recusaram. Aviso `RODADA_ILEGIVEL`: corrija o `rodada-K.json` indicado antes de seguir.

## 2. O pacote

Cada revisor recebe só caminhos de arquivos, nunca a sua opinião:
- `sites/<nome>/revisao/contexto-rN.md` (a régua das notas e o que já foi decidido), **sempre a primeira leitura**;
- `sites/<nome>/brief.md` (objetivo, público, ação principal, mapa do site);
- `sites/<nome>/direcao.md` (tese visual, tipografia, foto, cor, movimento);
- `sites/<nome>/referencias.md` (os princípios aprendidos);
- `sites/<nome>/fatos.md` e `referencias/` (as fontes dos fatos);
- `sites/<nome>/revisao/prints-rN/` (as fotos, nos quatro tamanhos);
- `sites/<nome>/site/` (o site montado) e `sites/<nome>/_gerador/` (a fonte);
- `minha-marca/marca.md`, se existir;
- `sites/<nome>/revisao/preflight-rN.json` e `desempenho-rN.json` (relatório mecânico);
- o endereço do site aberto por `./estudio abrir <nome>`, quando o revisor puder usar um navegador.

O que **nunca** entra no pedido ao revisor: a nota esperada ou a meta, qual versão é a nova, o problema que você acha que existe, "justifique por que não deu mais", nem qualquer parte desta conversa.

## 3. As 4 lentes

Todo pedido começa com: "Leia primeiro <contexto-rN.md>: dê a nota pela régua dele e não reabra o que está em Recusados sem fato novo." Peça a cada revisor: nota de 0 a 10 (uma casa decimal) **por página** e a nota geral, os problemas do mais grave ao menos grave (cada um com página, tamanho de tela, parte, o que está errado e o conserto concreto) e o que está bom e não deve ser mexido. O revisor só lê; não edita nada.

**Diretor de arte.** "Você é diretor de arte de sites premiados. Leia <direcao.md> e <referencias.md>, depois olhe as fotos em <prints-rN>, começando pelo celular, e o código em <site>. Avalie: a tese visual de <direcao.md> se cumpre em todas as páginas? A tipografia tem personalidade e cria hierarquia sem precisar de caixa? O ritmo varia (tela cheia, respiro, pico)? A foto é real, bem cortada e com luz que serve à mensagem? O movimento tem propósito e não atrapalha a leitura? O computador e o celular contam a mesma história? Há grade de cartões com borda e fundo, ícone em quadradinho, gradiente genérico ou qualquer coisa com cara de gerada? Faça o teste: trocando o nome do negócio, esta página serviria para outro? Aponte cada parte que falha."

**Diretor geral.** Começa pelo **teste do visitante**, dentro desta lente (não é um quinto revisor): "Antes de ler qualquer outro arquivo, abra só <prints-rN>/inicio-390-inteira.jpg, como alguém que achou o site no celular e nunca ouviu falar do negócio. Responda em uma linha cada: 1) o que este lugar oferece; 2) qual é o próximo passo que a página pede; 3) dá para fazer esse passo sozinho, só com o celular, sem perguntar nada a ninguém (sim ou não, e por quê). Só depois siga." E então: "Você dirige o site. Leia <brief.md>, depois veja as fotos em <prints-rN> na ordem das páginas e leia o texto das páginas em <site>. Avalie: o site cumpre o objetivo do brief para esse público? A ação principal é óbvia em 5 segundos, no celular, sem rolar? Cada parte tem uma mensagem só, e a sequência conta uma história que leva à ação? O tom combina com <marca.md>? O texto soa como gente da marca falando, sem jargão, sem frase de efeito vazia, sem 'bem-vindo ao nosso site'? O fecho de cada página diz o que fazer? Compare suas 3 respostas do teste do visitante com o objetivo e a ação principal do brief: se não batem, ou se a 3 é não, esse é o problema mais grave da sua lista."

**Revisor de fatos.** "Você confere fatos. Liste todo número, preço, endereço, telefone, horário, @, e-mail, nome, ano, prêmio, depoimento e afirmação de fato que aparece no texto das páginas em <site>, nos links de contato e nos dados estruturados (JSON-LD). Para cada um, procure a fonte em <fatos.md> e nos arquivos de <referencias>. Marque: confere, diverge (diga o certo), sem fonte. Marque também afirmação absoluta que a fonte não sustenta ('o melhor', 'o único', 'desde sempre') e depoimento sem origem. Não use conhecimento de fora como fonte."

**QA.** "Você testa qualidade. Leia <preflight-rN.json> e <desempenho-rN.json> inteiros (vermelhos e amarelos) e explique cada amarelo em uma linha. Abra o código em <site>: cada página tem `lang`, `title`, `description` e um `h1`; os títulos seguem em ordem; imagens têm texto alternativo que descreve; links e botões têm nome; nenhum `<select>` nativo; nenhum endereço da internet carregado pela página; contato funciona (`tel:`, `mailto:`, WhatsApp). Confira o teclado de ponta a ponta (a ordem do Tab segue a leitura, o foco aparece, menu e partes interativas abrem e fecham pelo teclado e pelo Esc), o leitor de tela nas partes interativas (nome, papel, estado), e o movimento reduzido (com `prefers-reduced-motion: reduce`, todo o conteúdo aparece, parado). Veja <prints-rN> procurando texto cortado, sobreposto, pequeno, com contraste fraco ou alvo de toque apertado no celular."

## 4. Como abrir os revisores

Antes da primeira rodada, avise a pessoa em uma frase do tempo e do consumo: "Agora 4 especialistas vão olhar o site, cada um de um jeito. Leva uns 10 a 15 minutos; se eles pedirem ajustes, eu arrumo e eles olham de novo, até 3 vezes. Isso gasta uma parte maior do seu plano do que uma conversa comum." Não pergunte; só avise e siga.

Escolha o jeito na ordem abaixo e use o primeiro que existir:
- **Claude Code:** use a ferramenta de subagente (Agent ou Task), **um subagente novo por lente**, os quatro em paralelo. Passe o texto da lente com os caminhos completos.
- **Codex com subagente:** um subagente novo por lente, como no Claude Code.
- **Codex sem subagente, com o programa `codex` instalado:** confira antes se ele existe (`command -v codex` no Mac; `Get-Command codex` no PowerShell). Se existir, rode um processo novo, só leitura, por lente: `codex exec --sandbox read-only --cd "<pasta do estúdio>" "<texto da lente>"`. Avise antes, em uma frase: "Vou chamar revisores separados para conferir. O Codex vai pedir licença. Pode aprovar."
- **Sem subagente e sem o programa `codex`:** não tente instalar nada nem chamar o que não existe. Vá direto para as 4 lentes em sequência, cada uma começando do zero: releia só o pacote, escreva a avaliação sem consultar o que você pensou como autor, e só depois passe à próxima lente.

Cada rodada usa revisores novos. Nunca reaproveite o da rodada anterior.

## 5. Juntar e conferir

1. Nota da rodada = média das notas gerais das 4 lentes. **Passa com 8,5 ou mais e nenhuma lente abaixo de 7,5.** Fato sem fonte ou divergente, problema de QA que impede alguém de usar o site (teclado preso, botão sem nome, texto ilegível) e teste do visitante com "não" na terceira pergunta bloqueiam mesmo com média alta.
2. Revisor também erra. Antes de aplicar cada correção, confira: o fato contra a fonte; o problema visual contra a foto; a sugestão contra o brief aprovado e o piloto aprovado. Mudança que contraria o que a pessoa aprovou vira pergunta para ela, não correção.
3. Grave `sites/<nome>/revisao/rodada-N.md`: as 4 notas (por página e geral), a média, as respostas do teste do visitante, os problemas aceitos (com a correção feita), os recusados (com o porquê). Grave também `sites/<nome>/revisao/rodada-N.json`, que o comando `revisao` passa aos revisores da rodada seguinte:
   ```json
   {
     "rodada": 2,
     "notas": { "arte": 8.2, "geral": 8.6, "fatos": 8.8, "qa": 9.0 },
     "visitante": { "oferta": "o que o visitante entendeu", "proximo_passo": "o passo que ele viu", "sem_ajuda": true },
     "bloqueios": [],
     "aceitos": [{ "lente": "arte", "pagina": "index.html", "problema": "o que estava errado", "conserto": "o que foi feito" }],
     "recusados": [{ "lente": "fatos", "problema": "o que foi pedido", "porque": "por que ficou como está" }]
   }
   ```
   `lente` é `arte`, `geral`, `fatos` ou `qa`. `bloqueios` lista o que impede passar mesmo com média alta (fato sem fonte, QA que impede o uso, visitante sem ajuda = não); pendência que só o dono do negócio resolve não entra aqui, vai para o `andamento.md`.
4. Atualize o `andamento.md` (`revisão: rodada N, nota X`).

## 6. Rodadas

- **Passou:** volte para a skill que chamou (normalmente `novo-site`, etapa de entrega).
- **Não passou e N < 3:** corrija os problemas aceitos, do mais grave ao menos grave, no `_gerador/`. Rode `montar`, `preflight`, `prints --rodada N+1` (leia as páginas mexidas, nos quatro tamanhos), `revisao --rodada N+1` e uma nova rodada com revisores novos, que também conferem se a correção anterior pegou.
- **Não passou na rodada 3:** pare. Diga à pessoa, em até 4 frases, a nota, o que melhorou e os 2 ou 3 problemas que faltam, com a página de cada um. Pergunte: "Como você prefere seguir?" com "Corrigir esses pontos e revisar de novo ★", "Entregar assim" e "Eu mesmo vou ajustar".

Diferença de até 0,3 numa lente, ou de até 0,1 na média, entre rodadas é ruído, não progresso.

## Como medir a meta

A meta da revisão é passar em até 2 rodadas, com cada lente variando no máximo 0,3 de uma rodada para a outra. Depois de gravar o `rodada-N.json`, `./estudio revisao <nome>` devolve em `dados.notas` a média de cada rodada e se passou, em `dados.passou_na_rodada` a primeira rodada que passou e em `dados.oscilacao` a maior variação de cada lente. Meta cumprida: `passou_na_rodada` é 1 ou 2 e nenhum valor de `oscilacao` passa de 0,3.

## Quando a pessoa pede só uma nota

Rode uma rodada, conte em até 3 frases a nota, o que está melhor e o maior problema (com a página), e pergunte se ela quer que você corrija.
