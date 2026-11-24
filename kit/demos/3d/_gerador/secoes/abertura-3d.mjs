// Demo "marca em 3D": a primeira tela do molde com a roda raiada da marca em 3D ao lado da
// assinatura. A roda rola quando a página rola e se inclina um pouco para o ponteiro (raio-3d.js).
// A imagem de reserva (o desenho parado da mesma roda) já vem na página: é o que aparece sem
// WebGL, com "reduzir movimento" ligado e enquanto o 3D não chegou. A roda é enfeite: aria-hidden,
// o título e o texto dizem tudo.
//
// Para levar a um site: copie esta seção para _gerador/secoes/, a pasta site/assets/3d/ inteira
// para o site e o <link>/<script> do fim da seção. Troque a roda pela forma da marca da pessoa
// em raio-3d.js e no desenho de reserva abaixo (a mesma roda, na mesma pose da cena parada).

const RAIOS = 32;
// A pose da roda parada e a câmera: a cena 3D (raio-3d.js) lê daqui (data-3d-pose), e a reserva é
// desenhada com as mesmas contas. Assim o desenho parado e o 3D parado são a mesma roda.
const POSE = Object.freeze({ giro: -0.42, inclina: 0.16, distancia: 4.9, fov: 0.5 });

// As contas de girar iguais às do motor (cena-3d.js): eixo X e eixo Y.
const girarX = (a, [x, y, z]) => [x, Math.cos(a) * y - Math.sin(a) * z, Math.sin(a) * y + Math.cos(a) * z];
const girarY = (a, [x, y, z]) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
// Um ponto da roda (eixo em pé, como na cena) até o desenho de 240 x 240, pela câmera da cena.
function naTela(p) {
  const [x, y, z] = girarX(POSE.inclina, girarY(POSE.giro, girarX(Math.PI / 2, p)));
  const f = 1 / Math.tan(POSE.fov / 2);
  const longe = POSE.distancia - z;
  return [120 + ((f * x) / longe) * 120, 120 - ((f * y) / longe) * 120];
}
const caminho = (pontos) => `M${pontos.map((p) => naTela(p).map((v) => v.toFixed(1)).join(' ')).join('L')}`;
function volta(raio, altura, lados = 120) {
  const pontos = [];
  for (let i = 0; i <= lados; i += 1) {
    const a = (i / lados) * Math.PI * 2;
    pontos.push([Math.cos(a) * raio, altura, Math.sin(a) * raio]);
  }
  return `${caminho(pontos)}Z`;
}

// O desenho de reserva da roda: as mesmas peças da cena (pneu, faixa, aro, raios, cubo).
function rodaDeReserva() {
  const raios = [];
  for (let i = 0; i < RAIOS; i += 1) {
    const lado = i % 2 === 0 ? 1 : -1;
    const noCubo = (i / RAIOS) * Math.PI * 2;
    const noAro = noCubo + (i % 4 < 2 ? 0.4 : -0.4);
    raios.push(caminho([
      [Math.cos(noCubo) * 0.098, 0.072 * lado, Math.sin(noCubo) * 0.098],
      [Math.cos(noAro) * 0.905, 0.01 * lado, Math.sin(noAro) * 0.905],
    ]));
  }
  return `<svg class="palco-3d__reserva roda-reserva" viewBox="0 0 240 240" width="240" height="240" aria-hidden="true" focusable="false">
      <path class="roda-reserva__pneu" d="${volta(1, 0)}" />
      <path class="roda-reserva__faixa" d="${volta(1, 0.0598)}" />
      <path class="roda-reserva__aro" d="${volta(0.925, 0)}" />
      <path class="roda-reserva__raios" d="${raios.join('')}" />
      <path class="roda-reserva__cubo" d="${caminho([[0, -0.11, 0], [0, 0.11, 0]])}" />
    </svg>`;
}

export default function abertura3d({ esc, link, assets }) {
  const linhas = [
    ['fina', 'Bicicleta'],
    ['pesada', 'no ponto,'],
    ['media', 'pronta no'],
    ['luz', 'mesmo dia.'],
  ];
  return `<section class="abertura abertura--3d" data-secao="abertura" data-molde="abertura-3d" aria-labelledby="abertura-titulo">
  <link rel="stylesheet" href="${assets}3d/3d.css">
  <div class="envelope abertura__grade">
    <h1 class="assinatura" id="abertura-titulo" data-assina>
      ${linhas.map(([peso, texto]) => `<span class="assinatura__linha assinatura__linha--${peso}">${esc(texto)}</span>`).join('\n      ')}
    </h1>
    <div class="abertura__lado">
      <p class="sobretitulo">Oficina de bicicletas na Vila Exemplo</p>
      <p class="abertura__lide">${esc('Revisão, freio, câmbio e câmara, em bicicleta de qualquer marca. O preço vem antes do serviço.')}</p>
      <div class="acoes">
        <a class="botao" href="tel:+551100000000">Agendar: (11) 0000-0000</a>
        <a class="botao-linha" href="${link('monte')}">Monte a sua caramanhola</a>
      </div>
    </div>
    <div class="palco-3d marca-3d" id="raio" data-3d="raio" data-3d-estado="reserva" data-3d-pose="${esc(JSON.stringify(POSE))}" aria-hidden="true">
      ${rodaDeReserva()}
    </div>
  </div>
  <script src="${assets}3d/3d.js" defer></script>
</section>`;
}
