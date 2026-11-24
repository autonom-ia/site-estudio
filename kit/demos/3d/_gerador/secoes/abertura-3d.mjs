// Demo "marca em 3D": a primeira tela do molde com a roda raiada da marca em 3D ao lado da
// assinatura. A roda rola quando a página rola e se inclina um pouco para o ponteiro (raio-3d.js).
// A imagem de reserva (o desenho parado da mesma roda) já vem na página: é o que aparece sem
// WebGL, com "reduzir movimento" ligado e enquanto o 3D não chegou. A roda é enfeite: aria-hidden,
// o título e o texto dizem tudo.
//
// Para levar a um site: copie esta seção para _gerador/secoes/, a pasta site/assets/3d/ inteira
// para o site e o <link>/<script> do fim da seção. Troque a roda pela forma da marca da pessoa
// em raio-3d.js e no desenho de reserva abaixo (o mesmo desenho, visto de frente).

const RAIOS = 32;

// O desenho de reserva da roda, de frente, nas mesmas medidas da cena (raio 1 = 100 unidades).
function rodaDeReserva() {
  const c = 120;
  const linhas = [];
  for (let i = 0; i < RAIOS; i += 1) {
    const noCubo = (i / RAIOS) * Math.PI * 2;
    const noAro = noCubo + (i % 4 < 2 ? 0.4 : -0.4);
    const p = (r, a) => `${(c + Math.cos(a) * r).toFixed(1)} ${(c + Math.sin(a) * r).toFixed(1)}`;
    linhas.push(`M${p(9.8, noCubo)}L${p(90.5, noAro)}`);
  }
  return `<svg class="palco-3d__reserva roda-reserva" viewBox="0 0 240 240" width="240" height="240" aria-hidden="true" focusable="false">
      <circle class="roda-reserva__pneu" cx="${c}" cy="${c}" r="100" />
      <circle class="roda-reserva__faixa" cx="${c}" cy="${c}" r="98" />
      <circle class="roda-reserva__aro" cx="${c}" cy="${c}" r="92.4" />
      <path class="roda-reserva__raios" d="${linhas.join('')}" />
      <circle class="roda-reserva__cubo" cx="${c}" cy="${c}" r="10.5" />
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
    <div class="palco-3d marca-3d" id="raio" data-3d="raio" data-3d-estado="reserva" aria-hidden="true">
      ${rodaDeReserva()}
    </div>
  </div>
  <script src="${assets}3d/3d.js" defer></script>
</section>`;
}
