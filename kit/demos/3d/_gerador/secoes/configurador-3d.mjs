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
// A faixa refletiva sai um pouco do corpo (relevo); FRISO: a linha de sombra em cima e embaixo dela.
const FAIXA = [[0.385, 0.94], [0.392, 0.94], [0.392, 0.94], [0.392, 1.06], [0.392, 1.06], [0.385, 1.06]];
const FRISO = 0.012;
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
  { valor: 'concreto', nome: 'Concreto', hex: '#C3C8C0', tom: 'claro' },
  { valor: 'verde', nome: 'Verde luz', hex: '#B9D63A', tom: 'claro' },
];
const ACABAMENTOS = [
  { valor: 'fosca', nome: 'Fosca', brilho: 0.08 },
  { valor: 'brilhante', nome: 'Brilhante', brilho: 0.9 },
];
const FAIXAS = [
  { valor: 'com', nome: 'Com faixa', resumo: 'com faixa refletiva', faixa: 'sim' },
  { valor: 'sem', nome: 'Sem faixa', resumo: 'sem faixa', faixa: 'nao' },
];
// O título é a assinatura da marca, como na página inicial: uma linha em cada peso.
const TITULO = [['fina', 'Monte a'], ['pesada', 'caramanhola'], ['media', 'do seu'], ['luz', 'jeito.']];

// A peça parada e a câmera: giro de repouso (radianos), alvo, direção do olhar (do alvo para o
// olho), distância e abertura (fov, vertical). A cena 3D (caramanhola-3d.js) lê daqui
// (data-3d-pose): mira com esta câmera e termina o giro do começo exatamente neste giro. A reserva
// é desenhada pela mesma câmera (contorno, base, tampa, faixa e rodinha projetados): mesma peça,
// mesmo tamanho, mesmo lugar, mesma pose.
// bancada: o tampo vai do fundo (z, onde fica a linha) até a frente; ele e a linha somem no fundo
// da página para os lados (de "lados[0]" a "lados[1]" do meio) e para a frente (de "some[0]" a
// "some[1]"), para não virar um retângulo recortado.
const POSE = Object.freeze({
  giro: 0.5, alvo: [0, 0.02, 0], olhar: [0, 0.53, 5.6], distancia: 5.1, fov: 0.5,
  bancada: { fundo: -0.25, frente: 1.5, lados: [0.45, 1.25], some: [0.05, 0.6] },
});
const BANCADA = POSE.bancada;

// Desenho de reserva: unidades da reserva (a peça tem 1 unidade de raio = 100 de frente, base em ALTO).
const ESCALA = 100;
const ALTO = 240;
const MEIO = 60;
const VOLTA = 72; // pontos em cada anel do perfil

// raio do perfil numa altura (a mesma conta de caramanhola-3d.js)
function raioNa(perfil, altura) {
  for (let i = 1; i < perfil.length; i += 1) {
    const [r0, h0] = perfil[i - 1];
    const [r1, h1] = perfil[i];
    if (h1 >= altura && h0 <= altura && h1 !== h0) return r0 + ((r1 - r0) * (altura - h0)) / (h1 - h0);
  }
  return perfil[perfil.length - 1][0];
}

