# Comandos únicos de instalação

A pessoa cola **um** destes textos no Claude Code ou no Codex (no app ou no Terminal), aberto na pasta pessoal. O texto é o mesmo no Mac e no Windows: o assistente descobre o sistema sozinho (e, no Windows, se está no PowerShell ou no Git Bash), baixa o estúdio e segue o `AGENTS.md`, que manda começar pela instalação.

Endereço do estúdio no GitHub: conta **autonom-ia**, repositório **site-estudio**: <https://github.com/autonom-ia/site-estudio>.

A pasta na máquina da pessoa se chama `site-estudio`, dentro da pasta pessoal. O zip anexado ao release (`site-estudio.zip`) já vem com uma única pasta chamada `site-estudio`.

---

## V1: o link (padrão)

```
instale: https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip
```

O link `releases/latest/download/site-estudio.zip` sempre entrega a versão mais nova. Tudo o que um texto longo diria (aprovar as caixinhas, descobrir o sistema, falar simples, pedir licença) está dentro do estúdio: no aviso do topo do `README.md`, no `AGENTS.md` e na skill `instalar-estudio`. Se o assistente descompactar em outro lugar (Downloads, por exemplo), a skill muda a pasta para o lugar certo antes de instalar.

### V1 longa (reserva)

Use se algum assistente baixar o arquivo e não seguir as instruções de dentro.

```
Quero instalar o Site Estúdio no meu computador.

0. Antes de rodar qualquer coisa, me diga em uma frase como aprovar as caixinhas de licença que vão aparecer: no app, o botão de aprovar; no Terminal, a opção 1, que começa com Yes.
1. Descubra se este computador é Mac ou Windows, e se você está rodando no PowerShell ou no Git Bash.
2. Se já existir a pasta "site-estudio" na minha pasta pessoal, não apague nada e pule para o passo 4.
3. Baixe e descompacte o estúdio na minha pasta pessoal:
   - Mac (Terminal):
     cd ~ && curl -fL -o site-estudio.zip "https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip" && ditto -x -k site-estudio.zip . && rm site-estudio.zip
   - Windows (PowerShell):
     $ProgressPreference="SilentlyContinue"; cd $HOME; curl.exe -fL -o site-estudio.zip "https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip"; tar.exe -xf site-estudio.zip; Remove-Item site-estudio.zip
   - Windows (Git Bash):
     cd ~ && curl -fL -o site-estudio.zip "https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip" && /c/Windows/System32/tar.exe -xf site-estudio.zip && rm site-estudio.zip
4. Leia o arquivo site-estudio/AGENTS.md inteiro e siga o que ele manda, começando pela instalação.

Fale comigo em português simples, um passo por vez. Antes de instalar qualquer coisa, me explique o que é e me peça licença.
```

---

## V2: zip baixado pelo navegador

Igual à V1 longa, trocando o passo 3 por este:

```
3. Eu baixei o arquivo site-estudio.zip, que está na minha pasta Downloads. Descompacte esse arquivo na minha pasta pessoal e tire a marca de "baixado da internet":
   - Mac: ditto -x -k ~/Downloads/site-estudio.zip ~ && xattr -dr com.apple.quarantine ~/site-estudio && chmod 755 ~/site-estudio/estudio ~/site-estudio/instalar/*.sh
   - Windows (PowerShell): cd $HOME; tar.exe -xf "$HOME\Downloads\site-estudio.zip"; Get-ChildItem -Recurse site-estudio | Unblock-File
   - Windows (Git Bash): rode a linha do PowerShell assim: powershell.exe -NoProfile -Command '<a linha do PowerShell acima>'
```

---

## Publicar uma versão (para quem mantém o estúdio)

1. Troque a versão nos **6 lugares**, todos com o mesmo número (o teste `a versão mora em 6 lugares` de `kit/testes/codigos-e-regras.test.mjs` reprova se um ficar para trás):
   - `VERSAO`;
   - `package.json` (`"version"`);
   - `package-lock.json`, linha 3 (`"version"` do topo) e linha 9 (`"version"` dentro de `packages.""`);
   - `instalar/instalar.sh` (`VERSAO_ESTUDIO="..."`);
   - `instalar/instalar.ps1` (`$script:VersaoEstudio = '...'`).
