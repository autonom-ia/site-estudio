# Ler o Instagram com login

O comando `ler` lê o Instagram **sem login** por padrão. Quando a pessoa entra na conta dela por uma
janela do estúdio, as leituras seguintes usam esse login e trazem até 40 publicações. Este documento
descreve como funciona, os cuidados com a conta da pessoa e a prova ao vivo que ainda falta.

## Sem login (o padrão)

- O navegador sem janela do estúdio abre a página pública do perfil e a de cada publicação.
- Do perfil saem o nome, a bio, os links da bio e a grade com as publicações mais recentes.
- De cada publicação saem a legenda, a data e a foto na maior resolução que a página pública traz.
  Os dados vêm do JSON que a página traz embutido; sem ele, das etiquetas `og:` e do `<time datetime>`.
- **Limite.** Sem login, o Instagram mostra só as 12 publicações mais recentes. Ao rolar, ele pede
  para entrar na conta. Com menos de 12, o aviso é `LER_INSTAGRAM_POUCOS`.

## Onde fica o login

Fora da pasta do estúdio, na pasta de dados do usuário, longe de Documentos e da Área de Trabalho
(que costumam ir para a nuvem e para cópias de segurança), um perfil por pasta de estúdio:

| Sistema | Caminho |
|---|---|
| Mac | `~/Library/Application Support/site-estudio/instagram/<id>/perfil` |
| Windows | `%LOCALAPPDATA%\site-estudio\instagram\<id>\perfil` |
| Linux | `$XDG_DATA_HOME` (ou `~/.local/share`)`/site-estudio/instagram/<id>/perfil` |

`<id>` são os 12 primeiros caracteres do SHA-256 do caminho real da pasta do estúdio. Ao lado do
perfil, `pausa.json` guarda o dia de uma verificação. O perfil que a primeira versão guardava em
`.ferramentas/instagram/perfil` muda para o lugar novo na primeira vez (se o novo ainda não existe e
nenhum Chrome está usando o antigo). Código: `kit/scripts/lib/instagram-lugar.mjs`.

Nenhum pedaço do caminho entre a pasta de dados e o perfil pode ser atalho: o caminho real da pasta
da conta tem que ser o esperado. Senão, entrar, sair e a pausa recusam com
`INSTAGRAM_CAMINHO_ESTRANHO`, sem apagar nada.

**Risco da chave dos cookies.** O perfil abre com `--use-mock-keychain` no Mac e
`--password-store=basic` no Linux, na janela e na leitura sem janela. No Mac, a janela e o modo sem
janela usam chaves diferentes, e o login de um não valeria no outro (medido); o chaveiro do sistema
também pediria a senha do computador à pessoa. O preço: o cookie de sessão fica no disco protegido só
pelas permissões da pasta (criada só para o dono, 0700). Quem lê os arquivos do usuário lê o login.
Por isso: `./estudio instagram sair` apaga o perfil, e a skill `instalar-estudio` roda o sair antes de
desinstalar (o desinstalar só apaga `.ferramentas/`). No Windows, a chave é a do próprio usuário
(DPAPI), nos dois modos.

## Entrar na conta: `./estudio instagram entrar`

1. **Aviso antes.** Sem `--confirmar`, o comando não abre nada nem olha o login guardado: devolve
   `INSTAGRAM_ANTES_DE_ENTRAR`. O texto avisa que o Instagram pode mandar "alguém entrou na sua
   conta", que é o estúdio, pela janela que a pessoa abriu, e que a senha fica só com o Instagram.
   O assistente diz o texto e espera o sim.
2. **Janela normal, perfil próprio.** Com `--confirmar`: se o login guardado ainda vale,
   `INSTAGRAM_JA_ENTROU`. Senão, abre o Chrome (ou o Edge) instalado no computador, **com janela**,
   no perfil do estúdio. Não é o Chrome da pessoa e não usa os cookies dele.
3. **A pessoa entra sozinha.** O estúdio nunca vê, digita nem guarda a senha. Pelo protocolo de
   depuração do navegador (`Storage.getCookies`), ele só olha, a cada segundo, se o cookie
   `sessionid` do Instagram apareceu. Nenhuma página é lida para isso.
