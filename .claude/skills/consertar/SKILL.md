---
name: consertar
description: Descobre e conserta o que deu errado no Site Estúdio - programa faltando, navegador escondido que não abre, comando que falhou duas vezes, página reprovada que não sai do vermelho, arquivo sumido - sem pedir à pessoa para ler log ou digitar comando. Use quando a pessoa disser "deu erro", "travou", "não funciona", "sumiu", ou quando um comando do estúdio devolver ok falso duas vezes seguidas.
---

# Consertar

A pessoa não sabe o que é log ou terminal. Ela sabe que "não funcionou". Você descobre o motivo, conserta e explica em 1 ou 2 frases.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`), sempre de dentro da pasta do estúdio. Leia só a última linha (JSON).

## 1. Acalmar e olhar
Diga uma frase só: "Vou olhar o que aconteceu. Não precisa fazer nada." E rode:
1. `./estudio verificar`: confere Node, navegador e o que os comandos precisam.
2. A verificação do instalador:
   - Mac: `bash instalar/verificar.sh`
   - Windows (PowerShell ou Git Bash): `powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar/verificar.ps1`

No Codex, a verificação do instalador roda pedindo para sair da área protegida.

Se nem o `./estudio` rodar e a última linha disser `ESTUDIO_NAO_INSTALADO`, rode a skill `instalar-estudio` (ela pula o que já está pronto). Se a pasta do estúdio sumiu ou mudou de lugar, diga: "Não achei o estúdio no lugar de sempre. Você mudou o site-estudio de lugar ou trocou o nome dele?" e ajude a achar, sem apagar nada.

## 2. Entender o código
- Item da verificação do instalador com `ok:false`: é de instalação. O texto está em `instalar/mensagens.json` (`itens` e `erros`), e o item traz `passo`.
- Código vindo de um comando `./estudio`: o texto e a `acao` estão em `kit/mensagens.json`. Avisos em `avisos` também têm `codigo`.
- Código que não está em nenhum dos dois: use `DESCONHECIDO` de `instalar/mensagens.json`.

## 3. Consertar instalação
Para cada item que falhou:
1. Avise com o I-04 do item.
2. Rode o passo:
   - Mac: `bash instalar/instalar.sh passo <passo> --agente <claude|codex>`
   - Windows: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar/instalar.ps1 passo <passo> --agente <claude|codex>`
3. Siga o código do resultado como na skill `instalar-estudio` (tente de novo uma vez sozinho quando `acao_automatica` for `tentar_de_novo`).
4. Rode a verificação de novo.

Casos que pedem cuidado:
- `USE_O_INSTALADOR_DO_WINDOWS`: o instalador do Mac foi chamado no Windows. Sem falar nada, use o do Windows.
- `INTERNET_BLOQUEADA_PELA_CAIXA`: a internet funciona; a área protegida do programa barrou. Rode de novo pedindo internet. Nunca culpe o Wi-Fi.
- `SISTEMA_ANTIGO`: o computador não roda o estúdio. Diga o texto e não tente de novo.
- Navegador escondido que não abre depois de instalado: rode `passo navegador` de novo. Se a pessoa tiver o Google Chrome ou o Edge instalado, os comandos também conseguem usar esse.

