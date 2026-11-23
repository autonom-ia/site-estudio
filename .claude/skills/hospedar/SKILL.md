---
name: hospedar
description: Põe o site pronto no ar. Quem tem acesso publica em sites.autonomia.site pelo próprio estúdio, só com a confirmação da pessoa (e volta para uma versão anterior, se ela pedir). Fora disso, explica passo a passo e em palavras simples como a própria pessoa põe o site no ar de graça em GitHub Pages, Netlify ou Cloudflare Pages, e como ligar um endereço próprio; nesses serviços o estúdio não se conecta, não pede senha e não publica nada. Use quando a pessoa pedir "pôr o site no ar", "hospedar", "publicar", "ter um endereço", "atualizar o site que está no ar", ou na entrega da novo-site.
---

# Hospedar

O estúdio entrega a pasta `site/` e o pacote `.zip`. Há dois caminhos para pôr no ar:

- **sites.autonomia.site**: o estúdio publica, mas só com a confirmação da pessoa, a cada vez. O endereço fica `<nome>.sites.autonomia.site`, com cadeado de site seguro. Precisa de acesso, que a pessoa pede em sites.autonomia.site (seção 2).
- **GitHub Pages, Netlify ou Cloudflare Pages**: quem envia é a pessoa, na conta dela. Você explica, um passo por mensagem, e espera ela dizer que fez. Você nunca entra na conta dela, nunca pede senha, código de verificação ou cartão, e nunca usa chave ou token desses serviços.

Comandos: `./estudio <comando>` (no PowerShell, `.\estudio.cmd <comando>`). Leia só a última linha (JSON) e traduza o `codigo` por `kit/mensagens.json`.

## 1. Antes de explicar

1. Confirme que o site passou: `./estudio preflight <nome>` com `ok:true`. Vermelho não vai para o ar.
2. Rode `./estudio pacote <nome>` (código `PACOTE_PRONTO`). O `.zip` fica em `arquivos.zip` (`sites/<nome>/<nome>-site.zip`), com o `index.html` na raiz do pacote e o SHA-256 ao lado. Abra a pasta para a pessoa ver o arquivo.
   Se vier `PACOTE_ARQUIVO_PRIVADO`, há em `site/` algo que não vai para a internet: arquivo oculto, link, `.env`, chave, ou cópia de segurança e rascunho (nome terminado em `.old`, `.backup`, `.bak`, `.orig`, `.tmp`, `.swp` ou `~`; pasta `backup`, `backups`, `old`, `_old` ou `tmp`). Mostre a lista, pergunte e tire de `site/` antes de seguir. Só dois ocultos vão no zip, de propósito: o arquivo `.nojekyll` (o GitHub Pages precisa dele para não mexer no site) e a pasta `.well-known/` (verificação de domínio, `security.txt`).
3. Pergunte onde ela prefere, com no máximo 3 opções:
   - "Num endereço de sites.autonomia.site: eu publico daqui, só com a sua confirmação ★"
   - "Netlify: é arrastar o arquivo, na sua conta"
   - "Cloudflare Pages ou GitHub Pages: também na sua conta"

Os três têm plano grátis que serve para um site como este. As telas desses serviços mudam com o tempo: se um botão não tiver o nome daqui, diga o que procurar ("a opção de enviar ou subir arquivos") em vez de inventar um caminho.

## 2. Publicar em sites.autonomia.site

Diga, com estas palavras ou parecidas: "Eu publico só com a sua confirmação, em sites.autonomia.site. Se você ainda não tem acesso, peça em sites.autonomia.site." Pergunte "Posso publicar o site {{nome}} agora?" com "Pode publicar ★" e "Ainda não". Só siga com o sim dela; cada publicação nova pede um sim novo.

1. Rode `./estudio publicar <nome>`. No Codex, fora da área protegida (ele usa a internet). Pode levar até uns 3 minutos.
2. `PUBLICAR_AGUARDANDO_LOGIN`: é a primeira vez neste computador (ou o acesso dele venceu). Mostre `dados.codigo_curto` bem visível e diga: "Abri a página de autorização no navegador (`dados.endereco`). Entre com o Google, digite o código e clique em Autorizar. Me avise quando fizer." O navegador mostra o nome do computador, a hora e o lugar de quem pediu: só autorize se foi ela que acabou de pedir. Quando ela avisar, rode o mesmo `./estudio publicar <nome>` de novo; ele continua o mesmo pedido. Se de novo vier `PUBLICAR_AGUARDANDO_LOGIN`, pergunte se ela já digitou o código e repita.
3. `PUBLICADO`: diga o endereço (`dados.endereco`) e confira com ela (seção 6). `PUBLICADO_CERTIFICADO_PENDENTE`: o site subiu, mas o cadeado leva alguns minutos; peça para abrir daqui a pouco e não publique de novo só por isso.
4. Qualquer outro código: diga o `texto` de `kit/mensagens.json` e faça a `acao`. Nenhum erro deixa o site no ar pela metade.

**Atualizar depois:** depois de mudar o site (montar, conferir e `preflight` aprovado), pergunte de novo e rode `./estudio publicar <nome>`. Cada publicação vira uma versão nova; as anteriores ficam guardadas por um tempo.

**Voltar para a versão anterior:** se a pessoa pedir, confirme e rode `./estudio publicar <nome> --voltar` (a anterior) ou `./estudio publicar <nome> --voltar <número>` (`PUBLICAR_VERSAO_VOLTOU`).

