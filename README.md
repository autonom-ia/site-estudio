# Site Estúdio

> **Assistente (Claude Code ou Codex): se você chegou aqui porque alguém pediu para instalar,** leia o `AGENTS.md` inteiro e siga a skill `instalar-estudio` (em `.agents/skills/instalar-estudio/SKILL.md`). A instalação é uma entrada só, numa caixinha de licença: `bash instalar/instalar.sh tudo --agente <claude|codex>` (no Windows, `instalar/instalar.ps1 tudo`), rodada com o tempo máximo da ferramenta (no Claude Code, `timeout: 600000`) ou em segundo plano: com internet lenta ela passa dos 2 minutos padrão. Antes dela, diga o I-01, que já explica a caixinha. Nenhuma pergunta técnica.

Sites de primeira linha, feitos por conversa, no seu computador.

Você conta para o assistente (Claude Code ou Codex) o que é o seu negócio e o que a pessoa precisa fazer quando abre o site. Ele junta os fatos com a fonte, estuda sites de referência, define a ideia visual, mostra o começo do site para você aprovar, faz o resto, confere tudo e entrega a pasta do site e um arquivo pronto para hospedar.

- **Grátis e local.** Nada sobe para a internet sem você pedir, nada é pago, não precisa de conta para fazer o site. O site fica numa pasta do seu computador. Para pôr no ar, você escolhe: num endereço da Autonom.ia (com convite) ou onde preferir, e o assistente mostra o passo a passo.
- **Feito para ser lembrado.** Tipografia com personalidade, foto de verdade, luz e movimento que conduz o olhar. Nada de site de molde com cartõezinhos.
- **Celular e computador.** Cada página é medida e fotografada em quatro tamanhos de tela: celular, tablet, notebook e tela grande.
- **Conferência de verdade.** Antes de entregar, o estúdio mede cada página no navegador (texto vazando, contraste fraco, botão pequeno no celular, link quebrado, número sem fonte), roda as regras de acessibilidade e quatro revisores independentes dão nota: direção de arte, direção geral, fatos e qualidade.
- **Com a sua marca.** Cores, letras e logo ficam guardados uma vez e valem para todos os sites.
- **Mac; Windows em teste.** No Mac o estúdio roda de ponta a ponta. No Windows o instalador e os comandos existem, mas ainda não passaram na conferência numa máquina limpa: até lá, trate como versão de teste.

<!-- porta-de-entrada: texto para quem nunca usou o Claude. Sem palavra técnica (o teste confere). -->
## Comece aqui

Você vai conversar com um assistente, do mesmo jeito que conversa no WhatsApp. Ele faz o site. Você só responde e aprova.

1. **Baixe o app do Claude** no site **claude.ai/download** e entre com a sua conta. (Já usa o Codex? Pode ser ele também.)
2. **Abra o app e entre na parte Code.** Quando ele pedir um lugar para trabalhar, escolha o que tem o seu nome (no Mac, ao lado do desenho de uma casinha). Não escolha a Mesa nem Documentos.
3. **Copie o texto do quadro abaixo, cole na conversa e aperte Enter.**
4. **Aprove as caixinhas.** O app pede licença antes de mexer no computador. Costumam ser três: uma para baixar o estúdio, uma para instalar e uma para confiar nele quando você abrir de novo. É só clicar em aprovar.
5. **Espere uns 3 minutos.** Quando aparecer *Tudo pronto*, faça o que ele mostrar para abrir o estúdio e escreva: **quero fazer um site**.

```
instale: https://github.com/autonom-ia/site-estudio/releases/latest/download/site-estudio.zip
```

Daí em diante, ele faz só duas perguntas: o que é o seu negócio e onde ele aparece hoje (Instagram, site ou o nome no Google). Gosto, cores e sites de que você gosta são opcionais: se preferir, diga "pode decidir por mim". Você vê o começo do site no celular e no computador, lado a lado, aprova, e ele faz o resto.

Se o app não conseguir baixar pelo link, veja [outros jeitos de instalar](instalar/comandos-unicos.md).
<!-- /porta-de-entrada -->

## Como usar

Escreva do seu jeito. Por exemplo:

- "Quero um site para a Oficina Raio, de conserto de bicicletas. A ideia é a pessoa ver os preços e chamar no WhatsApp para agendar."
- "A Clínica Horizonte já tem site, mas está velho. Quero refazer, com uma página para cada especialidade."
- "Ajusta a minha marca: as cores estão no logo que coloquei na pasta referencias."
- "Dá uma nota para o meu site."
- "Como eu ponho o site no ar?"

