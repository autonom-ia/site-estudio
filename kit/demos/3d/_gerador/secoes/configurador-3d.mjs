// Demo "configurador 3D": a pessoa escolhe a cor, o acabamento e a faixa refletiva de uma
// caramanhola e vê a peça mudar na hora, em 3D (caramanhola-3d.js). Arrastar gira a peça e mostra
// o que a foto de frente não mostra: a rodinha raiada da marca, gravada num lado só.
//
// O que funciona sem 3D (sem WebGL, com "reduzir movimento" ou antes de o 3D chegar): o desenho
// de reserva muda de cor e de acabamento só com CSS (:has), o resumo escrito e o link do pedido
// acompanham a escolha (3d.js). As escolhas são botões de rádio de verdade dentro de <fieldset>:
// teclado (Tab e setas) e leitor de tela funcionam sem nada a mais. Nunca <select>.
//
// A forma da peça mora aqui, uma vez só: o mesmo perfil desenha a reserva e vai para a cena.
// Para levar a um site: copie esta seção, troque a peça (perfil, opções e textos, tudo do
// fatos.md) e copie a pasta site/assets/3d/ e o <link>/<script> do fim.

// [raio, altura], de baixo para cima. Ponto repetido = quina. As curvas entre os pontos são
// alisadas por suavizar() antes de ir para a cena e para a reserva.
const CORPO_BRUTO = [
  [0, 0], [0.33, 0], [0.33, 0], [0.39, 0.025], [0.415, 0.08], [0.42, 0.16],
  [0.42, 0.62], [0.4, 0.74], [0.385, 0.86], [0.385, 1.14], [0.4, 1.26], [0.42, 1.38],
  [0.42, 1.62], [0.405, 1.73], [0.36, 1.81], [0.29, 1.86], [0.245, 1.88], [0.245, 1.88], [0.245, 1.94],
];
const TAMPA_BRUTA = [
  [0.262, 1.9], [0.262, 1.9], [0.266, 2.06], [0.25, 2.09], [0.25, 2.09], [0.14, 2.1], [0.14, 2.1],
  [0.112, 2.12], [0.105, 2.24], [0.09, 2.27], [0.05, 2.285], [0, 2.288],
];
const FAIXA = [[0.385, 0.94], [0.389, 0.94], [0.389, 0.94], [0.389, 1.06], [0.389, 1.06], [0.385, 1.06]];
// A rodinha raiada da marca, gravada num lado só da peça (centro na altura 1,5, onde o corpo é reto).
const EMBLEMA = { altura: 1.5, raio: 0.1, raios: 8 };
const PASSOS = 3; // pontos novos entre dois pontos do perfil

const mesmo = (a, b) => Boolean(a && b) && a[0] === b[0] && a[1] === b[1];