**Tirar este computador do acesso:** se a pessoa pedir (computador emprestado, vendido ou de outra pessoa), rode `./estudio publicar --sair`. Tirar um site do ar é pela página da conta, em sites.autonomia.site.

O acesso deste computador fica guardado em `.ferramentas/publicar/`. Nunca abra, mostre, copie nem envie esses arquivos.

## 3. Netlify

1. "Abra o endereço app.netlify.com/drop no navegador."
2. "Crie uma conta grátis (pode entrar com o e-mail ou com o Google). Sem conta, o site some depois de um tempo."
3. "Arraste para a área indicada a pasta `site` que eu abri para você. Se ele aceitar o arquivo `.zip`, pode ser o arquivo também."
4. "Espere terminar. Ele mostra um endereço terminado em `.netlify.app`. Abra e confira."
5. Opcional: "Em Configurações do site, dá para trocar o nome do endereço por um mais curto."

**Atualizar depois:** no painel do site, na parte de publicações (Deploys), arraste a pasta `site` nova. O endereço continua o mesmo.

## 4. Cloudflare Pages

1. "Abra dash.cloudflare.com e crie uma conta grátis."
2. "No menu, entre em Workers e Pages e escolha criar um projeto de Pages, na opção de enviar arquivos (Upload assets ou Direct Upload). Não escolha a opção de ligar ao Git."
3. "Dê um nome ao projeto: ele vira o endereço, terminado em `.pages.dev`."
4. "Envie o arquivo `.zip` ou a pasta `site`."
5. "Clique para publicar (Deploy) e abra o endereço que aparece."

**Atualizar depois:** no projeto, crie uma nova publicação (Create deployment) e envie o pacote novo.

## 5. GitHub Pages

1. "Abra github.com e crie uma conta grátis, se ainda não tiver."
2. "Crie um repositório novo (o botão New). Dê um nome curto, por exemplo o nome do negócio, e deixe como público. No plano grátis, o site só sai de repositório público."
3. "Na página do repositório, clique em enviar arquivos (uploading an existing file)."
4. "Abra a pasta `site` e arraste **o que está dentro dela** (o `index.html`, a pasta `assets` e as outras pastas), não a pasta `site` em si. O `index.html` precisa ficar na primeira tela do repositório." Se forem mais de 100 arquivos, arraste em mais de uma vez.
5. "Clique em confirmar (Commit changes)."
6. "Vá em Settings, depois em Pages. Em Source, escolha publicar a partir de um ramo (Deploy from a branch), escolha `main` e a pasta `/ (root)`, e salve."
7. "Em um ou dois minutos aparece o endereço, no formato `seu-usuario.github.io/nome-do-repositorio`. Abra e confira."

**Atualizar depois:** envie os arquivos novos do mesmo jeito, por cima dos antigos, e confirme.

## 6. Depois que estiver no ar

1. Peça o endereço e confira com a pessoa, no celular e no computador: a página inicial abre, as outras páginas abrem, as fotos aparecem, os botões de WhatsApp, telefone e e-mail funcionam.
2. **Imagem de compartilhamento.** A foto que aparece quando alguém manda o link no WhatsApp precisa do endereço completo. Com o endereço final em mãos, preencha `site.endereco` (completo, começando com `https://` e terminando em `/`) e `site.imagemSocial` (uma foto de `site/assets/`, de preferência 1200 por 630) em `sites/<nome>/_gerador/ordem.mjs`, rode `./estudio montar <nome>`, `./estudio preflight <nome>` e `./estudio pacote <nome>`, e publique de novo (com a confirmação dela) ou peça para a pessoa enviar o pacote novo (o "Atualizar depois" do serviço dela).
3. Registre em `sites/<nome>/andamento.md`: onde está hospedado, o endereço e a data.

## 7. Endereço próprio (opcional)

Quando a pessoa quiser um endereço como `cafeaurora.com.br`:

Em sites.autonomia.site isso ainda não está disponível: o endereço fica `<nome>.sites.autonomia.site`. Para um endereço próprio agora, use Netlify, Cloudflare Pages ou GitHub Pages.

1. Ela registra o domínio num registrador (no Brasil, `.br` é no registro.br). Isso é pago e é com ela; você não faz compra nenhuma.
2. No serviço onde o site está, há uma opção de domínio próprio (Custom domain, em Domain management, Custom domains ou Settings > Pages). Ela digita o domínio ali, e o serviço mostra quais registros de DNS criar.
3. Ela cria esses registros no painel do registrador, exatamente como o serviço mostrou. Você ajuda a ler a tela, se ela mandar uma foto, mas não inventa valores: os valores certos são os que o serviço mostrou para ela.
4. Pode levar de alguns minutos a algumas horas. O cadeado (HTTPS) costuma ser ligado pelo próprio serviço.
5. Depois, refaça o passo 6.2 com o endereço novo.

## Regras

- Nunca entre na conta da pessoa, nunca peça senha, código ou cartão, e nunca use chave de acesso de serviço nenhum. O acesso de sites.autonomia.site é do próprio estúdio: só o `./estudio publicar` usa, e você nunca o lê nem mostra.
- Só publique com `./estudio publicar`, em sites.autonomia.site, e só depois de a pessoa confirmar, a cada vez. Nunca publique por conta própria, nem por ferramenta de navegador.
- Nunca suba o site com o `preflight` vermelho.
- Explique um passo por mensagem e espere a pessoa dizer que fez.