## 4. Consertar os comandos
Siga a `acao` do código em `kit/mensagens.json`. Em geral:
- **Saída 2 (reprovado)** não é defeito do estúdio: é o site que precisa de ajuste. Leia os vermelhos em `dados` (cada um diz a página, o tamanho de tela, o tipo e o detalhe), corrija a parte certa em `_gerador/secoes/`, rode `./estudio montar <nome>` e o comando de novo. Volte à skill que estava rodando.
- `SITE_NAO_ACHADO` ou `NOME_INVALIDO`: confira o nome em `sites/` (letras minúsculas, números e hífen) e rode de novo com o nome certo.
- `SITE_SEM_INDEX` ou `SITE_SEM_PAGINAS`: rode `./estudio montar <nome>`.
- `GERADOR_AUSENTE`: recrie o `_gerador/` do site a partir do molde, como diz a `acao`, e monte de novo.
- `MONTAR_FALHOU`: `dados.detalhe` diz qual parte do `_gerador/` deu erro. Corrija essa parte e monte de novo. Nunca conserte editando `site/` à mão: a próxima montagem apaga.
- `NODE_ANTIGO` ou `ESTUDIO_NAO_INSTALADO`: rode `passo node` do instalador.
- `CHROME_NAO_ACHADO` ou `CHROME_NAO_ABRIU`: rode `passo navegador` do instalador. No Codex, rode o comando de novo fora da área protegida antes.
- `AXE_AUSENTE`: falta um arquivo do próprio estúdio. Rode a skill `atualizar-estudio`; nunca baixe esse arquivo de outro lugar.
- Aviso `DEPENDENCIAS_MUDARAM`: pacotes, Node ou navegador mudaram. Rode o instalador de novo como na skill `instalar-estudio` (`passo node`, `passo pacotes`, `passo navegador`); o que já está pronto é pulado.
- `PACOTE_ARQUIVO_PRIVADO` (no `pacote`): há em `site/` arquivo que não pode ir para a internet (lista em `dados.arquivos`: oculto, link, `.env`, chave, cópia de segurança ou rascunho como `.old`, `.bak`, `.tmp`, `~` e pastas `backup`, `old`, `tmp`; só `.nojekyll` e `.well-known/` passam, de propósito). Mostre a lista, pergunte à pessoa e tire cada um de `site/` (o que for dela vai para `material/`). Nunca contorne a conferência.
- `SERVIDOR_NAO_SUBIU` (no `abrir`): feche outras janelas do estúdio e rode de novo.
- `ESPELHO_DIFERENTE` (o `espelhar --conferir` reprovou): algum arquivo de instruções do estúdio foi mexido. Não edite à mão: rode `./estudio espelhar` para refazer as cópias a partir das fontes e `./estudio espelhar --conferir` para confirmar.

## 5. Página que não sai do vermelho
Depois de duas correções sem sair do vermelho na mesma página:
1. Abra a foto dessa página, no tamanho de tela do vermelho, e leia o `detalhe`.
2. Pergunte se é remendo ou se a parte precisa ser repensada: texto demais para o celular pede menos texto ou outra composição, não letra menor (o mínimo no celular é 16 px); contraste fraco pede outra cor da paleta, não sombra no texto; alvo de toque pequeno pede botão maior, não espaço invisível.
3. Mude a parte, monte e rode o comando de novo.
4. Vermelho de `fatos` que não sai: o número está na página mas não em `fatos.md`. Pergunte à pessoa a fonte. Sem fonte, o número sai do site.

## 6. Arquivo em uso ou pouco espaço
- `ARQUIVO_EM_USO`: diga o texto do código e espere o "pronto".
- Pouco espaço: as fotos de `revisao/prints-r*/` e os pacotes `.zip` de sites antigos são o que mais ocupa. Nunca apague nada sem pedir: mostre o que ocupa e deixe a pessoa decidir.

## 7. Explicar
Em 1 ou 2 frases simples: o que houve e o que você fez. Exemplo: "O navegador escondido tinha ficado pela metade. Instalei de novo e as fotos já saem." Depois volte ao que a pessoa estava fazendo, de onde parou.

## 8. Se nada resolver
Depois de duas tentativas sem sucesso no mesmo problema:
> Não consegui resolver sozinho. O problema é: {{explicação em uma frase}}. Quer que eu tente mais uma vez ou prefere pedir ajuda?
> 1. Tentar mais uma vez ★
> 2. Vou pedir ajuda

Se ela for pedir ajuda, diga que pode abrir um aviso em <https://github.com/autonom-ia/site-estudio/issues> com a frase: "{{código}} ao rodar {{nome}}" e a versão de `./estudio versao`. Nunca inclua arquivos do site nem dados pessoais nesse aviso.

## Proibido

- Pedir para a pessoa ler log, abrir o terminal ou digitar comando.
- Mostrar log ou caminho técnico, a não ser na frase para pedir ajuda.
- Apagar `minha-marca/`, `sites/` ou `referencias/`.
- Instalar qualquer coisa fora do instalador.
- Editar `AGENTS.md`, `CLAUDE.md`, as skills ou o `kit/`.
