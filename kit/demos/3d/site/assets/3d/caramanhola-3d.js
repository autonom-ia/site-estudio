/* Cena do configurador: a caramanhola gira devagar no palco e muda na hora com cada escolha
   (cor, acabamento, faixa refletiva). Arrastar com o dedo ou o mouse gira para os lados.
   A forma vem do mesmo perfil que desenha a imagem de reserva (data-3d-perfil e data-3d-tampa),
   então a reserva e o 3D mostram a mesma peça. Escolhas: atributos dos botões de rádio
   (data-cor, data-brilho, data-faixa). */
(function () {
  'use strict';
  var GIRO_SOZINHO = 0.22; // radianos por segundo: um giro lento, que mostra o volume
  var VOLTA_A_GIRAR_MS = 2500; // depois de soltar, espera antes de voltar a girar sozinho
  var TROCA_MS = 320; // duração da troca de cor e de acabamento

  function lerJson(texto, reserva) {
    try {
      return JSON.parse(texto);
    } catch (e) {
      return reserva;
    }
  }

  function montar(palco, C) {
    var form = document.querySelector('[data-3d-opcoes="' + palco.id + '"]');
    var perfil = lerJson(palco.getAttribute('data-3d-perfil'), null);
    var tampa = lerJson(palco.getAttribute('data-3d-tampa'), null);
    var faixa = lerJson(palco.getAttribute('data-3d-faixa'), null);
    if (!form || !perfil || !tampa || !faixa) return null;
    var cena = C.criar(palco, { fov: 0.5 });
    if (!cena) return null;

    var altura = tampa[tampa.length - 1][1];
    var meio = altura / 2;
    var corpo = cena.objeto(C.formas.torno(perfil, 72), { cor: '#2B3035', brilho: 0.15 });
    var topo = cena.objeto(C.formas.torno(tampa, 48), { cor: C.corDaMarca(palco, '--cor-tinta', '#14181B'), brilho: 0.45 });
    var tira = cena.objeto(C.formas.torno(faixa, 72), { cor: '#DCE1E4', brilho: 1, metal: 0.7, acende: 0.22 });

    cena.camera.olho = [0, 0.55, 5.6];
    cena.camera.alvo = [0, 0.02, 0];
    cena.luz.ceu = C.cor('#FFFFFF');
    cena.luz.chao = C.corDaMarca(palco, '--cor-fundo-2', '#DFE3DC');
    cena.luz.direcao = [-0.7, 1.0, 0.9];
    cena.luz.forca = 1.05;
    cena.chao([0, -meio, 0], [0.82, 0.82], 0.5, C.corDaMarca(palco, '--cor-tinta', '#14181B'));

    // estado da peça: o atual anima até o alvo
    var alvo = { cor: corpo.material.cor, brilho: 0.15, faixa: true };
    var atual = { cor: alvo.cor, brilho: alvo.brilho };
    var troca = null;
    function lerEscolha() {
      var marcado = function (nome) { return form.querySelector('input[name="' + nome + '"]:checked'); };
      var c = marcado('cor');
      var a = marcado('acabamento');
      var f = marcado('faixa');
      if (c) alvo.cor = C.cor(c.getAttribute('data-cor'));
      if (a) alvo.brilho = Number(a.getAttribute('data-brilho')) || 0;
      if (f) alvo.faixa = f.getAttribute('data-faixa') === 'sim';
      troca = { inicio: performance.now(), cor: atual.cor, brilho: atual.brilho };
      tira.visivel = alvo.faixa;
      cena.acordar();
    }
    form.addEventListener('change', lerEscolha);
    lerEscolha();
    atual.cor = alvo.cor;
    atual.brilho = alvo.brilho;
    troca = null;

    // giro: sozinho, devagar; arrastar gira na mão
    var angulo = -0.5;
    var inclinacao = 0;
    var arrastando = null;
    var soltouEm = 0;
    var ultimo = 0;
    cena.tela.addEventListener('pointerdown', function (e) {
      arrastando = { x: e.clientX, y: e.clientY, angulo: angulo, inclinacao: inclinacao };
      cena.tela.setPointerCapture(e.pointerId);
      cena.acordar();
    });
    cena.tela.addEventListener('pointermove', function (e) {
      if (!arrastando) return;
      angulo = arrastando.angulo + (e.clientX - arrastando.x) * 0.012;
      inclinacao = Math.max(-0.35, Math.min(0.35, arrastando.inclinacao + (e.clientY - arrastando.y) * 0.006));
      cena.acordar();
    });
    var soltar = function () {
      arrastando = null;
      soltouEm = performance.now();
      cena.acordar();
    };
    cena.tela.addEventListener('pointerup', soltar);
    cena.tela.addEventListener('pointercancel', soltar);

    cena.animar(function (t) {
      var dt = ultimo ? Math.min(0.05, (t - ultimo) / 1000) : 0;
      ultimo = t;
      if (!arrastando && t - soltouEm > VOLTA_A_GIRAR_MS) angulo += GIRO_SOZINHO * dt;
      if (!arrastando) inclinacao *= 0.92;
      if (troca) {
        var k = Math.min(1, (t - troca.inicio) / TROCA_MS);
        var suave = k * k * (3 - 2 * k);
        atual.cor = C.misturar(troca.cor, alvo.cor, suave);
        atual.brilho = troca.brilho + (alvo.brilho - troca.brilho) * suave;
        if (k >= 1) troca = null;
      }
      corpo.material.cor = atual.cor;
      corpo.material.brilho = atual.brilho;
      var m = C.matriz.compor(C.matriz.girarX(inclinacao), C.matriz.girarY(angulo), C.matriz.mover(0, -meio, 0));
      corpo.matriz = m;
      topo.matriz = m;
      tira.matriz = m;
      return true;
    });
    return cena;
  }

  window.Cena3D.cenas.caramanhola = montar;
})();
