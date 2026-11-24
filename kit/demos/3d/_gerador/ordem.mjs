// Demo de 3D do Site Estúdio: o molde (Oficina Raio, negócio fictício) com as duas peças de 3D.
// Criada por ./estudio novo <nome> --demo 3d. A página inicial traz a marca em 3D (a roda raiada
// no topo, seção abertura-3d) e a página "monte" traz o configurador 3D (seção configurador-3d).
// É exemplo: molde: true e os data-molde ficam, para nunca ir ao ar como está.

export const site = {
  molde: true,
  nome: '{{NOME_DO_SITE}}',
  idioma: 'pt-BR',
  endereco: '',
  imagemSocial: '',
  corDoNavegador: '#111417',
  cabecalho: 'cabecalho',
  rodape: 'rodape',
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
    secoes: ['abertura-3d', 'jeito', 'servicos', 'pico', 'visita'],
  },
  {
    rota: 'monte',
    menu: 'Monte a sua',
    titulo: 'Monte a sua caramanhola',
    descricao: 'Escolha a cor, o acabamento e a faixa refletiva da caramanhola e veja como fica antes de pedir.',
    secoes: ['configurador-3d', 'chamada'],
  },
];