// A câmera da cena (as mesmas contas do motor), para a reserva. projetar([x, y, z]) leva um ponto
// da peça (em pé, base em y = 0, eixo em x = z = 0) para a reserva: [x, y] em unidades da reserva.
// A escala é a que dá à peça, de frente, a mesma altura que ela tem no desenho de frente.
function camera() {
  const altura = TAMPA[TAMPA.length - 1][1];
  const meio = altura / 2;
  const t = Math.hypot(...POSE.olhar);
  const olho = POSE.olhar.map((v, i) => POSE.alvo[i] + (v / t) * POSE.distancia);
  const frente = POSE.alvo.map((v, i) => v - olho[i]);
  const nf = Math.hypot(...frente);
  const f = frente.map((v) => v / nf);
  // "para cima" da câmera: perpendicular à frente, sem virar de lado; "direita": frente x cima
  const c0 = [0, f[2] * f[2] + f[0] * f[0], -f[1] * f[2]];
  const nc = Math.hypot(...c0);
  const cima = c0.map((v) => v / nc);
  const dir = [f[1] * cima[2] - f[2] * cima[1], f[2] * cima[0] - f[0] * cima[2], f[0] * cima[1] - f[1] * cima[0]];
  const tangentes = ([x, y, z]) => {
    const d = [x - olho[0], y - meio - olho[1], z - olho[2]];
    const fundo = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    return [(d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2]) / fundo, (d[0] * cima[0] + d[1] * cima[1] + d[2] * cima[2]) / fundo];
  };
  const base = tangentes([0, 0, 0])[1];
  const escala = (altura * ESCALA) / (tangentes([0, altura, 0])[1] - base);
  const projetar = (p) => {
    const [tx, ty] = tangentes(p);
    return [MEIO + tx * escala, ALTO - (ty - base) * escala];
  };
  return { projetar, base, escala };
}
const CAMERA = camera();
const xy = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// Um anel do perfil (raio r na altura h) na reserva: os pontos, o mais à esquerda, o mais à direita,
// e os dois arcos entre eles. A frente é o arco mais baixo na tela (a câmera olha de cima).
function anel(r, h) {
  const pts = [];
  for (let k = 0; k < VOLTA; k += 1) {
    const a = (k / VOLTA) * Math.PI * 2;
    pts.push(CAMERA.projetar([Math.cos(a) * r, h, Math.sin(a) * r]));
  }
  let esq = 0;
  let dir = 0;
  pts.forEach((p, k) => {
    if (p[0] < pts[esq][0]) esq = k;
    if (p[0] > pts[dir][0]) dir = k;
  });
  const arco = (de, ate) => {
    const lista = [];
    for (let k = de; ; k = (k + 1) % VOLTA) {
      lista.push(pts[k]);
      if (k === ate) break;
    }
    return lista;
  };
  const a1 = arco(esq, dir);
  const a2 = arco(dir, esq);
  const maisBaixo = (lista) => Math.max(...lista.map((p) => p[1]));
  const [frente, atras] = maisBaixo(a1) >= maisBaixo(a2) ? [a1, [...a2].reverse()] : [[...a2].reverse(), a1];
  // frente e atrás, os dois da esquerda para a direita
  return { pts, esq: pts[esq], dir: pts[dir], frente, atras };
}

// Onde uma linha (pontos da esquerda para a direita) passa na altura x; null se não passa.
function alturaEm(linha, x) {
  for (let i = 1; i < linha.length; i += 1) {
    const [x0, y0] = linha[i - 1];
    const [x1, y1] = linha[i];
    if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)) return x1 === x0 ? Math.max(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return null;
}
// O pé visto de cima: de cada anel de baixo, aparece o arco da frente; o pé é o mais baixo deles
// em cada ponto (sem isso, o fundo côncavo da peça sai como um calombo embaixo).
function pe(aneis, esq, dir, passos = 48) {
  const pontos = [];
  for (let k = 0; k <= passos; k += 1) {
    const x = esq[0] + ((dir[0] - esq[0]) * k) / passos;
    let y = -Infinity;
    for (const a of aneis) {
      const v = alturaEm(a.frente, x);
      if (v !== null && v > y) y = v;
    }
    pontos.push([x, y]);
  }
  return pontos;
}

// Contorno de um sólido de torno visto pela câmera: o pé (arcos da frente dos anéis de baixo), o
// lado direito subindo, o arco de trás do anel de cima e o lado esquerdo descendo. A base sai em elipse.
function solido(perfil) {
  const aneis = perfil.filter(([r]) => r > 0.001).map(([r, h]) => anel(r, h));
  const alto = aneis[aneis.length - 1];
  // os anéis de baixo: até o mais largo do primeiro terço da peça
  const h0 = perfil[0][1];
  const h1 = perfil[perfil.length - 1][1];
  const deBaixo = aneis.filter((a, i) => perfil.filter(([r]) => r > 0.001)[i][1] <= h0 + (h1 - h0) / 3);
  const largo = deBaixo.reduce((m, a) => (a.dir[0] - a.esq[0] > m.dir[0] - m.esq[0] ? a : m), deBaixo[0]);
  const lado = aneis.slice(aneis.indexOf(largo));
  const pontos = [
    ...pe(deBaixo, largo.esq, largo.dir),
    ...lado.map((a) => a.dir),
    ...[...alto.atras].reverse(),
    ...[...lado].reverse().map((a) => a.esq),
  ];
  return `M${pontos.map(xy).join('L')}Z`;
}
// A elipse inteira de um anel (a face de cima de uma peça, vista de cima).
const elipse = (r, h) => `M${anel(r, h).pts.map(xy).join('L')}Z`;
// Uma faixa em volta da peça, da altura h0 à h1: o que aparece dela na frente.
function cinta(r, h0, h1) {
  const embaixo = anel(r, h0);
  const em = anel(r, h1);
  return `M${[...embaixo.frente, ...[...em.frente].reverse()].map(xy).join('L')}Z`;
}