// Catmull-Rom entre pontos vizinhos que não são quina: a curva passa pelos pontos originais e o
// contorno deixa de quebrar em retas. Na quina (ponto repetido), a curva para e recomeça.
export function suavizar(perfil, passos = PASSOS) {
  const saida = [];
  for (let i = 0; i < perfil.length; i += 1) {
    const p1 = perfil[i];
    const p2 = perfil[i + 1];
    saida.push(p1);
    if (!p2 || mesmo(p1, p2)) continue;
    const p0 = i > 0 && !mesmo(perfil[i - 1], p1) ? perfil[i - 1] : p1;
    const p3 = perfil[i + 2] && !mesmo(perfil[i + 2], p2) ? perfil[i + 2] : p2;
    for (let k = 1; k <= passos; k += 1) {
      const t = k / (passos + 1);
      const t2 = t * t;
      const t3 = t2 * t;
      const eixo = (j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      saida.push([Math.max(0, Number(eixo(0).toFixed(4))), Number(eixo(1).toFixed(4))]);
    }
  }
  return saida;
}
const CORPO = suavizar(CORPO_BRUTO);
const TAMPA = suavizar(TAMPA_BRUTA);

// tom: a rodinha gravada fica clara nas cores escuras e escura nas claras
const CORES = [
  { valor: 'grafite', nome: 'Grafite', hex: '#2B3035', tom: 'escuro' },
  { valor: 'azul', nome: 'Azul quadro', hex: '#1C46BF', tom: 'escuro' },
  { valor: 'concreto', nome: 'Concreto', hex: '#D3D7D0', tom: 'claro' },
  { valor: 'verde', nome: 'Verde faixa', hex: '#B9D63A', tom: 'claro' },
];
const ACABAMENTOS = [
  { valor: 'fosca', nome: 'Fosca', brilho: 0.14 },
  { valor: 'brilhante', nome: 'Brilhante', brilho: 0.9 },
];
const FAIXAS = [
  { valor: 'com', nome: 'Com faixa', resumo: 'com faixa refletiva', faixa: 'sim' },
  { valor: 'sem', nome: 'Sem faixa', resumo: 'sem faixa', faixa: 'nao' },
];
// O título é a assinatura da marca, como na página inicial: uma linha em cada peso.
const TITULO = [['fina', 'Monte a'], ['pesada', 'caramanhola'], ['media', 'do seu'], ['luz', 'jeito.']];

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

// A rodinha de frente: aro e raios, no centro da peça.
function emblemaDeFrente() {
  const cx = MEIO;
  const cy = ALTO - EMBLEMA.altura * ESCALA;
  const r = EMBLEMA.raio * ESCALA;
  const raios = [];
  for (let i = 0; i < EMBLEMA.raios; i += 1) {
    const a = (i / EMBLEMA.raios) * Math.PI * 2;
    raios.push(`M${cx.toFixed(1)} ${cy.toFixed(1)}L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<g class="caramanhola-reserva__emblema"><circle cx="${cx}" cy="${cy}" r="${r}" /><path d="${raios.join('')}" /></g>`;
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
        <line class="caramanhola-reserva__bancada" x1="-400" x2="520" y1="${ALTO}" y2="${ALTO}" />
        <ellipse cx="${MEIO}" cy="${ALTO}" rx="50" ry="7" fill="url(#caramanhola-chao)" />
        <path class="caramanhola-reserva__corpo" d="${silhueta(CORPO)}" />
        <rect class="caramanhola-reserva__faixa" x="${(MEIO - faixaLargo).toFixed(1)}" y="${faixaY.toFixed(1)}" width="${(faixaLargo * 2).toFixed(1)}" height="${faixaAlto.toFixed(1)}" />
        ${emblemaDeFrente()}
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
    atributos: `data-cor="${c.hex}" data-tom="${c.tom}" data-esmalte="${i + 1}" data-resumo="${esc(c.nome.toLowerCase())}"`,
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
      <h1 class="assinatura configurador__titulo" id="configurador-titulo" data-assina>
        ${TITULO.map(([peso, texto]) => `<span class="assinatura__linha assinatura__linha--${peso}">${esc(texto)}</span>`).join('\n        ')}
      </h1>
      <p class="configurador__lide">${esc('Escolha a cor, o acabamento e a faixa: a peça muda na hora. Arraste a caramanhola para ver o outro lado.')}</p>
    </div>
    <div class="configurador__palco palco-3d" id="caramanhola" data-3d="caramanhola" data-3d-estado="reserva" role="img" aria-label="A caramanhola com a escolha feita"
      data-3d-perfil="${esc(JSON.stringify(CORPO))}" data-3d-tampa="${esc(JSON.stringify(TAMPA))}" data-3d-faixa="${esc(JSON.stringify(FAIXA))}" data-3d-emblema="${esc(JSON.stringify(EMBLEMA))}">
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
        <a class="botao" data-3d-pedido="caramanhola" data-texto="Olá! Quero esta: {escolha}" href="https://wa.me/551100000000?text=${pedido}">Pedir esta pelo WhatsApp</a>
      </div>
    </div>
  </div>
  <script src="${assets}3d/3d.js" defer></script>
</section>`;
}
