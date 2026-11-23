// A página "antes e depois": o site como estava (antes/) e como ficou (depois/), lado a lado, no
// mesmo tamanho de tela (computador ou celular, a pessoa escolhe com dois botões), com as mudanças
// numeradas no alto. Rolar ou navegar num lado leva o outro junto. Gerada pelo "comparar" em
// sites/<nome>/revisao/antes-depois/index.html (fora de site/: nunca vai para o ar).
import { ESTILO_BASE, SCRIPT_BASE, CELULAR, COMPUTADOR, esc } from './previa.mjs';

const ESTILO = `
.mudancas{list-style:none;margin:0;padding:14px 28px 4px;display:flex;gap:28px;flex-wrap:wrap;counter-reset:m}
.mudancas li{counter-increment:m;display:flex;gap:10px;max-width:440px;font-size:14px;color:var(--apoio)}
.mudancas li::before{content:counter(m);flex:none;width:26px;height:26px;border-radius:50%;background:var(--realce);color:#1a1206;
  font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.mudancas strong{display:block;color:var(--tinta);font-weight:600}
main{gap:40px}
figcaption{font-size:14px;letter-spacing:.12em;text-transform:uppercase}
.depois figcaption b{color:var(--realce)}
`;

function itens(mudancas) {
  return mudancas
    .map((m) => `<li><span><strong>${esc(m.titulo)}</strong>${m.porque ? esc(m.porque) : ''}</span></li>`)
    .join('\n');
}

export function paginaDeComparacao({ pedido, mudancas }) {
  const titulo = pedido ? `Você pediu: ${esc(pedido)}` : 'O que mudou';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Antes e depois</title>
<style>${ESTILO_BASE}${ESTILO}</style>
</head>
<body>
<header>
  <div class="titulo"><span class="rotulo">Antes e depois</span><h1>${titulo}</h1></div>
  <div class="acoes" role="group" aria-label="Tamanho de tela">
    <button type="button" data-modo="computador" aria-pressed="true">Computador</button>
    <button type="button" data-modo="celular" aria-pressed="false">Celular</button>
  </div>
</header>
<ol class="mudancas" aria-label="O que mudou">
${itens(mudancas)}
</ol>
<main>
  <figure class="antes computador">
    <div class="tela"><iframe id="antes" src="antes/" title="O site antes da mudança"></iframe></div>
    <figcaption><b>Antes</b></figcaption>
  </figure>
  <figure class="depois computador">
    <div class="tela"><iframe id="depois" src="depois/" title="O site depois da mudança"></iframe></div>
    <figcaption><b>Depois</b></figcaption>
  </figure>
</main>
<script>
${SCRIPT_BASE}
var TAMANHOS = { computador: [${COMPUTADOR.largura}, ${COMPUTADOR.altura}], celular: [${CELULAR.largura}, ${CELULAR.altura}] };
var antes = document.getElementById('antes'), depois = document.getElementById('depois');
var modo = window.innerWidth <= 900 ? 'celular' : 'computador';
var movendo = false;
function encaixar() {
  var t = TAMANHOS[modo];
  var figuras = document.querySelectorAll('figure');
  for (var i = 0; i < figuras.length; i += 1) figuras[i].className = figuras[i].className.split(' ')[0] + ' ' + modo;
  var botoes = document.querySelectorAll('[data-modo]');
  for (var k = 0; k < botoes.length; k += 1) botoes[k].setAttribute('aria-pressed', String(botoes[k].dataset.modo === modo));
  var empilhado = window.innerWidth <= 760;
  var topo = document.querySelector('header').offsetHeight + document.querySelector('.mudancas').offsetHeight;
  var alto = window.innerHeight - topo - 110;
  var largo = empilhado ? window.innerWidth - 32 : (window.innerWidth - 56 - 40) / 2;
  var escala = Math.max(0.15, Math.min(1, largo / t[0], empilhado ? 1 : alto / t[1]));
  [antes, depois].forEach(function (f) { f.dataset.largura = t[0]; f.dataset.altura = t[1]; aplicarEscala(f, escala); });
}
// o outro lado: /antes/x/ vira /depois/x/ e vice-versa
function espelho(caminho, de, para) {
  return caminho.indexOf('/' + de + '/') === 0 ? '/' + para + '/' + caminho.slice(de.length + 2) : null;
}
function ligar(origem, outro, de, para) {
  origem.addEventListener('load', function () {
    if (modo === 'celular') esconderBarraDeRolagem(origem);
    var c = caminhoDe(origem);
    if (c === null) return;
    var alvo = espelho(c, de, para);
    if (alvo && caminhoDe(outro) !== alvo) outro.contentWindow.location.replace(alvo);
    origem.contentWindow.addEventListener('scroll', function () {
      if (movendo) return;
      var a = origem.contentDocument.documentElement, b = outro.contentDocument.documentElement;
      var fracao = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
      movendo = true;
      outro.contentWindow.scrollTo(0, fracao * (b.scrollHeight - b.clientHeight));
      window.requestAnimationFrame(function () { movendo = false; });
    });
  });
}
ligar(antes, depois, 'antes', 'depois');
ligar(depois, antes, 'depois', 'antes');
var botoes = document.querySelectorAll('[data-modo]');
for (var i = 0; i < botoes.length; i += 1) {
  botoes[i].addEventListener('click', function (e) { modo = e.currentTarget.dataset.modo; encaixar(); });
}
window.addEventListener('resize', encaixar);
encaixar();
</script>
</body>
</html>
`;
}
