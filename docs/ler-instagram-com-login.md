# Ler o Instagram com login: desenho para a prova técnica

O comando `ler` lê o Instagram **sem login**. Este documento descreve o que ele faz hoje, o que
falta e o desenho da leitura com login. **A leitura com login não está implementada.** Ela só entra
depois de uma prova técnica que passe nos critérios do fim deste documento.

## O que existe hoje (sem login)

- O navegador sem janela do estúdio abre a página pública do perfil e a de cada publicação.
- Do perfil saem o nome, a bio, os links da bio e a grade com as publicações mais recentes.
- De cada publicação saem a legenda, a data e a foto na maior resolução que a página pública traz.
  Essa foto costuma ter 1080 pontos de largura, às vezes mais. Os dados vêm do JSON que a página
  traz embutido; sem ele, das etiquetas `og:` e do `<time datetime>`.
- **Limite.** Sem login, o Instagram mostra só as 12 publicações mais recentes. Ao rolar, ele pede
  para entrar na conta.
- **Reserva.** Quando faltam publicações, o aviso `LER_INSTAGRAM_POUCOS` manda o assistente usar a
  extensão do Claude no Chrome. Quando a leitura falha, o aviso é `LER_INSTAGRAM_FALHOU`. A extensão
  roda no Chrome da própria pessoa, que já está na conta dela. O estúdio não guarda nada da conta.

## Por que não implementar o login agora

1. **Conta da pessoa em risco.** Automação numa conta logada pode levar o Instagram a pedir
   verificação ou a bloquear a conta. Para um pequeno negócio, perder o Instagram é pior que ter um
   site sem as publicações antigas.
2. **Segredo no computador.** O login deixa um cookie de sessão. Esse cookie vale como uma senha e
   precisa morar num lugar que nunca vai para o zip, para o repositório nem para a saída dos comandos.
3. **Prova antes do código.** Ninguém mediu ainda se a leitura logada funciona no Mac e no Windows,
   nem quantas publicações ela lê antes de o Instagram reagir.

## Desenho proposto

`./estudio ler <nome> --instagram perfil --com-login`

1. **Janela visível, perfil próprio.** O estúdio abre o Chrome **com janela**, com uma pasta de
   perfil só dele: `.ferramentas/perfil-instagram/`. A pasta já está no `.gitignore`, o `atualizar`
   não toca nela e o `pacote` nunca a lê. Não é o Chrome da pessoa e não usa os cookies dele.
2. **A pessoa entra sozinha.** O assistente diz: "Abri o Instagram numa janela. Entre na sua conta,
   do jeito de sempre, e me avise." O estúdio nunca vê, digita nem guarda a senha. Ele só espera até
   a página mostrar a conta aberta.
3. **Mesma leitura, mais publicações.** Logada, a grade continua carregando ao rolar. O estúdio
   guarda as respostas em JSON que a própria página pede (`Network.getResponseBody` pelo protocolo
   de depuração) e reaproveita `dadosDoPost` e `acharObjetos`. A janela fica parada enquanto ele lê.
4. **Ritmo de gente.** Uma rolagem a cada 2 a 4 segundos e no máximo 60 publicações por leitura.
   Ao primeiro sinal de bloqueio ou verificação, a leitura para e devolve o que já leu.
5. **Sair.** `./estudio ler --sair-do-instagram` apaga `.ferramentas/perfil-instagram/` inteira.
   A skill `instalar-estudio`, seção "Desinstalar", também apaga essa pasta.
6. **Nenhum segredo na saída.** A saída do comando e os arquivos de `coleta/` nunca trazem cookie,
   token nem cabeçalho de pedido. Todo texto livre passa pelo `sanear` antes de ser impresso.

## Critérios da prova técnica (todos, antes de implementar)

| # | Critério | Como medir |
|---|---|---|
| 1 | A janela abre com o perfil próprio no Mac e no Windows | rodar nos dois sistemas, foto da janela |
| 2 | A pessoa entra sozinha e a sessão continua na leitura seguinte | duas leituras seguidas, a segunda sem pedir login |
| 3 | São lidas 50 publicações com legenda, data e foto de 1080 ou mais | `coleta/instagram/posts.json`, 3 contas de teste |
| 4 | Nenhuma conta de teste é bloqueada nem recebe pedido de verificação | 3 contas, 5 leituras cada, em 3 dias |
| 5 | Nenhum segredo vaza | procurar o valor do cookie em `coleta/`, na saída e no zip: zero ocorrências |
| 6 | Sair apaga a sessão | depois de sair, a leitura seguinte pede login de novo |

Use só contas de teste criadas para a prova, nunca a conta de um cliente. Com os 6 critérios
cumpridos, a decisão de ligar o login é do responsável pelo produto, porque a conta da pessoa entra
em risco.
