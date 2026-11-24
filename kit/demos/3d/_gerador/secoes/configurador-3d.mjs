// Demo "configurador 3D": a pessoa escolhe a cor, o acabamento e a faixa refletiva de uma
// caramanhola e vê a peça mudar na hora, em 3D (caramanhola-3d.js). Arrastar gira a peça.
//
// O que funciona sem 3D (sem WebGL, com "reduzir movimento" ou antes de o 3D chegar): o desenho
// de reserva muda de cor e de acabamento só com CSS (:has), o resumo escrito e o link do pedido
// acompanham a escolha (3d.js). As escolhas são botões de rádio de verdade dentro de <fieldset>:
// teclado (Tab e setas) e leitor de tela funcionam sem nada a mais. Nunca <select>.
//
// A forma da peça mora aqui, uma vez só: o mesmo perfil desenha a reserva e vai para a cena.
// Para levar a um site: copie esta seção, troque a peça (perfil, opções e textos, tudo do
// fatos.md) e copie a pasta site/assets/3d/ e o <link>/<script> do fim.

// [raio, altura], de baixo para cima. Ponto repetido = quina.
const CORPO = [
  [0, 0], [0.33, 0], [0.39, 0.025], [0.415, 0.08], [0.42, 0.16],
  [0.42, 0.62], [0.4, 0.74], [0.385, 0.86], [0.385, 1.14], [0.4, 1.26], [0.42, 1.38],
  [0.42, 1.62], [0.405, 1.73], [0.36, 1.81], [0.29, 1.86], [0.245, 1.88], [0.245, 1.88], [0.245, 1.94],
];
const TAMPA = [
  [0.262, 1.9], [0.262, 1.9], [0.266, 2.06], [0.25, 2.09], [0.25, 2.09], [0.14, 2.1], [0.14, 2.1],
  [0.112, 2.12], [0.105, 2.24], [0.09, 2.27], [0.05, 2.285], [0, 2.288],
];
const FAIXA = [[0.385, 0.94], [0.389, 0.94], [0.389, 0.94], [0.389, 1.06], [0.389, 1.06], [0.385, 1.06]];

const CORES = [
  { valor: 'grafite', nome: 'Grafite', hex: '#2B3035' },
  { valor: 'azul', nome: 'Azul quadro', hex: '#1C46BF' },
  { valor: 'concreto', nome: 'Concreto', hex: '#D3D7D0' },
  { valor: 'verde', nome: 'Verde faixa', hex: '#B9D63A' },
];
const ACABAMENTOS = [
  { valor: 'fosca', nome: 'Fosca', brilho: 0.14 },
  { valor: 'brilhante', nome: 'Brilhante', brilho: 0.9 },
];
const FAIXAS = [
  { valor: 'com', nome: 'Com faixa', resumo: 'com faixa refletiva', faixa: 'sim' },
  { valor: 'sem', nome: 'Sem faixa', resumo: 'sem faixa', faixa: 'nao' },
];

// Desenho de reserva: o perfil visto de frente (1 unidade = 100), com sombra de cilindro por cima.
const ESCALA = 100;
const ALTO = 240;
const MEIO = 60;
const ponto = (r, h, lado) => `${(MEIO + lado * r * ESCALA).toFixed(1)} ${(ALTO - h * ESCALA).toFixed(1)}`;
function silhueta(perfil) {
  const direita = perfil.map(([r, h]) => ponto(r, h, 1));
  const esquerda = [...perfil].reverse().map(([r, h]) => ponto(r, h, -1));
  return `M${[...direita, ...esquerda].join('L')}Z`;
}

function caramanholaDeReserva() {
  const faixaY = ALTO - FAIXA[3][1] * ESCALA;
  const faixaAlto = (FAIXA[3][1] - FAIXA[0][1]) * ESCALA;
  const faixaLargo = FAIXA[2][0] * ESCALA;
  return `<svg class="palco-3d__reserva caramanhola-reserva" viewBox="-24 -26 168 300" width="168" height="300" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="caramanhola-volume" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#000" stop-opacity=".42" />
            <stop offset=".22" stop-color="#000" stop-opacity="0" />
            <stop offset=".36" stop-color="#fff" stop-opacity=".16" />
            <stop offset=".55" stop-color="#fff" stop-opacity="0" />
            <stop offset="1" stop-color="#000" stop-opacity=".5" />
          </linearGradient>
          <radialGradient id="caramanhola-chao">
            <stop offset="0" stop-color="#000" stop-opacity=".28" />
            <stop offset="1" stop-color="#000" stop-opacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="${MEIO}" cy="${ALTO}" rx="50" ry="7" fill="url(#caramanhola-chao)" />
        <path class="caramanhola-reserva__corpo" d="${silhueta(CORPO)}" />
        <rect class="caramanhola-reserva__faixa" x="${(MEIO - faixaLargo).toFixed(1)}" y="${faixaY.toFixed(1)}" width="${(faixaLargo * 2).toFixed(1)}" height="${faixaAlto.toFixed(1)}" />
        <path d="${silhueta(CORPO)}" fill="url(#caramanhola-volume)" />
        <rect class="caramanhola-reserva__brilho" x="${MEIO - 25}" y="${ALTO - 168}" width="5" height="138" rx="2.5" />
        <path class="caramanhola-reserva__tampa" d="${silhueta(TAMPA)}" />
        <path d="${silhueta(TAMPA)}" fill="url(#caramanhola-volume)" />
      </svg>`;
}