// A rodinha gravada no ângulo de repouso: cada ponto colado no corpo, como na cena (lado da frente
// quando o giro é zero), girado pelo giro de repouso e visto pela câmera.
export function emblemaNaPose(giro = POSE.giro) {
  const R = raioNa(CORPO, EMBLEMA.altura) + 0.006;
  const noCorpo = (u, v) => {
    const a = Math.PI / 2 - u / R;
    const [x, z] = [Math.cos(a) * R, Math.sin(a) * R];
    return CAMERA.projetar([Math.cos(giro) * x + Math.sin(giro) * z, EMBLEMA.altura + v, -Math.sin(giro) * x + Math.cos(giro) * z]);
  };
  const voltas = 32;
  const aro = [];
  for (let i = 0; i <= voltas; i += 1) {
    const a = (i / voltas) * Math.PI * 2;
    aro.push(xy(noCorpo(Math.cos(a) * EMBLEMA.raio, Math.sin(a) * EMBLEMA.raio)));
  }
  const raios = [];
  for (let k = 0; k < EMBLEMA.raios; k += 1) {
    const a = (k / EMBLEMA.raios) * Math.PI * 2;
    raios.push(`M${xy(noCorpo(0, 0))}L${xy(noCorpo(Math.cos(a) * EMBLEMA.raio, Math.sin(a) * EMBLEMA.raio))}`);
  }
  return { centro: noCorpo(0, 0), d: `M${aro.join('L')}Z${raios.join('')}` };
}

// A bancada na reserva, pela câmera da cena: a linha do fundo, a frente do tampo e onde o tampo
// some no fundo da página (para a frente e para os lados, na altura da peça).
export function bancadaNaReserva() {
  const y = (z) => CAMERA.projetar([0, 0, z])[1];
  const x = (d) => CAMERA.projetar([d, 0, 0])[0];
  return {
    linha: y(BANCADA.fundo), frente: y(BANCADA.frente),
    some: [y(BANCADA.some[0]), y(BANCADA.some[1])],
    lados: [x(BANCADA.lados[0]) - MEIO, x(BANCADA.lados[1]) - MEIO],
  };
}

// O enquadramento da reserva: a mesma faixa de altura que a câmera vê, centrada na peça. O palco
// é mais largo que o desenho (celular e computador), e a sobra dos lados mostra a bancada.
export function enquadramento() {
  const { base, escala } = CAMERA;
  const meiaAltura = Math.tan(POSE.fov / 2) * escala;
  const centro = ALTO + base * escala; // a linha do meio da tela (tangente 0)
  const altura = 2 * meiaAltura;
  const largura = altura * 0.56;
  return { x: MEIO - largura / 2, y: centro - meiaAltura, largura, altura };
}

// A tampa em duas peças, como a cena: o anel (até o ombro) e o bico (do ombro para cima).
const OMBRO = 2.095;
const TAMPA_ANEL = TAMPA.filter(([, h]) => h <= OMBRO);
const TAMPA_BICO = TAMPA.filter(([, h]) => h > OMBRO);

