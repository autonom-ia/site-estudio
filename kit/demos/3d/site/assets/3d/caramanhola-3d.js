/* Cena do configurador: a caramanhola gira devagar no palco e muda na hora com cada escolha
   (cor, acabamento, faixa refletiva). Arrastar com o dedo ou o mouse gira para os lados e mostra
   o que a foto de frente não mostra: a rodinha raiada da marca, gravada num lado só.
   A forma vem do mesmo perfil que desenha a imagem de reserva (data-3d-perfil, data-3d-tampa,
   data-3d-faixa e data-3d-emblema), então a reserva e o 3D mostram a mesma peça. Escolhas:
   atributos dos botões de rádio (data-cor, data-tom, data-brilho, data-faixa). A peça fica de pé
   numa bancada (tampo e linha do fundo), a mesma da reserva. A pose de repouso (data-3d-pose) é a
   do desenho de reserva: o giro do começo termina exatamente nela. */
(function () {
  'use strict';
  var GIRO_SOZINHO = 1.0; // radianos: quanto a peça gira sozinha até chegar ao repouso
  // Gira sozinha só nos primeiros segundos (mostra que é 3D) e para: movimento que ninguém pediu
  // não passa de 5 s (WCAG 2.2.2). Depois, só gira quando a pessoa arrasta.
  var GIRO_SOZINHO_MS = 4500;
  // Câmera: a mesma do desenho de reserva (data-3d-pose: distância e direção do olhar), para a
  // reserva e o 3D parado terem a peça do mesmo tamanho, no mesmo lugar.
  var TROCA_MS = 320; // duração da troca de cor e de acabamento

  function lerJson(texto, reserva) {
    try {
      return JSON.parse(texto);
    } catch (e) {
      return reserva;
    }
  }

  // A rodinha gravada: aro e raios colados na superfície do corpo, num lado só (de frente para
  // quem olha quando o giro é zero). raioCorpo: o raio do corpo na altura da rodinha.
  function emblema(C, e, raioCorpo) {
    var R = raioCorpo + 0.006;
    var lado = Math.PI / 2;
    var noCorpo = function (u, v) {
      var a = lado - u / R;
      return [Math.cos(a) * R, e.altura + v, Math.sin(a) * R];
    };
    var pecas = [];
    var voltas = 32;
    for (var i = 0; i < voltas; i += 1) {
      var a0 = (i / voltas) * Math.PI * 2;
      var a1 = ((i + 1) / voltas) * Math.PI * 2;
      pecas.push(C.formas.tubo(noCorpo(Math.cos(a0) * e.raio, Math.sin(a0) * e.raio), noCorpo(Math.cos(a1) * e.raio, Math.sin(a1) * e.raio), 0.009, 6));
    }
    for (var k = 0; k < e.raios; k += 1) {
      var a = (k / e.raios) * Math.PI * 2;
      pecas.push(C.formas.tubo(noCorpo(0, 0), noCorpo(Math.cos(a) * e.raio, Math.sin(a) * e.raio), 0.006, 5));
    }
    return C.formas.juntar(pecas);
  }

  // raio do perfil numa altura (o perfil sobe de baixo para cima)
  function raioNa(perfil, altura) {
    for (var i = 1; i < perfil.length; i += 1) {
      if (perfil[i][1] >= altura && perfil[i - 1][1] <= altura && perfil[i][1] !== perfil[i - 1][1]) {
        var t = (altura - perfil[i - 1][1]) / (perfil[i][1] - perfil[i - 1][1]);
        return perfil[i - 1][0] + (perfil[i][0] - perfil[i - 1][0]) * t;
      }
    }
    return perfil[perfil.length - 1][0];
  }

  function montar(palco, C) {
    var form = document.querySelector('[data-3d-opcoes="' + palco.id + '"]');
    var perfil = lerJson(palco.getAttribute('data-3d-perfil'), null);
    var tampa = lerJson(palco.getAttribute('data-3d-tampa'), null);
    var faixa = lerJson(palco.getAttribute('data-3d-faixa'), null);
    var marca = lerJson(palco.getAttribute('data-3d-emblema'), null);
    // a pose de repouso e a câmera (giro, alvo, olhar, distância, fov)
    var pose = lerJson(palco.getAttribute('data-3d-pose'), null);
    if (pose && !(Array.isArray(pose.alvo) && Array.isArray(pose.olhar) && pose.distancia > 0)) pose = null;
    if (!form || !perfil || !tampa || !faixa || !marca || !pose) throw new Error('faltam os dados da peça no palco (data-3d-perfil, -tampa, -faixa, -emblema, -pose) ou o formulário de escolhas');
    var cena = C.criar(palco, { fov: pose.fov || 0.5 });
    if (!cena) return null;

    var altura = tampa[tampa.length - 1][1];
    var meio = altura / 2;
    var corpo = cena.objeto(C.formas.torno(perfil, 96), { cor: '#2B3035', brilho: 0.15 });
    var topo = cena.objeto(C.formas.torno(tampa, 48), { cor: C.corDaMarca(palco, '--cor-tinta', '#14181B'), brilho: 0.45 });
    var tira = cena.objeto(C.formas.torno(faixa, 96), { cor: '#C9CED1', brilho: 1, metal: 0.3, acende: 0.12 });
    var gravada = cena.objeto(emblema(C, marca, raioNa(perfil, marca.altura)), { cor: '#E6E9E4', brilho: 0.3 });
    var tinta = C.corDaMarca(palco, '--cor-tinta', '#14181B');
    var claro = C.corDaMarca(palco, '--cor-fundo', '#ECEEEA');
    // a bancada: o tampo (do fundo, z -0,25, até a frente) e a linha do fundo, na altura do tampo
    // acende: a luz da cena escurece o tampo; com ela, ele sai no tom de --cor-fundo-2, como na reserva
    var tampo = cena.objeto(C.formas.plano(-40, 40, -0.25, 1.5), { cor: C.corDaMarca(palco, '--cor-fundo-2', '#DFE3DC'), brilho: 0, acende: 0.5, chao: true });
    var bancada = cena.objeto(C.formas.tubo([-40, 0, -0.25], [40, 0, -0.25], 0.005, 6), { cor: C.misturar(tinta, claro, 0.55), brilho: 0 });

    cena.camera.alvo = pose.alvo;
    var t = Math.hypot(pose.olhar[0], pose.olhar[1], pose.olhar[2]);
    cena.camera.olho = pose.olhar.map(function (v, i) { return pose.alvo[i] + (v / t) * pose.distancia; });
    cena.luz.ceu = C.cor('#FFFFFF');
    cena.luz.chao = C.corDaMarca(palco, '--cor-fundo-2', '#DFE3DC');
    cena.luz.direcao = [-0.7, 1.0, 0.9];
    cena.luz.forca = 0.9;
    cena.chao([0, -meio, 0], [0.82, 0.82], 0.5, C.corDaMarca(palco, '--cor-tinta', '#14181B'));

    // estado da peça: o atual anima até o alvo
    var alvo = { cor: corpo.material.cor, brilho: 0.15, faixa: true, marca: gravada.material.cor };
    var atual = { cor: alvo.cor, brilho: alvo.brilho, marca: alvo.marca };
    var troca = null;
    function lerEscolha() {
      var marcado = function (nome) { return form.querySelector('input[name="' + nome + '"]:checked'); };
      var c = marcado('cor');
      var a = marcado('acabamento');
      var f = marcado('faixa');
      if (c) alvo.cor = C.cor(c.getAttribute('data-cor'));
      // rodinha clara nas cores escuras e escura nas claras
      if (c) alvo.marca = c.getAttribute('data-tom') === 'claro' ? tinta : claro;
      if (a) alvo.brilho = Number(a.getAttribute('data-brilho')) || 0;
      if (f) alvo.faixa = f.getAttribute('data-faixa') === 'sim';
      troca = { inicio: performance.now(), cor: atual.cor, brilho: atual.brilho, marca: atual.marca };
      tira.visivel = alvo.faixa;
      cena.acordar();
    }
    cena.ouvir(form, 'change', lerEscolha);
    lerEscolha();
    atual.cor = alvo.cor;
    atual.brilho = alvo.brilho;
    atual.marca = alvo.marca;
    troca = null;

    // giro: sozinho no começo, terminando exatamente na pose de repouso; arrastar gira na mão
    var repouso = Number(pose.giro) || 0;
    var angulo = repouso - GIRO_SOZINHO;
    var inclinacao = 0;
    var arrastando = null;
    var mexeu = false;
    var inicio = performance.now();
    cena.ouvir(cena.tela, 'pointerdown', function (e) {
      arrastando = { x: e.clientX, y: e.clientY, angulo: angulo, inclinacao: inclinacao };
      mexeu = true;
      cena.tela.setPointerCapture(e.pointerId);
      cena.acordar();
    });
    cena.ouvir(cena.tela, 'pointermove', function (e) {
      if (!arrastando) return;
      angulo = arrastando.angulo + (e.clientX - arrastando.x) * 0.012;
      inclinacao = Math.max(-0.35, Math.min(0.35, arrastando.inclinacao + (e.clientY - arrastando.y) * 0.006));
      cena.acordar();
    });
    var soltar = function () {
      arrastando = null;
      cena.acordar();
    };
    cena.ouvir(cena.tela, 'pointerup', soltar);
    cena.ouvir(cena.tela, 'pointercancel', soltar);

    cena.animar(function (t) {
      // conta pelo tempo, não por quadro: no fim do prazo o ângulo é o repouso, exato
      var k = Math.min(1, Math.max(0, (t - inicio) / GIRO_SOZINHO_MS));
      var girando = !mexeu && k < 1;
      if (!mexeu) angulo = repouso - GIRO_SOZINHO * Math.pow(1 - k, 3);
      if (!arrastando) inclinacao *= 0.92;
      if (troca) {
        var kt = Math.min(1, (t - troca.inicio) / TROCA_MS);
        var suave = kt * kt * (3 - 2 * kt);
        atual.cor = C.misturar(troca.cor, alvo.cor, suave);
        atual.marca = C.misturar(troca.marca, alvo.marca, suave);
        atual.brilho = troca.brilho + (alvo.brilho - troca.brilho) * suave;
        if (kt >= 1) troca = null;
      }
      corpo.material.cor = atual.cor;
      corpo.material.brilho = atual.brilho;
      gravada.material.cor = atual.marca;
      gravada.material.brilho = atual.brilho * 0.6;
      var m = C.matriz.compor(C.matriz.girarX(inclinacao), C.matriz.girarY(angulo), C.matriz.mover(0, -meio, 0));
      corpo.matriz = m;
      topo.matriz = m;
      tira.matriz = m;
      gravada.matriz = m;
      bancada.matriz = C.matriz.mover(0, -meio, 0);
      tampo.matriz = bancada.matriz;
      // parada (sem giro, sem arrasto, sem troca), a cena dorme até a próxima escolha
      return girando || Boolean(arrastando) || troca !== null || Math.abs(inclinacao) > 0.001;
    });
    return cena;
  }

  window.Cena3D.cenas.caramanhola = montar;
})();
