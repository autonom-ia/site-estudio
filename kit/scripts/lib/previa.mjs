// A prévia lado a lado: o site no tamanho de computador (1440 x 900) e no de celular (390 x 844),
// na mesma tela, cada um numa moldura em escala que cabe na janela. A pessoa não precisa mexer na
// janela para ver o celular. Mora no servidor do "abrir", na rota /__previa/, e nunca entra na
// pasta site/ (não vai para o ar). Navegar num tamanho leva o outro junto para a mesma página.
// Sem endereço de fora, sem expressão regular, sem <select>.

export const ROTA_DA_PREVIA = '/__previa/';
export const CELULAR = Object.freeze({ largura: 390, altura: 844 });
export const COMPUTADOR = Object.freeze({ largura: 1440, altura: 900 });

// Texto seguro dentro de HTML (para o que vem da pessoa ou do assistente).
export function esc(texto) {
  const trocas = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return [...String(texto)].map((ch) => trocas[ch] || ch).join('');
}

// Estilo comum à prévia e ao antes e depois: fundo escuro e quente, para o site ser a única luz.
export const ESTILO_BASE = `
:root{color-scheme:dark;--fundo:#121110;--tinta:#efe9df;--apoio:#a59e92;--linha:#2b2926;--realce:#f2b24c}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:radial-gradient(120% 90% at 50% -10%,#24211d 0%,var(--fundo) 62%);color:var(--tinta);
  font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 28px;border-bottom:1px solid var(--linha)}
.titulo{display:flex;align-items:baseline;gap:14px;min-width:0}
.rotulo{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--apoio);white-space:nowrap}
h1{font-size:18px;font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acoes{display:flex;gap:8px;flex-wrap:wrap}
.acoes a,.acoes button{font:inherit;font-size:14px;color:var(--tinta);background:transparent;border:1px solid #3d3a35;
  border-radius:999px;padding:0 18px;min-height:44px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.acoes a:hover,.acoes button:hover{border-color:var(--tinta)}
.acoes button[aria-pressed="true"]{background:var(--tinta);color:var(--fundo);border-color:var(--tinta)}
:focus-visible{outline:2px solid var(--realce);outline-offset:3px}
main{flex:1;display:flex;align-items:center;justify-content:center;gap:56px;padding:20px 28px 24px;min-height:0}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:12px}
figcaption{font-size:13px;color:var(--apoio);letter-spacing:.05em}
figcaption b{color:var(--tinta);font-weight:600}
.tela{position:relative;overflow:hidden;background:#fff}
.tela iframe{border:0;position:absolute;top:0;left:0;transform-origin:0 0;background:#fff}
.computador .tela{border-radius:10px;box-shadow:0 0 0 1px #34312c,0 40px 90px -40px #000}
.celular .tela{border-radius:38px;box-shadow:0 0 0 9px #070707,0 0 0 10px #3a3732,0 40px 90px -40px #000}
@media (max-width:760px){body{overflow:auto}main{flex-direction:column;gap:32px}header{flex-wrap:wrap;padding:12px 16px}}
`;

// Encaixe e navegação comuns: cada moldura tem data-largura e data-altura; a escala cabe na janela.
export const SCRIPT_BASE = `
function aplicarEscala(frame, escala) {
  var largura = Number(frame.dataset.largura), altura = Number(frame.dataset.altura);
  frame.style.width = largura + 'px';
  frame.style.height = altura + 'px';
  frame.style.transform = 'scale(' + escala + ')';
  frame.parentElement.style.width = Math.round(largura * escala) + 'px';
  frame.parentElement.style.height = Math.round(altura * escala) + 'px';
}
function caminhoDe(frame) {
  try { var l = frame.contentWindow.location; return l.pathname + l.search; } catch (e) { return null; }
}
function esconderBarraDeRolagem(frame) {
  try {
    var d = frame.contentDocument, s = d.createElement('style');
    s.textContent = 'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
    d.head.appendChild(s);
  } catch (e) {}
}
`;

export function paginaDaPrevia() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prévia do site</title>
<style>${ESTILO_BASE}</style>
</head>
<body>
<header>
  <div class="titulo"><span class="rotulo">Prévia</span><h1 id="titulo">O seu site</h1></div>
  <div class="acoes">
    <button type="button" id="recarregar">Recarregar</button>
    <a id="sozinho" href="/" target="_blank" rel="noopener">Abrir só o site</a>
  </div>
</header>
<main>
  <figure class="computador">
    <div class="tela"><iframe id="pc" src="/" title="O site no tamanho de computador" data-largura="${COMPUTADOR.largura}" data-altura="${COMPUTADOR.altura}"></iframe></div>
    <figcaption><b>Computador</b> · <span class="pagina">Página inicial</span></figcaption>
  </figure>
  <figure class="celular">
    <div class="tela"><iframe id="cel" src="/" title="O site no tamanho de celular" data-largura="${CELULAR.largura}" data-altura="${CELULAR.altura}"></iframe></div>
    <figcaption><b>Celular</b> · <span class="pagina">Página inicial</span></figcaption>
  </figure>
</main>
<script>
${SCRIPT_BASE}
var pc = document.getElementById('pc'), cel = document.getElementById('cel');
var atual = '/';
function encaixar() {
  var empilhado = window.innerWidth <= 760;
  // reserva: legenda, respiro e a borda do celular
  var alto = window.innerHeight - document.querySelector('header').offsetHeight - 116;
  var largoUtil = window.innerWidth - 56 - 56;
  var eCel = empilhado ? Math.min(0.8, (window.innerWidth - 32) / ${CELULAR.largura}) : Math.min(1, alto / ${CELULAR.altura});
  var ePc = empilhado ? (window.innerWidth - 32) / ${COMPUTADOR.largura}
    : Math.min(alto / ${COMPUTADOR.altura}, (largoUtil - ${CELULAR.largura} * eCel) / ${COMPUTADOR.largura});
  aplicarEscala(cel, eCel);
  aplicarEscala(pc, Math.max(0.2, ePc));
}
function nomeDaPagina(caminho) { return caminho === '/' ? 'Página inicial' : caminho; }
function aoCarregar(origem, outro) {
  return function () {
    if (origem === cel) esconderBarraDeRolagem(cel);
    var c = caminhoDe(origem);
    if (c === null) return;
    try { document.getElementById('titulo').textContent = origem.contentDocument.title || 'O seu site'; } catch (e) {}
    var rotulos = document.querySelectorAll('.pagina');
    for (var i = 0; i < rotulos.length; i += 1) rotulos[i].textContent = nomeDaPagina(c);
    document.getElementById('sozinho').href = c;
    if (c !== atual) { atual = c; if (caminhoDe(outro) !== c) outro.contentWindow.location.replace(c); }
  };
}
pc.addEventListener('load', aoCarregar(pc, cel));
cel.addEventListener('load', aoCarregar(cel, pc));
document.getElementById('recarregar').addEventListener('click', function () {
  pc.contentWindow.location.reload();
  cel.contentWindow.location.reload();
});
window.addEventListener('resize', encaixar);
encaixar();
</script>
</body>
</html>
`;
}
