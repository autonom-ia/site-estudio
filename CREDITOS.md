# Créditos

O Site Estúdio é MIT, © 2026 Autonom.ia (veja `LICENSE`).
Ele usa peças de outras pessoas. Cada uma segue a própria licença.

- **Versionado**: o arquivo está dentro deste repositório.
- **Baixado**: o arquivo não está aqui. Ele é baixado no computador da pessoa, na instalação, e só com a licença dela.

## Peças versionadas

| Peça | O que faz aqui | Licença | Origem |
|---|---|---|---|
| Estúdio de Reels | A casca do estúdio: instalador (Mac e Windows), ambiente, ponto de entrada `estudio`, despachante de comandos, contrato de saída em JSON, textos de instalação, permissões e o teste de máquina limpa. Copiados e adaptados (sem Python, sem modelos, sem expressão regular) | MIT, © 2026 Autonom.ia | https://github.com/autonom-ia/video-edit-autonomia |
| GSAP 3.13.0 (com ScrollTrigger) | Movimento das páginas, copiado para `site/assets/vendor/gsap/` de cada site | GSAP Standard "no charge" License | https://gsap.com/standard-license |
| Lenis 1.3.11 | Rolagem suave, copiada para `site/assets/vendor/lenis/` de cada site, sem modificação, com o texto da licença ao lado (`LICENSE`) | MIT, © darkroom.engineering | https://github.com/darkroomengineering/lenis |
| axe-core 4.14.0 | Regras de acessibilidade (WCAG) que o comando `acessibilidade` roda dentro de cada página, em `kit/vendor/axe/`. Arquivo sem modificação; o texto da licença está em `kit/vendor/axe/LICENSE` | MPL-2.0, © Deque Systems | https://github.com/dequelabs/axe-core |
| Big Shoulders Display | Fonte de título da marca de exemplo (`kit/marca-exemplo/fontes/`), só o alfabeto latino, em `.woff2` (baixada pelo comando `fonte`) | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/bigshouldersdisplay (texto em `kit/marca-exemplo/fontes/OFL-BigShouldersDisplay.txt`) |
| Familjen Grotesk | Fonte de texto da marca de exemplo (`kit/marca-exemplo/fontes/`), só o alfabeto latino, em `.woff2` (baixada pelo comando `fonte`) | SIL OFL 1.1 | https://github.com/google/fonts/tree/main/ofl/familjengrotesk (texto em `kit/marca-exemplo/fontes/OFL-FamiljenGrotesk.txt`) |

O axe-core foi copiado sem modificação. As fontes são as versões recortadas que o Google Fonts serve (só o alfabeto latino), sem outra mudança. Quem mudar o `axe.min.js` precisa publicar o arquivo mudado sob a MPL-2.0, como a licença pede; o resto do estúdio continua MIT.

## Peças baixadas no computador da pessoa

| Peça | Versão | O que faz aqui | Licença | Quem baixa |
|---|---|---|---|---|
| Node.js | `NODE_VERSAO` em `instalar/versoes.env` | Roda os comandos do estúdio | MIT | instalador, passo `node` (conferido por SHA256) |
| @puppeteer/browsers | `devDependencies` do `package.json` (árvore fixa no `package-lock.json`; igual a `PUPPETEER_BROWSERS_VERSAO` em `instalar/versoes.env`) | Baixa o navegador escondido na versão fixa | Apache 2.0 | instalador, passos `pacotes` e `navegador` |
| chrome-headless-shell (Chrome for Testing) | `CHROME_HEADLESS_SHELL_VERSAO` em `instalar/versoes.env` | Navegador escondido: mede as páginas, roda a conferência de acessibilidade e tira as fotos | licenças do Chromium (BSD-3 e outras) | instalador, passo `navegador` |
| Letras do Google Fonts que a pessoa escolhe | a do dia, em `.woff2` recortado | As letras da marca da pessoa, em `minha-marca/fontes/`, cada uma com a licença ao lado (`OFL-<Família>.txt`) | a da família (SIL OFL 1.1, Apache 2.0 ou UFL), baixada do repositório oficial `github.com/google/fonts` | comando `fonte`, a pedido da pessoa |

## O que nunca entra

- Foto, vídeo, música ou fonte de terceiros sem licença dentro do repositório.
- Material de cliente, dado pessoal ou conteúdo de sites reais: os exemplos usam negócios fictícios (Oficina Raio, Clínica Horizonte).
- Serviço pago, conta ou envio de arquivos para a internet.
