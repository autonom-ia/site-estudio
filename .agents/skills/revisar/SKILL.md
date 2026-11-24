---
name: revisar
description: Revisa um site do Site Estúdio com 4 revisores independentes (diretor de arte, diretor geral, revisor de fatos e QA), cada um sem o histórico da conversa, com nota de 0 a 10 por página e problemas com conserto concreto; meta 8,5 em até 3 rodadas, e na terceira sem meta para e mostra à pessoa o que falta. Use na etapa de revisão da novo-site e quando a pessoa pedir "dá uma nota", "revisa", "está bom?".
---

# Revisar

Quem fez não dá nota. Esta skill abre 4 revisores novos, que não viram nada desta conversa, entrega a cada um só o pacote do site e a lente dele, e junta o resultado. Só pergunta à pessoa quando uma mudança contraria o que a pessoa aprovou (seção 5) e no fim da terceira rodada sem meta.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## 1. Antes de chamar os revisores

A checagem mecânica vem antes do julgamento: o diretor de arte não gasta olho com link morto. A pessoa acompanha com o site aberto: rode `./estudio abrir <nome>` antes de tudo (chamada direto pela pessoa, fora da `novo-site`, rode antes `./estudio montar <nome>`, para a prévia mostrar o site atual) e diga uma frase de andamento antes de cada passo (`ANDAMENTO_*` em `kit/mensagens.json`; a skill `novo-site`, etapa 9, diz qual em cada passo). Rode e leia (N = número da rodada):
1. `./estudio montar <nome>` e `./estudio preflight <nome>`: precisa de `ok:true`. Vermelho não vai para revisor: corrija antes.
2. `./estudio desempenho <nome>`: só relatório.
3. `./estudio prints <nome> --rodada N`: fotos novas de todas as páginas, nos quatro tamanhos, inteiras e por parte, em `sites/<nome>/revisao/prints-rN/` (código `PRINTS_PRONTOS`, lista em `dados.fotos`). Olhe primeiro o celular (390) e depois o tablet (768). Aviso `FOTO_LISA`: abra a foto antes de seguir; algo pode não ter carregado. Cabeçalho e barra presos saem só no topo, onde a pessoa os vê ao abrir; não precisa avisar o revisor. Um `prints` por vez: `PRINTS_EM_ANDAMENTO` quer dizer que outro já está fotografando a mesma rodada.
4. Guarde a última linha do `preflight` em `sites/<nome>/revisao/preflight-rN.json` e a do `desempenho` em `sites/<nome>/revisao/desempenho-rN.json`.
5. `./estudio revisao <nome> --rodada N` (código `REVISAO_PRONTA`): escreve `sites/<nome>/revisao/contexto-rN.md`, com a régua das notas e o que as rodadas anteriores aceitaram e recusaram. Aviso `RODADA_ILEGIVEL`: corrija o `rodada-K.json` indicado antes de seguir.

## 2. O pacote

Cada revisor recebe só caminhos de arquivos, nunca a sua opinião:
- `sites/<nome>/revisao/contexto-rN.md` (a régua das notas e o que já foi aceito e recusado, sem nota de rodada nenhuma), **a primeira leitura**; no diretor geral, logo depois do teste do visitante;
- `sites/<nome>/brief.md` (objetivo, público, ação principal, mapa do site);
- `sites/<nome>/direcao.md` (tese visual, tipografia, foto, cor, movimento);
- `sites/<nome>/referencias.md` (os princípios aprendidos);
- `sites/<nome>/fatos.md`, `referencias/` e `sites/<nome>/coleta/` (as fontes dos fatos; `coleta/` é o que o estúdio leu do Instagram, do Google e do site atual);
- `sites/<nome>/revisao/prints-rN/` (as fotos, nos quatro tamanhos);
- `sites/<nome>/site/` (o site montado) e `sites/<nome>/_gerador/` (a fonte);
- `minha-marca/marca.md`, se existir;
- `sites/<nome>/revisao/preflight-rN.json` e `desempenho-rN.json` (relatório mecânico);
- o endereço do site aberto por `./estudio abrir <nome>`, quando o revisor puder usar um navegador.