2. Rode `npm test` e leia a linha `ℹ fail 0` (não a contagem). Rode `./estudio espelhar --conferir` e leia `"ok":true`. Rode `bash -n` e `shellcheck` nos `.sh`.
3. Faça o commit, crie a tag (`git tag v1.0.1`) e gere o zip **da tag**, não do que está solto na pasta (o `git archive` aplica o `.gitattributes`: CRLF nos `.cmd`/`.ps1`, LF nos `.sh`):
   ```
   git archive --format=zip --prefix=site-estudio/ -o site-estudio.zip v1.0.1
   shasum -a 256 site-estudio.zip > site-estudio.zip.sha256
   ```
   O zip tem uma única pasta `site-estudio` dentro.
4. Publique o release `v1.0.1` no GitHub `autonom-ia/site-estudio` com os dois anexos: `site-estudio.zip` e `site-estudio.zip.sha256`.
5. O `./estudio atualizar` da pessoa baixa `releases/latest/download/site-estudio.zip` (ver `ESTUDIO_ATUALIZAR_URL` em `instalar/versoes.env`), confere pelo `.sha256` e só aceita endereço `https://github.com/autonom-ia/site-estudio/releases/...` (sem `%`, sem usuário, sem porta), seguindo redirecionamento só para os servidores de arquivo do GitHub. O zip automático da tag não serve para o `atualizar`: precisa do anexo.

---

## O que acontece depois do comando

1. O assistente baixa e descompacta o estúdio na pasta pessoal, num comando só.
2. Lê o `AGENTS.md`, diz o I-01 (o que vai fazer, sem pergunta) e roda a entrada única: `bash instalar/instalar.sh tudo --agente <claude|codex>` (no Windows, `instalar.ps1 tudo`). Ela olha o computador (`checar`), instala Node, peças do estúdio e navegador escondido (`passo` de cada um, com uma segunda chance automática quando a falha é passageira) e confere (`verificar`). Se o estúdio caiu dentro do OneDrive ou do iCloud, ou se o nome do usuário do Windows tem acento, o `tudo` para em `checar` e o assistente muda a pasta de lugar (`mudar-pasta`) antes de rodar de novo.
3. Diz "Tudo pronto" (I-14) e mostra como abrir o programa direto no estúdio. A marca não é perguntada agora: ela nasce junto com o primeiro site.

Os textos de cada momento estão em `instalar/mensagens.json`. Um por um (`checar`, `plano`, `passo <id>`, `verificar`) continua existindo, para quem pedir para aprovar cada programa.

## Caixinhas de licença (meta: no máximo 3)

Do link colado até "Tudo pronto", e depois no primeiro site:

| # | Quando | O que a caixinha libera |
|---|---|---|
| 1 | Logo depois de colar o link | Baixar e descompactar o estúdio (um comando só) |
| 2 | Depois do I-01 | A entrada única `instalar.sh tudo` (ou `instalar.ps1 tudo`) |
| 3 | Ao abrir o programa direto no estúdio (I-14) | Confiar no estúdio (o Terminal pergunta; o app pode não perguntar) |

Dentro do estúdio, `.claude/settings.json` já libera, sem caixinha: `./estudio` (e `estudio.cmd`), as ações `tudo`, `checar`, `plano`, `passo` e `verificar` do instalador, a busca e a leitura de páginas da internet (`WebSearch`, `WebFetch`, para ler o Instagram e as referências) e a escrita em `sites/`, `minha-marca/` e `referencias/`. Ficam de fora de propósito, e pedem caixinha: `mudar-pasta`, `desinstalar` e qualquer comando que não seja do estúdio.

Medido em 23/11/2026 num Mac com chip Apple, numa cópia limpa: `tudo` levou 19,5 s do começo ao "Tudo pronto: 6 de 6" e 2 s ao rodar de novo (tudo já pronto). No Codex não há lista de liberação por projeto: cada comando do instalador pede para sair da área protegida (textos `CODEX-INTERNET` e `CODEX-FORA-DA-AREA`).

Como medir de novo, numa conta nova e numa máquina sem o estúdio: abra o app, cole o texto da V1, conte cada caixinha até "Tudo pronto" e anote aqui. Toda caixinha a mais vira Issue.