O caminho é sempre o mesmo:

1. **Conversa rápida**: duas perguntas, o que é o negócio e onde ele aparece hoje. O resto o assistente lê e propõe.
2. **Brief**: o objetivo, a ação principal e o mapa das páginas. Você aprova.
3. **Referências**: sites reais do mesmo tipo, estudados pelo que fazem bem (para aprender, nunca para copiar).
4. **Direção**: a ideia visual em uma frase, as letras, as fotos, as cores e o movimento.
5. **Piloto**: o topo da página inicial, uma parte comum e o momento mais forte, no celular e no computador lado a lado. Você aprova o visual.
6. **O resto do site**, no mesmo visual.
7. **Conferência** automática e fotos de cada página em quatro tamanhos, lidas uma a uma.
8. **Revisão** por quatro revisores independentes, até nota 8,5.
9. **Entrega**: a pasta do site, o arquivo para hospedar e o passo a passo para pôr no ar (GitHub Pages, Netlify ou Cloudflare Pages).

## Publicar num endereço da Autonom.ia

Quem tem acesso publica o site num endereço próprio, como `seunegocio.sites.autonomia.site`, com cadeado de site seguro e sem pagar nada. O acesso é por convite:

1. Entre em **[sites.autonomia.site](https://sites.autonomia.site)** e clique em **Entrar com o Google**.
2. Se o seu e-mail ainda não estiver liberado, aparece *Acesso só por convite*. Escreva o seu nome, conte em uma frase o que quer publicar e clique em **Pedir acesso**.
3. A resposta chega por e-mail. Aprovado, é só voltar ao assistente.

Recebeu um link de convite? Abra o link, entre com o Google e o acesso já fica liberado.

A publicação pelo assistente (você pede **"publique meu site"** e o link aparece na conversa) está chegando. Quem já tiver acesso recebe um e-mail quando estiver pronta.

## As suas pastas

| Pasta | O que vai nela |
|---|---|
| `minha-marca/` | Cores, letras, logo e o jeito de falar da sua marca |
| `sites/` | Uma pasta por site, com o site pronto e o arquivo para hospedar |
| `referencias/` | Fotos, documentos, números e endereços de sites de que você gosta |

Essas pastas são suas: a atualização do estúdio nunca mexe nelas.

## Atualizar e desinstalar

- Para atualizar, peça: "atualizar o estúdio". Ele baixa a versão nova só deste repositório, confere o arquivo e guarda a anterior.
- Para desinstalar, peça: "desinstalar o estúdio". Ele apaga só os programas; as suas pastas ficam.

## Para quem quer mexer no estúdio

- Comandos: `./estudio <comando>` (no Windows, `.\estudio.cmd`). Por site: `novo`, `ler`, `montar`, `checar`, `prints`, `medir`, `acessibilidade`, `desempenho`, `fatos`, `preflight`, `abrir`, `antes`, `comparar`, `escolher`, `pacote`, `publicar`. Do estúdio: `verificar`, `espelhar`, `versao`, `atualizar`. A última linha de cada comando é um JSON numa linha só: `{"ok","comando","codigo","resumo","arquivos","avisos","dados"}`. Saída 0 é ok, 1 é erro, 2 é reprovado na conferência.
- Testes: `npm test` (Node 22 ou mais novo). Os testes que precisam de navegador são pulados quando não há Chrome.
- Instruções do assistente: a fonte é o `AGENTS.md` e `.claude/skills/`. O `CLAUDE.md` e `.agents/skills/` são gerados por `./estudio espelhar`; `./estudio espelhar --conferir` reprova se estiverem diferentes.
- Regras do código: Node sem dependência em tempo de execução, versões fixas em `instalar/versoes.env`, sem expressão regular, página lida pelo próprio navegador (DOM via protocolo de depuração do Chrome), nunca como texto.

## Licença

MIT, © 2026 Autonom.ia. Veja [`LICENSE`](LICENSE) e as peças de terceiros em [`CREDITOS.md`](CREDITOS.md).

A casca deste estúdio (instalador, despachante de comandos, contrato de saída, mensagens e testes de máquina limpa) veio do [Estúdio de Reels](https://github.com/autonom-ia/video-edit-autonomia), também MIT, da Autonom.ia.