4. **Percebe, fecha e avisa.** Com a sessão, espera 3 segundos e fecha a janela pedindo ao navegador
   (`Browser.close`: no fechamento normal, o Chrome grava os cookies antes de o processo principal
   sair). Espera o principal sair sozinho, até 30 s: num computador lento ele leva mais de 10 s
   (medido num Mac sobrecarregado), e matar antes perde o login. Depois, dá até 15 s aos serviços
   que gravam no perfil (rede e armazenamento, da lista de `SystemInfo.getProcessInfo`) e encerra o
   que sobrar, para o próximo navegador abrir o perfil sem ninguém segurando os arquivos (no Windows,
   um serviço de rede antigo segurando o arquivo dos cookies esconde o login). Encerrar o principal à
   força é o último recurso, depois do teto. Por fim, confere num navegador novo, sem janela, que o
   login ficou gravado; só então devolve `INSTAGRAM_ENTROU`. Se não ficou, `INSTAGRAM_ENTRAR_FALHOU`.
   - **Serviço que passa dos 15 s é encerrado à força.** Um serviço de rede ou de armazenamento
     travado depois de o principal sair perde o que ainda não gravou; a conferência seguinte, num
     navegador novo, é que diz se o login ficou. Esperar mais não ajuda: ele segura o perfil e, no
     Windows, esconde o login do próximo navegador.
   - **Só se encerra processo que ainda é deste navegador.** A lista dos processos é guardada antes
     do fechamento, e o sistema reaproveita o número de um processo que saiu (no Windows, logo).
     Antes de encerrar, o estúdio pergunta a linha de comando de cada número (`ps` no Mac e no
     Linux, PowerShell no Windows) e só encerra quem ainda tem a pasta deste perfil nela. Se o
     sistema não responder, não encerra nada.
   - **Sem a lista, não conta como fechado por inteiro.** Se `SystemInfo.getProcessInfo` não
     responder, o estúdio não sabe quais serviços esperar nem quais encerrar: o fechamento conta como
     não calmo, e a conferência no navegador novo decide.
   - **Um orçamento só.** O assistente desiste de um comando em 10 minutos. `instagram entrar
     --confirmar` inteiro cabe em 9 min 30 s, contados desde o começo: conferir o login guardado
     (até ~1,5 min, com o fechamento), a janela (até 7 min), fechar (até 50 s) e conferir de novo
     (até 70 s). A janela fica aberta o que sobra do orçamento, até 7 minutos, depois de guardar 2
     minutos para fechar e conferir; o fechamento e a conferência usam só o que resta.
5. **Nada fica para trás.** Todo Chrome aberto com o perfil guardado fecha junto se o processo do
   estúdio acabar ou for interrompido. No Windows, a árvore inteira (`taskkill /T /F`). Se mesmo
   assim o perfil estiver em uso, a mensagem é `INSTAGRAM_LOGIN_EM_USO`: pode ser a janela de
   entrar ou uma leitura rodando escondida, sem janela na tela.

## Ler com o login

`./estudio ler` procura o perfil guardado. Se ele existe, não há pausa no dia e o cookie de sessão
vale, o Instagram é lido no Chrome do sistema, sem janela, com esse perfil (o Google e o site
continuam sem login, no navegador de sempre). Com login, são no máximo 40 publicações (`--posts`
maior vira 40).

- **Respostas da própria página.** Logada, a grade continua carregando ao rolar. O estúdio guarda as
  respostas em JSON que a página pede (`Network.getResponseBody`), acha cada publicação do perfil
  (`acharObjetos`) e tira legenda, data e a maior foto de cada parte (`melhorFoto`, o maior
  `width` entre os candidatos, em geral 1080 ou 1440). Só abre a página das publicações que não
  vieram nas respostas. Uma publicação que falha não derruba as outras.
- **Ritmo de gente.** Entre uma rolagem, ou uma página, e a próxima: de 2 a 4 segundos.
- **Espera a página, não o relógio.** Depois de cada rolagem, o estúdio espera a página terminar de
  pedir os dados (nenhum pedido em andamento e 0,6 s de silêncio, com teto de 20 s). Num computador ou
  numa internet lenta, a resposta demora, e só com a página quieta uma rolagem conta como "sem novidade"
  (três seguidas encerram a rolagem).
- **Prazo próprio.** 7 minutos para o Instagram: acabou, para, guarda o que leu e avisa com
  `LER_INSTAGRAM_PARCIAL`. Cabe nos 10 minutos do assistente, com o Google, o site e as fotos.
