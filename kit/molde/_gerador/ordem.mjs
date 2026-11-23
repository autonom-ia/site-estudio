// A ordem do site: as páginas e, em cada uma, as seções na ordem em que aparecem.
// Cada nome em "secoes" é um arquivo em _gerador/secoes/<nome>.mjs. Depois de mexer aqui ou numa
// seção, rode ./estudio montar <nome-do-site> (ou node _gerador/montar.mjs).
//
// rota: '' é a página inicial; 'a-casa' vira site/a-casa/index.html. Só minúsculas, números, hífen e /.
// endereco: o endereço público do site, quando houver (https://…/). Com ele, o gerador escreve o link
// canônico e o og:image absoluto. Sem ele, ficam de fora (nada relativo vai para o og:image).

export const site = {
  // molde: true diz que nome, negócio e páginas ainda são do exemplo fictício (Café Aurora). O
  // ./estudio checar reprova enquanto ela estiver aqui. Apague a linha quando tudo for do seu negócio.
  molde: true,
  nome: '{{NOME_DO_SITE}}',
  idioma: 'pt-BR',
  endereco: '',
  imagemSocial: '', // caminho dentro de site/, ex.: 'assets/img/social.jpg' (só usado com endereco)
  corDoNavegador: '#16122a',
  cabecalho: 'cabecalho',
  rodape: 'rodape',
  // dados estruturados (JSON-LD) do negócio. Tudo aqui também precisa estar em fatos.md.
  negocio: {
    tipo: 'Bakery',
    telefone: '+55 11 0000-0000',
    email: 'ola@cafeaurora.example',
    rua: 'Rua das Amoreiras, 120',
    bairro: 'Vila Exemplo',
    cidade: 'São Paulo',
    estado: 'SP',
  },
};

export const paginas = [
  {
    rota: '',
    menu: 'Início',
    titulo: 'Padaria e café de bairro',
    descricao: 'Pão de fermentação natural, café coado e uma mesa perto da janela. Aberto de terça a domingo, desde cedo.',
    secoes: ['abertura', 'manifesto', 'cardapio', 'pico', 'visita'],
  },
  {
    rota: 'a-casa',
    menu: 'A casa',
    titulo: 'A casa',
    descricao: 'Como um forno e duas mesas viraram a padaria do bairro: a história da casa, ano a ano.',
    secoes: ['abertura-pagina', 'historia', 'chamada'],
  },
];