O que **nunca** entra no pedido ao revisor: a nota esperada ou a meta, a nota de rodada anterior, o que é ruído entre notas, qual versão é a nova, o problema que você acha que existe, "justifique por que não deu mais", nem qualquer parte desta conversa.

## 3. As 4 lentes

O pedido do diretor de arte, do revisor de fatos e do QA começa com: "Leia primeiro <contexto-rN.md>: dê a nota pela régua dele e não reabra o que está em Recusados sem fato novo." O do diretor geral começa pelo teste do visitante e só depois manda ler o contexto (ver abaixo): quem já leu o que foi corrigido não é mais um visitante novo. Peça a cada revisor: nota de 0 a 10 (uma casa decimal) **por página** e a nota geral, os problemas do mais grave ao menos grave (cada um com página, tamanho de tela, parte, o que está errado e o conserto concreto) e o que está bom e não deve ser mexido. O revisor só lê; não edita nada.

**Diretor de arte.** "Você é diretor de arte de sites premiados. Leia <direcao.md> e <referencias.md>, depois olhe as fotos em <prints-rN>, começando pelo celular, e o código em <site>. Avalie: a tese visual de <direcao.md> se cumpre em todas as páginas? A tipografia tem personalidade e cria hierarquia sem precisar de caixa? O ritmo varia (tela cheia, respiro, pico)? A foto é real, bem cortada e com luz que serve à mensagem? O movimento tem propósito e não atrapalha a leitura? O computador e o celular contam a mesma história? Há grade de cartões com borda e fundo, ícone em quadradinho, gradiente genérico ou qualquer coisa com cara de gerada? Faça o teste: trocando o nome do negócio, esta página serviria para outro? Aponte cada parte que falha."

**Diretor geral.** Começa pelo **teste do visitante**, dentro desta lente (não é um quinto revisor): "Antes de ler qualquer outro arquivo, abra só <prints-rN>/inicio-390-inteira.jpg, como alguém que achou o site no celular e nunca ouviu falar do negócio. Responda em uma linha cada: 1) o que este lugar oferece; 2) qual é o próximo passo que a página pede; 3) dá para fazer esse passo sozinho, só com o celular, sem perguntar nada a ninguém (sim ou não, e por quê). Escreva as 3 respostas antes de abrir qualquer outro arquivo e não as mude depois." E então: "Agora leia <contexto-rN.md>: dê a nota pela régua dele e não reabra o que está em Recusados sem fato novo. Você dirige o site. Leia <brief.md>, depois veja as fotos em <prints-rN> na ordem das páginas e leia o texto das páginas em <site>. Avalie: o site cumpre o objetivo do brief para esse público? A ação principal é óbvia em 5 segundos, no celular, sem rolar? Cada parte tem uma mensagem só, e a sequência conta uma história que leva à ação? O tom combina com <marca.md>? O texto soa como gente da marca falando, sem jargão, sem frase de efeito vazia, sem 'bem-vindo ao nosso site'? O fecho de cada página diz o que fazer? Compare suas 3 respostas do teste do visitante com o objetivo e a ação principal do brief: se não batem, ou se a 3 é não, esse é o problema mais grave da sua lista."

**Revisor de fatos.** "Você confere fatos. Liste todo número, preço, endereço, telefone, horário, @, e-mail, nome, ano, prêmio, depoimento e afirmação de fato que aparece no texto das páginas em <site>, nos links de contato e nos dados estruturados (JSON-LD). Para cada um, procure a fonte em <fatos.md>, nos arquivos de <referencias> e em <coleta> (o que o estúdio leu do Instagram, do Google e do site atual). Marque: confere, diverge (diga o certo), sem fonte. Marque também afirmação absoluta que a fonte não sustenta ('o melhor', 'o único', 'desde sempre') e depoimento sem origem. Depois leia frase por frase: todo texto da página nasce de uma linha de <fatos.md>. Frase sem linha, ou que diz mais do que a linha (generaliza, enfeita, inventa um costume, um lugar ou um produto), é 'sem fonte'. Não use conhecimento de fora como fonte."