- **Para no primeiro sinal.** Depois de cada página, o estúdio olha o endereço. Verificação
  (`/challenge/`, `/checkpoint/`, `/auth_platform/`, `/accounts/suspended/`) ou volta para a página de
  entrar (`/accounts/login/`): para na hora, guarda o que já leu e devolve
  `LER_INSTAGRAM_PEDIU_VERIFICACAO` (`dados.motivo`: `verificacao` ou `login`). Nunca tenta de novo, e
  grava a pausa do dia: até o dia seguinte, o `ler` lê sem login e o `entrar` recusa.
- **Login que não abriu.** Pausa do dia, login vencido, perfil em uso ou Chrome que não abriu sem
  janela: a leitura segue sem login e avisa com `LER_INSTAGRAM_LOGIN_INDISPONIVEL` (`dados.motivo`:
  `pausado`, `vencido`, `em-uso`, `nao-abriu`).
- **Nenhum segredo na saída.** A saída do comando e os arquivos de `coleta/` nunca trazem cookie,
  token nem cabeçalho de pedido. O detalhe de erro sai sem o endereço local do DevTools e passa pelo
  `sanear`. O valor do cookie não sai da memória do processo: o estúdio só confere se ele existe e
  quando vence.

## Sair: `./estudio instagram sair`

Apaga o perfil inteiro e devolve `INSTAGRAM_SAIU` (`dados.tinha_login`). Muda antes o perfil antigo,
se ainda estiver em `.ferramentas/`, e apaga junto. Com atalho no caminho, recusa
(`INSTAGRAM_CAMINHO_ESTRANHO`). Com o perfil em uso, recusa (`INSTAGRAM_LOGIN_EM_USO`). Se o sistema
não deixar apagar tudo (Windows segurando um arquivo), espera e tenta de novo algumas vezes e, se ainda
sobrar, `INSTAGRAM_SAIR_FALHOU` ("feche o Chrome e tente de novo"). A pausa do dia não sai junto.
Para encerrar também do lado do Instagram, a pessoa remove a sessão em "Onde você está conectado".

## Reserva

Se a pessoa não quiser entrar, se não der certo, ou depois de uma verificação, a reserva continua a
extensão do Claude no Chrome: roda no Chrome da própria pessoa, que já está na conta dela, com licença
dela. Sem a extensão (ou no Codex), a pessoa manda as fotos e os textos em `referencias/`.

## Testes

- `kit/testes/instagram-login.test.mjs` (sem navegador): 40 publicações e a maior foto a partir de um
  JSON de exemplo, sessão pela lista de cookies, verificação e página de entrar pelo endereço, janela
  fechada pela lista de abas, lugar do login e mudança do perfil antigo, sair apaga o perfil, atalho
  no perfil ou acima dele é recusado, trava velha do Chrome não bloqueia e consultar não apaga nada,
  pausa do dia, limite de 40, prazo e publicação que falha, detalhe de erro sem endereço local,
  mensagens sem jargão.
- `kit/testes/instagram-login-navegador.test.mjs` (com navegador, contra páginas sintéticas): leitura
  logada com 40 publicações das respostas, sem abrir nenhuma página de publicação; parada na primeira
  verificação; login vencido; o login guardado sobrevive a fechar e abrir o navegador; o leitor de
  login de verdade vê a grade que só aparece com o cookie gravado no perfil.
  A janela visível só abre com `ESTUDIO_TESTAR_JANELA=1` e fora do CI.

## Prova ao vivo (falta)

Nenhum teste automático entra numa conta de verdade. Antes de anunciar o recurso, uma prova com uma
pessoa entrando na própria conta, no Mac e no Windows:

| # | Critério | Como medir |
|---|---|---|
| 1 | A janela abre com o perfil próprio, e a pessoa entra sozinha | rodar `instagram entrar --confirmar`, foto da janela |
| 2 | O estúdio percebe a entrada, fecha a janela e a leitura seguinte já usa o login | `ler` logo depois: `dados.instagram.com_login` = true |
| 3 | 40 publicações com legenda, data e foto de 1080 ou mais | `coleta/instagram/posts.json` |
| 4 | Nenhum pedido de verificação | o aviso `LER_INSTAGRAM_PEDIU_VERIFICACAO` não aparece; nada no celular além do "alguém entrou" |
| 5 | Nenhum segredo vaza | procurar o valor do cookie em `coleta/`, na saída e no zip: zero ocorrências |
| 6 | Sair apaga a sessão | depois de `instagram sair`, o `ler` volta a ser sem login |

Use contas de teste ou a conta de quem está fazendo a prova, com o consentimento dela.
