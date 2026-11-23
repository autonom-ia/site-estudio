---
name: revisar
description: Revisa um site do Site Estúdio com 4 revisores independentes (diretor de arte, diretor geral, revisor de fatos e QA), cada um sem o histórico da conversa, com nota de 0 a 10 por página e problemas com conserto concreto; meta 8,5 em até 3 rodadas, e na terceira sem meta para e mostra à pessoa o que falta. Use na etapa de revisão da novo-site e quando a pessoa pedir "dá uma nota", "revisa", "está bom?".
---

# Revisar

Quem fez não dá nota. Esta skill abre 4 revisores novos, que não viram nada desta conversa, entrega a cada um só o pacote do site e a lente dele, e junta o resultado. Ela não pergunta nada à pessoa, a não ser no fim da terceira rodada sem meta.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## 1. Antes de chamar os revisores

A checagem mecânica vem antes do julgamento: o diretor de arte não gasta olho com link morto. A pessoa acompanha com o site aberto: rode `./estudio abrir <nome>` antes de tudo e diga uma frase de andamento antes de cada passo (`ANDAMENTO_*` em `kit/mensagens.json`; a skill `novo-site`, etapa 9, diz qual em cada passo). Rode e leia (N = número da rodada):
1. `./estudio montar <nome>` e `./estudio preflight <nome>`: precisa de `ok:true`. Vermelho não vai para revisor: corrija antes.
2. `./estudio desempenho <nome>`: só relatório.
3. `./estudio prints <nome> --rodada N`: fotos novas de todas as páginas, nos quatro tamanhos, inteiras e por parte, em `sites/<nome>/revisao/prints-rN/` (código `PRINTS_PRONTOS`, lista em `dados.fotos`). Aviso `FOTO_LISA`: abra a foto antes de seguir; algo pode não ter carregado.
4. Guarde a última linha do `preflight` em `sites/<nome>/revisao/preflight-rN.json` e a do `desempenho` em `sites/<nome>/revisao/desempenho-rN.json`.

## 2. O pacote

Cada revisor recebe só caminhos de arquivos, nunca a sua opinião:
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

Peça a cada revisor: nota de 0 a 10 (uma casa decimal) **por página** e a nota geral, os problemas do mais grave ao menos grave (cada um com página, tamanho de tela, parte, o que está errado e o conserto concreto) e o que está bom e não deve ser mexido. O revisor só lê; não edita nada.

**Diretor de arte.** "Você é diretor de arte de sites premiados. Leia <direcao.md> e <referencias.md>, depois olhe as fotos em <prints-rN>, começando pelo celular, e o código em <site>. Avalie: a tese visual de <direcao.md> se cumpre em todas as páginas? A tipografia tem personalidade e cria hierarquia sem precisar de caixa? O ritmo varia (tela cheia, respiro, pico)? A foto é real, bem cortada e com luz que serve à mensagem? O movimento tem propósito e não atrapalha a leitura? O computador e o celular contam a mesma história? Há grade de cartões com borda e fundo, ícone em quadradinho, gradiente genérico ou qualquer coisa com cara de gerada? Faça o teste: trocando o nome do negócio, esta página serviria para outro? Aponte cada parte que falha."

**Diretor geral.** "Você dirige o site. Leia <brief.md>, depois veja as fotos em <prints-rN> na ordem das páginas e leia o texto das páginas em <site>. Avalie: o site cumpre o objetivo do brief para esse público? A ação principal é óbvia em 5 segundos, no celular, sem rolar? Cada parte tem uma mensagem só, e a sequência conta uma história que leva à ação? O tom combina com <marca.md>? O texto soa como gente da marca falando, sem jargão, sem frase de efeito vazia, sem 'bem-vindo ao nosso site'? O fecho de cada página diz o que fazer?"

**Revisor de fatos.** "Você confere fatos. Liste todo número, preço, endereço, telefone, horário, @, e-mail, nome, ano, prêmio, depoimento e afirmação de fato que aparece no texto das páginas em <site>, nos links de contato e nos dados estruturados (JSON-LD). Para cada um, procure a fonte em <fatos.md> e nos arquivos de <referencias>. Marque: confere, diverge (diga o certo), sem fonte. Marque também afirmação absoluta que a fonte não sustenta ('o melhor', 'o único', 'desde sempre') e depoimento sem origem. Não use conhecimento de fora como fonte."