function grupo({ nome, legenda, classe, opcoes }) {
  return `<fieldset class="escolhas__grupo ${classe}">
          <legend class="escolhas__legenda">${legenda}</legend>
          <div class="escolhas__opcoes">
            ${opcoes.map((o, i) => `<label class="escolha">
              <input type="radio" name="${nome}" value="${o.valor}" ${o.atributos}${i === 0 ? ' checked' : ''}>
              ${o.marca || ''}<span class="escolha__nome">${o.nome}</span>
            </label>`).join('\n            ')}
          </div>
        </fieldset>`;
}

export default function configurador3d({ esc, assets }) {
  const resumoInicial = `Caramanhola ${CORES[0].nome.toLowerCase()}, ${ACABAMENTOS[0].nome.toLowerCase()}, ${FAIXAS[0].resumo}.`;
  const cores = CORES.map((c, i) => ({
    valor: c.valor,
    nome: esc(c.nome),
    atributos: `data-cor="${c.hex}" data-esmalte="${i + 1}" data-resumo="${esc(c.nome.toLowerCase())}"`,
    marca: `<span class="escolha__tinta" style="--amostra:${c.hex}" aria-hidden="true"></span>`,
  }));
  const acabamentos = ACABAMENTOS.map((a) => ({
    valor: a.valor,
    nome: esc(a.nome),
    atributos: `data-brilho="${a.brilho}" data-acabamento="${a.valor}" data-resumo="${esc(a.nome.toLowerCase())}"`,
  }));
  const faixas = FAIXAS.map((f) => ({
    valor: f.valor,
    nome: esc(f.nome),
    atributos: `data-faixa="${f.faixa}" data-resumo="${esc(f.resumo)}"`,
  }));
  const esmaltes = CORES.map((c, i) => `--esmalte-${i + 1}:${c.hex}`).join(';');
  const pedido = encodeURIComponent(`Olá! Quero esta: ${resumoInicial}`);
  return `<section class="configurador" data-secao="configurador" data-molde="configurador-3d" aria-labelledby="configurador-titulo" style="${esmaltes}">
  <link rel="stylesheet" href="${assets}3d/3d.css">
  <div class="envelope configurador__grade">
    <div class="configurador__texto">
      <h1 class="configurador__titulo" id="configurador-titulo">Caramanhola do seu jeito.</h1>
      <p class="configurador__lide">${esc('Escolha a cor, o acabamento e a faixa: a peça muda na hora. Arraste a caramanhola para ver de outro lado.')}</p>
    </div>
    <div class="configurador__palco palco-3d" id="caramanhola" data-3d="caramanhola" data-3d-estado="reserva" role="img" aria-label="${esc(resumoInicial)}"
      data-3d-perfil="${esc(JSON.stringify(CORPO))}" data-3d-tampa="${esc(JSON.stringify(TAMPA))}" data-3d-faixa="${esc(JSON.stringify(FAIXA))}">
      ${caramanholaDeReserva()}
    </div>
    <form class="escolhas" data-3d-opcoes="caramanhola" data-3d-antes="Caramanhola " aria-label="Monte a caramanhola">
      ${grupo({ nome: 'cor', legenda: 'Cor', classe: 'escolhas__grupo--cor', opcoes: cores })}
      ${grupo({ nome: 'acabamento', legenda: 'Acabamento', classe: '', opcoes: acabamentos })}
      ${grupo({ nome: 'faixa', legenda: 'Faixa refletiva', classe: '', opcoes: faixas })}
    </form>
    <div class="configurador__fecho">
      <p class="configurador__resumo" data-3d-resumo="caramanhola" aria-live="polite">${esc(resumoInicial)}</p>
      <div class="acoes">
        <a class="botao botao--escuro" data-3d-pedido="caramanhola" data-texto="Olá! Quero esta: {escolha}" href="https://wa.me/551100000000?text=${pedido}">Pedir esta pelo WhatsApp</a>
      </div>
    </div>
  </div>
  <script src="${assets}3d/3d.js" defer></script>
</section>`;
}
