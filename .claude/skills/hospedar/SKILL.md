---
name: hospedar
description: Explica, passo a passo e em palavras simples, como a própria pessoa põe o site pronto no ar de graça em GitHub Pages, Netlify ou Cloudflare Pages, e como ligar um endereço próprio. O estúdio não se conecta a nenhum desses serviços, não pede senha e não publica nada: quem envia é a pessoa. Use quando a pessoa pedir "pôr o site no ar", "hospedar", "publicar", "ter um endereço", "atualizar o site que está no ar", ou na entrega da novo-site.
---

# Hospedar

O estúdio entrega a pasta `site/` e o pacote `.zip`. Pôr no ar é a pessoa quem faz, na conta dela. Você explica, um passo por mensagem, e espera ela dizer que fez. Você nunca entra na conta dela, nunca pede senha, código de verificação ou cartão, e nunca usa chave ou token de serviço nenhum.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## 1. Antes de explicar

1. Confirme que o site passou: `./estudio preflight <nome>` com `ok:true`. Vermelho não vai para o ar.
2. Rode `./estudio pacote <nome>` (código `PACOTE_PRONTO`). O `.zip` fica em `arquivos.zip` (`sites/<nome>/<nome>-site.zip`), com o `index.html` na raiz do pacote e o SHA-256 ao lado. Abra a pasta para a pessoa ver o arquivo.
   Se vier `PACOTE_ARQUIVO_PRIVADO`, há em `site/` algo que não vai para a internet: arquivo oculto, link, `.env`, chave, ou cópia de segurança e rascunho (nome terminado em `.old`, `.backup`, `.bak`, `.orig`, `.tmp`, `.swp` ou `~`; pasta `backup`, `backups`, `old`, `_old` ou `tmp`). Mostre a lista, pergunte e tire de `site/` antes de seguir. Só dois ocultos vão no zip, de propósito: o arquivo `.nojekyll` (o GitHub Pages precisa dele para não mexer no site) e a pasta `.well-known/` (verificação de domínio, `security.txt`).
3. Pergunte onde ela prefere, com no máximo 3 opções:
   - "Netlify: o mais simples, é arrastar o arquivo ★"
   - "Cloudflare Pages: também é arrastar, e é muito rápido"
   - "GitHub Pages: bom se você já usa o GitHub"

Os três têm plano grátis que serve para um site como este. As telas desses serviços mudam com o tempo: se um botão não tiver o nome daqui, diga o que procurar ("a opção de enviar ou subir arquivos") em vez de inventar um caminho.

## 2. Netlify

1. "Abra o endereço app.netlify.com/drop no navegador."
2. "Crie uma conta grátis (pode entrar com o e-mail ou com o Google). Sem conta, o site some depois de um tempo."
3. "Arraste para a área indicada a pasta `site` que eu abri para você. Se ele aceitar o arquivo `.zip`, pode ser o arquivo também."
4. "Espere terminar. Ele mostra um endereço terminado em `.netlify.app`. Abra e confira."
5. Opcional: "Em Configurações do site, dá para trocar o nome do endereço por um mais curto."

**Atualizar depois:** no painel do site, na parte de publicações (Deploys), arraste a pasta `site` nova. O endereço continua o mesmo.

## 3. Cloudflare Pages

1. "Abra dash.cloudflare.com e crie uma conta grátis."
2. "No menu, entre em Workers e Pages e escolha criar um projeto de Pages, na opção de enviar arquivos (Upload assets ou Direct Upload). Não escolha a opção de ligar ao Git."
3. "Dê um nome ao projeto: ele vira o endereço, terminado em `.pages.dev`."
4. "Envie o arquivo `.zip` ou a pasta `site`."
5. "Clique para publicar (Deploy) e abra o endereço que aparece."

**Atualizar depois:** no projeto, crie uma nova publicação (Create deployment) e envie o pacote novo.

## 4. GitHub Pages

1. "Abra github.com e crie uma conta grátis, se ainda não tiver."
2. "Crie um repositório novo (o botão New). Dê um nome curto, por exemplo o nome do negócio, e deixe como público. No plano grátis, o site só sai de repositório público."
3. "Na página do repositório, clique em enviar arquivos (uploading an existing file)."
4. "Abra a pasta `site` e arraste **o que está dentro dela** (o `index.html`, a pasta `assets` e as outras pastas), não a pasta `site` em si. O `index.html` precisa ficar na primeira tela do repositório." Se forem mais de 100 arquivos, arraste em mais de uma vez.
5. "Clique em confirmar (Commit changes)."
6. "Vá em Settings, depois em Pages. Em Source, escolha publicar a partir de um ramo (Deploy from a branch), escolha `main` e a pasta `/ (root)`, e salve."
7. "Em um ou dois minutos aparece o endereço, no formato `seu-usuario.github.io/nome-do-repositorio`. Abra e confira."

**Atualizar depois:** envie os arquivos novos do mesmo jeito, por cima dos antigos, e confirme.

## 5. Depois que estiver no ar

1. Peça o endereço e confira com a pessoa, no celular e no computador: a página inicial abre, as outras páginas abrem, as fotos aparecem, os botões de WhatsApp, telefone e e-mail funcionam.
2. **Imagem de compartilhamento.** A foto que aparece quando alguém manda o link no WhatsApp precisa do endereço completo. Com o endereço final em mãos, preencha `site.endereco` (completo, começando com `https://` e terminando em `/`) e `site.imagemSocial` (uma foto de `site/assets/`, de preferência 1200 por 630) em `sites/<nome>/_gerador/ordem.mjs`, rode `./estudio montar <nome>`, `./estudio preflight <nome>` e `./estudio pacote <nome>`, e peça para a pessoa enviar o pacote novo (o "Atualizar depois" do serviço dela).
3. Registre em `sites/<nome>/andamento.md`: onde está hospedado, o endereço e a data.

## 6. Endereço próprio (opcional)

Quando a pessoa quiser um endereço como `cafeaurora.com.br`:
1. Ela registra o domínio num registrador (no Brasil, `.br` é no registro.br). Isso é pago e é com ela; você não faz compra nenhuma.
2. No serviço onde o site está, há uma opção de domínio próprio (Custom domain, em Domain management, Custom domains ou Settings > Pages). Ela digita o domínio ali, e o serviço mostra quais registros de DNS criar.
3. Ela cria esses registros no painel do registrador, exatamente como o serviço mostrou. Você ajuda a ler a tela, se ela mandar uma foto, mas não inventa valores: os valores certos são os que o serviço mostrou para ela.
4. Pode levar de alguns minutos a algumas horas. O cadeado (HTTPS) costuma ser ligado pelo próprio serviço.
5. Depois, refaça o passo 5.2 com o endereço novo.

## Regras

- Nunca entre na conta da pessoa, nunca peça senha, código ou cartão, e nunca use chave de acesso de serviço nenhum.
- Nunca publique nada por conta própria, nem por ferramenta de navegador.
- Nunca suba o site com o `preflight` vermelho.
- Explique um passo por mensagem e espere a pessoa dizer que fez.