**QA.** "Você testa qualidade. Leia <preflight-rN.json> e <desempenho-rN.json> inteiros (vermelhos e amarelos) e explique cada amarelo em uma linha. Abra o código em <site>: cada página tem `lang`, `title`, `description` e um `h1`; os títulos seguem em ordem; imagens têm texto alternativo que descreve; links e botões têm nome; nenhum `<select>` nativo; nenhum endereço da internet carregado pela página; contato funciona (`tel:`, `mailto:`, WhatsApp). Confira o teclado de ponta a ponta (a ordem do Tab segue a leitura, o foco aparece, menu e partes interativas abrem e fecham pelo teclado e pelo Esc), o leitor de tela nas partes interativas (nome, papel, estado), e o movimento reduzido (com `prefers-reduced-motion: reduce`, todo o conteúdo aparece, parado). Veja <prints-rN> procurando texto cortado, sobreposto, pequeno, com contraste fraco ou alvo de toque apertado no celular."

## 4. Como abrir os revisores

Antes da primeira rodada, no lugar do texto de `ANDAMENTO_OLHARES` (não diga os dois), avise a pessoa em uma frase do tempo e do consumo: "Agora quatro olhares independentes conferem o site, cada um de um jeito. Leva uns 10 a 15 minutos; se eles pedirem ajustes, eu arrumo e eles olham de novo, até 3 vezes. Isso gasta uma parte maior do seu plano do que uma conversa comum. Enquanto isso, o site fica aberto para você olhar." Não pergunte; só avise e siga.

Escolha o jeito na ordem abaixo e use o primeiro que existir:
- **Claude Code:** use a ferramenta de subagente (Agent ou Task), **um subagente novo por lente**, os quatro em paralelo. Passe o texto da lente com os caminhos completos.
- **Codex com subagente:** um subagente novo por lente, como no Claude Code.
- **Codex sem subagente, com o programa `codex` instalado:** confira antes se ele existe (`command -v codex` no Mac; `Get-Command codex` no PowerShell). Se existir, rode um processo novo, só leitura, por lente: `codex exec --sandbox read-only --cd "<pasta do estúdio>" "<texto da lente>"`. Avise antes, em uma frase: "Vou chamar ajudantes separados para conferir. O Codex vai pedir licença. Pode aprovar."
- **Sem subagente e sem o programa `codex`:** não tente instalar nada nem chamar o que não existe. Vá direto para as 4 lentes em sequência, cada uma começando do zero: releia só o pacote, escreva a avaliação sem consultar o que você pensou como autor, e só depois passe à próxima lente.

Cada rodada usa revisores novos. Nunca reaproveite o da rodada anterior.

## 5. Juntar e conferir

1. Nota da rodada = média das notas gerais das 4 lentes. **Passa com 8,5 ou mais e nenhuma lente abaixo de 7,5.** Fato sem fonte ou divergente, problema de QA que impede alguém de usar o site (teclado preso, botão sem nome, texto ilegível) e teste do visitante com "não" na terceira pergunta bloqueiam mesmo com média alta. Visitante com resposta que não bate com o brief, ou com "não" na terceira pergunta, põe o diretor geral no teto 7 (a régua manda): se a nota dele veio acima, devolva a ele.
2. Revisor também erra. Antes de aplicar cada correção, confira: o fato contra a fonte; o problema visual contra a foto; a sugestão contra o brief aprovado e o piloto aprovado. Mudança que contraria o que a pessoa aprovou vira pergunta para ela, não correção.
3. Grave `sites/<nome>/revisao/rodada-N.md`: as 4 notas (por página e geral), a média, as respostas do teste do visitante, os problemas aceitos (com a correção feita), os recusados (com o porquê). Grave também `sites/<nome>/revisao/rodada-N.json`, que o comando `revisao` passa aos revisores da rodada seguinte:
   ```json
   {
     "rodada": 2,
     "notas": { "arte": 8.2, "geral": 8.6, "fatos": 8.8, "qa": 9.0 },
     "visitante": { "oferta": "o que o visitante entendeu", "proximo_passo": "o passo que ele viu", "sem_ajuda": true, "bate_com_brief": true },
     "bloqueios": [],
     "aceitos": [{ "lente": "arte", "pagina": "index.html", "problema": "o que estava errado", "conserto": "o que foi feito" }],
     "recusados": [{ "lente": "fatos", "problema": "o que foi pedido", "porque": "por que ficou como está" }]
   }
   ```
   `lente` é `arte`, `geral`, `fatos` ou `qa`. `visitante` é obrigatório. `bate_com_brief` é você quem marca, comparando as respostas 1 e 2 do visitante com o objetivo e a ação principal do brief: `false` quando a oferta ou o próximo passo não batem. `sem_ajuda: false` já conta como bloqueio no comando `revisao`; com `sem_ajuda` ou `bate_com_brief` em `false`, ele também acusa em `dados.notas[].alertas` o diretor geral acima do teto 7. `reavaliacao` só existe quando você mede a estabilidade (ver "Como medir a meta"). `bloqueios` lista o que impede passar mesmo com média alta (fato sem fonte, QA que impede o uso, visitante sem ajuda = não); pendência que só o dono do negócio resolve não entra aqui, vai para `andamento.md` > Pendências (a skill `hospedar` pergunta antes de publicar).
