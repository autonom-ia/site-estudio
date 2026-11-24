// A ordem do site: as páginas e, em cada uma, as seções na ordem em que aparecem.
// Cada nome em "secoes" é um arquivo em _gerador/secoes/<nome>.mjs. Depois de mexer aqui ou numa
// seção, rode ./estudio montar <nome-do-site> (ou node _gerador/montar.mjs).
//
// rota: '' é a página inicial; 'a-oficina' vira site/a-oficina/index.html. Só minúsculas, números, hífen e /.
// endereco: o endereço público do site, quando houver (https://…/). Com ele, o gerador escreve o link
// canônico e o og:image absoluto. Sem ele, ficam de fora (nada relativo vai para o og:image).

export const site = {
  // molde: true diz que nome, negócio e páginas ainda são do exemplo fictício (Oficina Raio). O
  // ./estudio checar reprova enquanto ela estiver aqui. Apague a linha quando tudo for do seu negócio.
  molde: true,
  nome: '{{NOME_DO_SITE}}',
  idioma: 'pt-BR',
  endereco: '',
  imagemSocial: '', // caminho dentro de site/, ex.: 'assets/img/social.jpg' (só usado com endereco)
  corDoNavegador: '#111417',
  // rolagem suave (Lenis): false quando a direção dispensa. A página deixa de carregar o Lenis e a
  // pasta site/assets/vendor/lenis/ pode sair (o pacote avisa enquanto ela ficar sem uso).
  lenis: true,
  cabecalho: 'cabecalho',
  rodape: 'rodape',
  // dados estruturados (JSON-LD) do negócio. Tudo aqui também precisa estar em fatos.md.
  negocio: {
    tipo: 'BicycleStore',
    telefone: '+55 11 0000-0000',
    email: 'ola@oficinaraio.example',
    rua: 'Rua dos Exemplos, 45',
    bairro: 'Vila Exemplo',
    cidade: 'São Paulo',
    estado: 'SP',
  },
};

export const paginas = [
  {
    rota: '',
    menu: 'Início',
    titulo: 'Oficina de bicicletas',
    descricao: 'Revisão, freio, câmbio e câmara em bicicleta de qualquer marca, com o preço antes do serviço. Chegou até as 10h, sai no mesmo dia.',
    secoes: ['abertura', 'jeito', 'servicos', 'pico', 'visita'],
  },
  {
    rota: 'a-oficina',
    menu: 'A oficina',
    titulo: 'A oficina',
    descricao: 'Como um box de garagem com uma bancada virou a oficina da rua de cima: a história, ano a ano.',
    secoes: ['abertura-pagina', 'historia', 'chamada'],
  },
];
