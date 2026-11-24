/* Cena de identidade: a roda raiada da marca, no topo da página. Discreta de propósito:
   não gira sozinha; rola quando a página rola (como se andasse) e se inclina um pouco na direção
   do ponteiro. Parada, a cena dorme e não gasta bateria. As cores vêm da marca: o pneu é a tinta,
   o aro e os raios são metal, e a faixa refletiva é a cor de luz (--cor-luz). */
(function () {
  'use strict';
  var RAIOS = 32;
  var ROLAR = 0.0032; // radianos por pixel rolado
  var REPOUSO = { giro: -0.42, inclina: 0.16 }; // de leve de lado: dá para ver a profundidade
  var ALCANCE = { giro: 0.28, inclina: 0.18 }; // quanto o ponteiro inclina a roda
  var SUAVE = 0.08; // quanto anda até o alvo a cada quadro

  function montar(palco, C) {
    var cena = C.criar(palco, { fov: 0.5 });
    if (!cena) return null;
    var F = C.formas;
    var tinta = C.corDaMarca(palco, '--cor-noite-2', '#1B2025');
    var metal = C.misturar(C.corDaMarca(palco, '--cor-apoio-noite', '#A8B0B6'), [1, 1, 1], 0.25);
    var luz = C.corDaMarca(palco, '--cor-luz', '#D4F04F');

    var pneu = cena.objeto(F.anel(1.0, 0.058, 160, 16), { cor: tinta, brilho: 0.35 });
    var faixa = cena.objeto(F.juntar([
      F.torno([[0.988, 0.0598], [1.012, 0.0598]], 160),
      F.torno([[0.988, -0.0598], [1.012, -0.0598]], 160),
    ]), { cor: luz, brilho: 0.6, acende: 0.32 });
    var aro = cena.objeto(F.torno([
      [0.9, -0.022], [0.9, -0.022], [0.948, -0.03], [0.948, -0.03], [0.948, 0.03], [0.948, 0.03], [0.9, 0.022], [0.9, 0.022], [0.9, -0.022],
    ], 160), { cor: metal, brilho: 0.85, metal: 0.9 });
    var cubo = cena.objeto(F.torno([
      [0, -0.13], [0.028, -0.13], [0.028, -0.13], [0.028, -0.085], [0.105, -0.08], [0.105, -0.064], [0.045, -0.058],
      [0.045, 0.058], [0.105, 0.064], [0.105, 0.08], [0.028, 0.085], [0.028, 0.13], [0.028, 0.13], [0, 0.13],
    ], 40), { cor: metal, brilho: 0.8, metal: 0.9 });
    var lista = [];
    for (var i = 0; i < RAIOS; i += 1) {
      var lado = i % 2 === 0 ? 1 : -1;
      var noCubo = (i / RAIOS) * Math.PI * 2;
      var noAro = noCubo + (i % 4 < 2 ? 0.4 : -0.4);
      lista.push(F.tubo(
        [Math.cos(noCubo) * 0.098, 0.072 * lado, Math.sin(noCubo) * 0.098],
        [Math.cos(noAro) * 0.905, 0.01 * lado, Math.sin(noAro) * 0.905],
        0.0065,
        6,
      ));
    }
    var raios = cena.objeto(F.juntar(lista), { cor: metal, brilho: 0.75, metal: 0.8 });
    var partes = [pneu, faixa, aro, cubo, raios];

    cena.camera.olho = [0, 0, 4.9];
    cena.camera.alvo = [0, 0, 0];
    cena.luz.ceu = C.corDaMarca(palco, '--cor-apoio-noite', '#A8B0B6');
    cena.luz.chao = C.corDaMarca(palco, '--cor-noite', '#111417');
    cena.luz.direcao = [-0.55, 0.85, 0.8];
    cena.luz.forca = 1.1;

    var alvo = { giro: REPOUSO.giro, inclina: REPOUSO.inclina, rola: 0 };
    var atual = { giro: alvo.giro, inclina: alvo.inclina, rola: 0 };
    var ler = function () { alvo.rola = -window.scrollY * ROLAR; };
    ler();
    atual.rola = alvo.rola;
    window.addEventListener('scroll', function () { ler(); cena.acordar(); }, { passive: true });
    // ponteiro de mouse ou caneta: a roda olha um pouco para ele (no toque, fica no repouso)
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var x = e.clientX / window.innerWidth - 0.5;
      var y = e.clientY / window.innerHeight - 0.5;
      alvo.giro = REPOUSO.giro + x * ALCANCE.giro * 2;
      alvo.inclina = REPOUSO.inclina + y * ALCANCE.inclina * 2;
      cena.acordar();
    }, { passive: true });

    cena.animar(function () {
      var falta = 0;
      ['giro', 'inclina', 'rola'].forEach(function (k) {
        var d = alvo[k] - atual[k];
        atual[k] += d * (k === 'rola' ? SUAVE * 1.6 : SUAVE);
        falta = Math.max(falta, Math.abs(d));
      });
      var m = C.matriz.compor(
        C.matriz.girarX(atual.inclina),
        C.matriz.girarY(atual.giro),
        C.matriz.girarX(Math.PI / 2),
        C.matriz.girarY(atual.rola),
      );
      partes.forEach(function (p) { p.matriz = m; });
      return falta > 0.0005;
    });
    return cena;
  }

  window.Cena3D.cenas.raio = montar;
})();