4. Atualize o `andamento.md` (`revisão: rodada N, nota X`).

## 6. Rodadas

- **Passou:** volte para a skill que chamou (normalmente `novo-site`, etapa de entrega).
- **Não passou e N < 3:** corrija os problemas aceitos, do mais grave ao menos grave, no `_gerador/`. Rode `montar`, `preflight`, `prints --rodada N+1` (leia as páginas mexidas, nos quatro tamanhos), `revisao --rodada N+1` e uma nova rodada com revisores novos, que também conferem se a correção anterior pegou.
- **Não passou na rodada 3:** pare. Diga à pessoa, em até 4 frases, o que melhorou e o que falta para ficar pronto: os 2 ou 3 problemas, com a página de cada um, em palavras do dia a dia. Sem número, sem contar vezes. Pergunte: "Como você prefere seguir?" com "Corrigir esses pontos e revisar de novo ★", "Entregar assim" e "Eu mesmo vou ajustar".

Só para você, nunca no pedido ao revisor: diferença de até 0,3 numa lente entre rodadas pode ser ruído do revisor, não progresso.

## Como medir a meta

São duas metas, medidas em separado. Depois de gravar o `rodada-N.json`, rode `./estudio revisao <nome>` e leia `dados`:
- **Passar em até 2 rodadas** (indicador interno do estúdio, para medir o método; a regra da revisão continua sendo até 3 rodadas): `dados.passou_na_rodada` é 1 ou 2 (`dados.metas.em_ate_2_rodadas` é `true`). A média é comparada sem arredondar: 8,45 não passa.
- **Estabilidade (cada lente varia no máximo 0,3):** não se mede entre rodadas, porque entre elas houve conserto. Mede-se reavaliando o **mesmo estado** do site: na rodada que você quer medir, sem mexer em nada, abra revisores novos só para as lentes que quer medir (as 4, ou uma só, como a de arte, que é a que mais oscila), com o mesmo pacote e o mesmo `contexto-rN.md`, e grave a nota geral de cada um em `reavaliacao.notas` do `rodada-N.json`, só com as lentes reavaliadas: `"reavaliacao": { "notas": { "arte": 8.4 } }` mede só a arte. A nota da rodada continua a da primeira avaliação. Depois rode `./estudio revisao <nome>`: `dados.estabilidade` traz a maior diferença de cada lente reavaliada (`null` na lente que não foi reavaliada; a `media` só sai quando as 4 foram reavaliadas); `dados.metas.estabilidade` é `true` quando nenhuma lente medida passa de 0,3, e `null` enquanto não houver reavaliação. `RODADA_ILEGIVEL` nesse passo quer dizer nota fora de 0 a 10 ou nome de lente errado na `reavaliacao`. Os revisores da reavaliação não sabem que são reavaliação nem veem a nota dos primeiros.

## Quando a pessoa pede só uma nota

Rode uma rodada. Conte à pessoa, em até 3 frases, como o site está em palavras do dia a dia ("está quase pronto", "falta pouco", "ainda precisa de ajustes"), o que está melhor e o maior problema (com a página), sem dizer o número. Pergunte se ela quer que você corrija.
