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

## Entrar na conta: `./estudio instagram entrar`

1. **Aviso antes.** Sem `--confirmar`, o comando não abre nada: devolve `INSTAGRAM_ANTES_DE_ENTRAR`
   (ou `INSTAGRAM_JA_ENTROU`, se o login guardado ainda vale). O texto avisa que o Instagram pode
   mandar "alguém entrou na sua conta", que é o estúdio, pela janela que a pessoa abriu, e que a
   senha fica só com o Instagram. O assistente diz o texto e espera o sim.
2. **Janela normal, perfil próprio.** Com `--confirmar`, o estúdio abre o Chrome (ou o Edge)
   instalado no computador, **com janela**, numa pasta de perfil só dele:
   `.ferramentas/instagram/perfil/`. Não é o Chrome da pessoa e não usa os cookies dele.
   A pasta está no `.gitignore` (como toda a `.ferramentas/`), o `atualizar` não toca nela e o
   `pacote` nunca a lê.
3. **A pessoa entra sozinha.** O estúdio nunca vê, digita nem guarda a senha. Pelo protocolo de
   depuração do navegador (`Storage.getCookies`), ele só olha, a cada segundo, se o cookie
   `sessionid` do Instagram apareceu. Nenhuma página é lida para isso.
4. **Percebe, fecha e avisa.** Com a sessão, espera 3 segundos, fecha a janela pedindo ao navegador
   (`Browser.close`, que grava os cookies no disco) e devolve `INSTAGRAM_ENTROU`.
   Janela fechada pela pessoa: `INSTAGRAM_JANELA_FECHADA`. Sem entrar em 9 minutos:
   `INSTAGRAM_PRAZO_ACABOU` (9, e não 10, para a janela fechar antes de o assistente desistir).
   Sem Chrome nem Edge instalado: `INSTAGRAM_SEM_CHROME`.

**Chave dos cookies.** O perfil guardado abre com `--use-mock-keychain` no Mac e
`--password-store=basic` no Linux, na janela e na leitura sem janela. No Mac, a janela e o modo sem
janela usam chaves diferentes, e o login de um não valeria no outro; o chaveiro do sistema também
pediria a senha do computador. O preço: o cookie fica protegido só pela pasta do usuário (o perfil
é criado com permissão só do dono). Por isso o login nunca sai de `.ferramentas/instagram/`.

## Ler com o login

`./estudio ler` procura o perfil guardado. Se ele existe e tem o cookie de sessão válido, o Instagram
é lido no Chrome do sistema, sem janela, com esse perfil (o Google e o site continuam sem login, no
navegador de sempre). O padrão passa de 24 para 40 publicações.

- **Respostas da própria página.** Logada, a grade continua carregando ao rolar. O estúdio guarda as
  respostas em JSON que a página pede (`Network.getResponseBody`), acha cada publicação do perfil
  (`acharObjetos`) e tira legenda, data e a maior foto de cada parte (`melhorFoto`, o maior
  `width` entre os candidatos, em geral 1080 ou 1440). Só abre a página das publicações que não
  vieram nas respostas.
- **Ritmo de gente.** Entre uma rolagem, ou uma página, e a próxima: de 2 a 4 segundos.
- **Para no primeiro sinal.** Depois de cada página, o estúdio olha o endereço. Verificação
  (`/challenge/`, `/checkpoint/`, `/auth_platform/`, `/accounts/suspended/`) ou volta para a página de
  entrar (`/accounts/login/`): para na hora, guarda o que já leu e devolve
  `LER_INSTAGRAM_PEDIU_VERIFICACAO` (`dados.motivo`: `verificacao` ou `login`). Nunca tenta de novo.
  O assistente não usa o login de novo no mesmo dia: o próximo `ler` vai com `--sem-login`.
- **Login que não abriu.** Login vencido, janela de entrar ainda aberta ou Chrome que não abriu sem
  janela: a leitura segue sem login e avisa com `LER_INSTAGRAM_LOGIN_INDISPONIVEL`.
- **Nenhum segredo na saída.** A saída do comando e os arquivos de `coleta/` nunca trazem cookie,
  token nem cabeçalho de pedido. O valor do cookie nem é lido: só se ele existe e quando vence.

## Sair: `./estudio instagram sair`

Apaga `.ferramentas/instagram/perfil/` inteira e devolve `INSTAGRAM_SAIU` (`dados.tinha_login`).
Com um atalho no lugar da pasta, apaga só o atalho. Com a janela ainda aberta, recusa
(`INSTAGRAM_JANELA_AINDA_ABERTA`). Desinstalar o estúdio apaga toda a `.ferramentas/`, e o login junto.
Para encerrar também do lado do Instagram, a pessoa remove a sessão em "Onde você está conectado".

## Reserva

Se a pessoa não quiser entrar, se não der certo, ou depois de uma verificação, a reserva continua a
extensão do Claude no Chrome: roda no Chrome da própria pessoa, que já está na conta dela, com licença
dela. Sem a extensão (ou no Codex), a pessoa manda as fotos e os textos em `referencias/`.

## Testes

- `kit/testes/instagram-login.test.mjs` (sem navegador): 40 publicações e a maior foto a partir de um
  JSON de exemplo, sessão pela lista de cookies, verificação e página de entrar pelo endereço, janela
  fechada pela lista de abas, sair apaga o perfil (e só o atalho, quando é atalho), trava velha do
  Chrome não bloqueia, mensagens sem jargão.
- `kit/testes/instagram-login-navegador.test.mjs` (com navegador, contra páginas sintéticas): leitura
  logada com 40 publicações das respostas, sem abrir nenhuma página de publicação; parada na primeira
  verificação; login vencido; o login guardado sobrevive a fechar e abrir o navegador.
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