function caramanholaDeReserva() {
  const b = bancadaNaReserva();
  const q = enquadramento();
  const corpo = solido(CORPO);
  const [, topoAnel] = TAMPA_ANEL[TAMPA_ANEL.length - 1];
  const raioAnel = TAMPA_ANEL[TAMPA_ANEL.length - 1][0];
  const fx = (v) => (MEIO + v).toFixed(1);
  // degradê dos lados: some de "lados[0]" a "lados[1]" do meio, nos dois lados
  const pLado = (v) => ((v + 400) / 920).toFixed(4);
  return `<svg class="palco-3d__reserva caramanhola-reserva" viewBox="${q.x.toFixed(1)} ${q.y.toFixed(1)} ${q.largura.toFixed(1)} ${q.altura.toFixed(1)}" width="${Math.round(q.largura)}" height="${Math.round(q.altura)}" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="caramanhola-volume" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#000" stop-opacity=".42" />
            <stop offset=".2" stop-color="#000" stop-opacity=".04" />
            <stop offset=".38" stop-color="#fff" stop-opacity=".06" />
            <stop offset=".6" stop-color="#000" stop-opacity=".04" />
            <stop offset="1" stop-color="#000" stop-opacity=".5" />
          </linearGradient>
          <radialGradient id="caramanhola-chao">
            <stop offset="0" stop-color="#000" stop-opacity=".28" />
            <stop offset="1" stop-color="#000" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="caramanhola-lados" gradientUnits="userSpaceOnUse" x1="-400" x2="520" y1="0" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0" />
            <stop offset="${pLado(MEIO - b.lados[1])}" stop-color="#fff" stop-opacity="0" />
            <stop offset="${pLado(MEIO - b.lados[0])}" stop-color="#fff" />
            <stop offset="${pLado(MEIO + b.lados[0])}" stop-color="#fff" />
            <stop offset="${pLado(MEIO + b.lados[1])}" stop-color="#fff" stop-opacity="0" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="caramanhola-frente" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${b.some[0].toFixed(1)}" y2="${b.some[1].toFixed(1)}">
            <stop offset="0" stop-color="#fff" />
            <stop offset="1" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
          <mask id="caramanhola-some-lados" maskUnits="userSpaceOnUse" x="-400" y="-200" width="920" height="700"><rect x="-400" y="-200" width="920" height="700" fill="url(#caramanhola-lados)" /></mask>
          <mask id="caramanhola-some-frente" maskUnits="userSpaceOnUse" x="-400" y="-200" width="920" height="700"><rect x="-400" y="-200" width="920" height="700" fill="url(#caramanhola-frente)" /></mask>
        </defs>
        <g mask="url(#caramanhola-some-lados)">
          <rect class="caramanhola-reserva__tampo" x="-400" y="${b.linha.toFixed(1)}" width="920" height="${(b.frente - b.linha).toFixed(1)}" mask="url(#caramanhola-some-frente)" />
          <line class="caramanhola-reserva__bancada" x1="-400" x2="520" y1="${b.linha.toFixed(1)}" y2="${b.linha.toFixed(1)}" />
        </g>
        <ellipse cx="${MEIO}" cy="${ALTO.toFixed(1)}" rx="50" ry="7" fill="url(#caramanhola-chao)" />
        <path class="caramanhola-reserva__corpo" d="${corpo}" />
        <g class="caramanhola-reserva__faixa">
          <path class="caramanhola-reserva__friso" d="${cinta(FAIXA[0][0] + 0.0012, FAIXA[0][1] - FRISO, FAIXA[3][1] + FRISO)}" />
          <path class="caramanhola-reserva__cinta" d="${cinta(FAIXA[2][0], FAIXA[0][1], FAIXA[3][1])}" />
        </g>
        <path class="caramanhola-reserva__emblema" d="${emblemaNaPose().d}" />
        <path d="${corpo}" fill="url(#caramanhola-volume)" />
        <rect class="caramanhola-reserva__brilho" x="${fx(-25)}" y="${ALTO - 168}" width="5" height="138" rx="2.5" />
        <path class="caramanhola-reserva__tampa" d="${solido(TAMPA_ANEL)}" />
        <path class="caramanhola-reserva__tampa-topo" d="${elipse(raioAnel, topoAnel)}" />
        <path class="caramanhola-reserva__tampa" d="${solido(TAMPA_BICO)}" />
        <path class="caramanhola-reserva__tampa-topo" d="${elipse(TAMPA_BICO[TAMPA_BICO.length - 2][0], TAMPA_BICO[TAMPA_BICO.length - 2][1])}" />
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
      data-3d-perfil="${esc(JSON.stringify(CORPO))}" data-3d-tampa="${esc(JSON.stringify(TAMPA))}" data-3d-faixa="${esc(JSON.stringify(FAIXA))}" data-3d-friso="${FRISO}" data-3d-emblema="${esc(JSON.stringify(EMBLEMA))}" data-3d-pose="${esc(JSON.stringify(POSE))}">
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