**QA.** "Você testa qualidade. Leia <preflight-rN.json> e <desempenho-rN.json> inteiros (vermelhos e amarelos) e explique cada amarelo em uma linha. Abra o código em <site>: cada página tem `lang`, `title`, `description` e um `h1`; os títulos seguem em ordem; imagens têm texto alternativo que descreve; links e botões têm nome; nenhum `<select>` nativo; nenhum endereço da internet carregado pela página; contato funciona (`tel:`, `mailto:`, WhatsApp). Confira o teclado de ponta a ponta (a ordem do Tab segue a leitura, o foco aparece, menu e partes interativas abrem e fecham pelo teclado e pelo Esc), o leitor de tela nas partes interativas (nome, papel, estado), e o movimento reduzido (com `prefers-reduced-motion: reduce`, todo o conteúdo aparece, parado). Veja <prints-rN> procurando texto cortado, sobreposto, pequeno, com contraste fraco ou alvo de toque apertado no celular."

## 4. Como abrir os revisores

Antes da primeira rodada, avise a pessoa em uma frase do tempo e do consumo: "Agora quatro olhares independentes conferem o site, cada um de um jeito. Leva alguns minutos e gasta uma parte maior do seu plano do que uma conversa comum. Enquanto isso, o site fica aberto para você olhar." Não pergunte; só avise e siga.

Escolha o jeito na ordem abaixo e use o primeiro que existir:
- **Claude Code:** use a ferramenta de subagente (Agent ou Task), **um subagente novo por lente**, os quatro em paralelo. Passe o texto da lente com os caminhos completos.
- **Codex com subagente:** um subagente novo por lente, como no Claude Code.
- **Codex sem subagente, com o programa `codex` instalado:** confira antes se ele existe (`command -v codex` no Mac; `Get-Command codex` no PowerShell). Se existir, rode um processo novo, só leitura, por lente: `codex exec --sandbox read-only --cd "<pasta do estúdio>" "<texto da lente>"`. Avise antes, em uma frase: "Vou chamar ajudantes separados para conferir. O Codex vai pedir licença. Pode aprovar."
- **Sem subagente e sem o programa `codex`:** não tente instalar nada nem chamar o que não existe. Vá direto para as 4 lentes em sequência, cada uma começando do zero: releia só o pacote, escreva a avaliação sem consultar o que você pensou como autor, e só depois passe à próxima lente.

Cada rodada usa revisores novos. Nunca reaproveite o da rodada anterior.

## 5. Juntar e conferir

1. Nota da rodada = média das notas gerais das 4 lentes. **Passa com 8,5 ou mais e nenhuma lente abaixo de 7,5.** Fato sem fonte ou divergente, e problema de QA que impede alguém de usar o site (teclado preso, botão sem nome, texto ilegível), bloqueiam mesmo com média alta.
2. Revisor também erra. Antes de aplicar cada correção, confira: o fato contra a fonte; o problema visual contra a foto; a sugestão contra o brief aprovado e o piloto aprovado. Mudança que contraria o que a pessoa aprovou vira pergunta para ela, não correção.
3. Grave `sites/<nome>/revisao/rodada-N.md`: as 4 notas (por página e geral), a média, os problemas aceitos (com a correção feita), os recusados (com o porquê).
4. Atualize o `andamento.md` (`revisão: rodada N, nota X`).

## 6. Rodadas

- **Passou:** volte para a skill que chamou (normalmente `novo-site`, etapa de entrega).
- **Não passou e N < 3:** corrija os problemas aceitos, do mais grave ao menos grave, no `_gerador/`. Rode `montar`, `preflight`, `prints --rodada N+1` (leia as páginas mexidas, nos quatro tamanhos) e uma nova rodada com revisores novos, que também conferem se a correção anterior pegou.
- **Não passou na rodada 3:** pare. Diga à pessoa, em até 4 frases, a nota, o que melhorou e os 2 ou 3 problemas que faltam, com a página de cada um. Pergunte: "Como você prefere seguir?" com "Corrigir esses pontos e revisar de novo ★", "Entregar assim" e "Eu mesmo vou ajustar".

Diferença de até 0,1 entre rodadas é ruído, não progresso.

## Quando a pessoa pede só uma nota

Rode uma rodada, conte em até 3 frases a nota, o que está melhor e o maior problema (com a página), e pergunte se ela quer que você corrija.
