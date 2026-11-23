---
name: atualizar-estudio
description: Atualiza o Site Estúdio para a versão mais nova publicada pela Autonom.ia no GitHub, só quando a versão subiu, conferida por SHA256, sem tocar nas pastas da pessoa (minha-marca, sites, referencias) e com volta automática se algo falhar; depois confere os programas e refaz o que mudou. Use quando a pessoa pedir "atualizar o estúdio", "tem versão nova?", ou quando a skill instalar-estudio achar um estúdio mais antigo.
---

# Atualizar o estúdio

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`. No Codex, o `atualizar` precisa de internet (texto `CODEX-INTERNET` de `instalar/mensagens.json`).

## Passo a passo

1. `./estudio versao`: guarde a versão atual (em `dados`).
2. Diga: "Vou procurar uma versão nova do estúdio. Os seus sites, a sua marca e as referências ficam como estão. Posso?" com "Pode ★" e "Agora não". Em "Agora não", diga que é só pedir "atualizar o estúdio" quando quiser.
3. Com o OK, rode `./estudio atualizar`, sem endereço. Ele baixa a versão mais nova do endereço oficial (`github.com/autonom-ia/site-estudio`), confere o SHA256, só troca se a versão subiu, guarda a anterior e volta tudo se a troca falhar no meio.
4. Leia a última linha e o `codigo` em `kit/mensagens.json`:
   - `JA_ATUALIZADO`: já está na versão mais nova. Diga isso em uma frase e pare.
   - `ESTUDIO_ATUALIZADO`: `dados.de` e `dados.para` dizem as versões; a anterior ficou guardada em `dados.copia_anterior`. As skills que a pessoa pôs em `.claude/skills` ou `.agents/skills` (as dela e as que outro programa instalou, como as do hyperframes) continuam lá: a versão nova troca só as skills do estúdio (`dados.skills_mantidas` lista as que ficaram). Arquivo de topo que a versão nova não tem mais foi guardado na cópia anterior (`dados.guardados_na_copia`). Leia de novo o `AGENTS.md` inteiro, porque as regras podem ter mudado. Com o aviso `DEPENDENCIAS_MUDARAM` (pacotes, Node ou navegador mudaram), rode o instalador de novo como na skill `instalar-estudio`: ele pula o que já está pronto e refaz só o que mudou. Siga para o passo 5.
   - `ATUALIZACAO_FALHOU`: a troca falhou e tudo voltou como estava. Diga que nada mudou e ofereça tentar de novo mais tarde.
   - `ATUALIZACAO_INCOMPLETA`: alguns arquivos não voltaram sozinhos; a cópia está em `dados.copia_anterior`. Chame a skill `consertar`.
   - `ATUALIZACAO_EM_ANDAMENTO`: outra atualização do estúdio está rodando agora. Espere terminar e rode `./estudio versao`; não apague `.ferramentas/atualizando.trava` (ela sai sozinha).
   - Outro `ok:false` (download, arquivo diferente, endereço estranho): diga o texto do código. Nunca tente consertar arquivos do estúdio à mão.
5. Confira os programas com a verificação do instalador:
   - Mac: `bash instalar/verificar.sh`
   - Windows: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File instalar/verificar.ps1`
   Item com `ok:false` (por exemplo, `navegador` quando mudou a versão dele): rode `passo <passo>` do instalador para cada um, como na skill `instalar-estudio`, e verifique de novo.
6. `./estudio espelhar --conferir`: precisa de `ok:true`. Se reprovar, rode `./estudio espelhar` e confira de novo.
7. Diga em uma frase de qual versão para qual foi, e o que muda para a pessoa, se a versão nova trouxer novidade visível.

## Sites antigos depois de atualizar

O molde novo vale para sites novos. Os que já existem continuam com os arquivos deles (`site/assets/vendor/` e `_gerador/`) e funcionam como antes. Se a pessoa quiser um site antigo com as conferências novas, basta rodar `./estudio preflight <nome>`: as conferências são do estúdio, não do site. Trocar o motor de movimento de um site antigo é uma mudança: copie o `vendor/` do molde novo por cima do `site/assets/vendor/` dele, monte, rode `preflight` e `prints`, e leia as fotos antes de dizer que está pronto.

## Regras

- Só atualiza do endereço oficial. Nunca baixe o estúdio de outro lugar.
- Nunca apague `minha-marca/`, `sites/` nem `referencias/`.
- Skill própria da pessoa em `.claude/skills` ou `.agents/skills` fica onde está; não a apague nem a substitua.
- Nunca edite o `kit/`, o `instalar/` ou as instruções para "fazer funcionar" depois de atualizar: use a skill `consertar`.
