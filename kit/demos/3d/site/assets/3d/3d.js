/* Site Estúdio: carregador do 3D. É o único arquivo de 3D que a página baixa ao abrir (pequeno).
   Regras (kit/repertorio/como-usar.md, "3D: só com prova e com limite"):
   - o motor (cena-3d.js) e a cena (<nome>-3d.js) só são baixados quando o palco chega perto da tela;
   - com "reduzir movimento" ligado, sem WebGL ou se algo falhar, a imagem de reserva fica no lugar;
   - as escolhas de um configurador funcionam sem 3D: o resumo escrito e o pedido acompanham a escolha.
   Atributos:
     data-3d="<nome>"             o palco; baixa assets/3d/<nome>-3d.js (só letras minúsculas, números e hífen)
     data-3d-estado               reserva (imagem parada) | carregando | pronta (cena desenhada)
     data-3d-motivo               por que ficou na reserva: reduzir-movimento | sem-webgl | falhou |
                                  desenho-perdido | parada (sem motivo e na reserva = ainda não começou)
     data-3d-opcoes               o grupo de escolhas (um <form> com botões de rádio)
     data-3d-resumo               onde a escolha aparece escrita (com aria-live)
     data-3d-pedido               o link que leva a escolha (data-texto com {escolha}) */
(function () {
  'use strict';
  // duas seções com 3D na mesma página trazem este arquivo duas vezes: roda uma só
  if (window.__estudio3d) return;
  window.__estudio3d = true;
  var PERMITIDOS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
  var MARGEM = '300px 0px'; // começa a baixar um pouco antes de o palco aparecer

  var eu = document.currentScript;
  var base = eu && eu.src ? eu.src.slice(0, eu.src.lastIndexOf('/') + 1) : 'assets/3d/';
  var reduzir = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* ---------- escolhas (funcionam com ou sem 3D) ---------- */

  function resumoDe(form) {
    var partes = [];
    form.querySelectorAll('input:checked').forEach(function (i) {
      var t = i.getAttribute('data-resumo');
      if (t) partes.push(t);
    });
    return (form.getAttribute('data-3d-antes') || '') + partes.join(', ') + '.';
  }

  function atualizarEscolha(form) {
    var texto = resumoDe(form);
    var alvo = form.getAttribute('data-3d-opcoes');
    document.querySelectorAll('[data-3d-resumo="' + alvo + '"]').forEach(function (el) { el.textContent = texto; });
    document.querySelectorAll('[data-3d-pedido="' + alvo + '"]').forEach(function (a) {
      var modelo = a.getAttribute('data-texto') || '{escolha}';
      var href = a.getAttribute('href') || '';
      var corte = href.indexOf('?text=');
      if (corte === -1) return;
      a.setAttribute('href', href.slice(0, corte) + '?text=' + encodeURIComponent(modelo.split('{escolha}').join(texto)));
    });
  }

  document.querySelectorAll('[data-3d-opcoes]').forEach(function (form) {
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.addEventListener('change', function () { atualizarEscolha(form); });
    atualizarEscolha(form);
  });

  /* ---------- o palco 3D ---------- */

  var palcos = document.querySelectorAll('[data-3d]');
  if (!palcos.length) return;
  var nomeValido = function (n) {
    if (!n) return false;
    for (var i = 0; i < n.length; i += 1) if (PERMITIDOS.indexOf(n[i]) === -1) return false;
    return true;
  };
  var marcar = function (p, estado, motivo) {
    p.setAttribute('data-3d-estado', estado);
    if (motivo) p.setAttribute('data-3d-motivo', motivo);
  };
  palcos.forEach(function (p) { if (!p.hasAttribute('data-3d-estado')) marcar(p, 'reserva'); });
  if (reduzir && reduzir.matches) {
    palcos.forEach(function (p) { marcar(p, 'reserva', 'reduzir-movimento'); });
    return;
  }
  if (!('IntersectionObserver' in window) || !window.WebGLRenderingContext) {
    palcos.forEach(function (p) { marcar(p, 'reserva', 'sem-webgl'); });
    return;
  }
  // a montagem falhou no meio: avisa no console (o checar mostra) e devolve a reserva
  var falhou = function (palco, erro) {
    console.error('Site Estúdio 3D: a cena "' + palco.getAttribute('data-3d') + '" não abriu: ' + ((erro && erro.message) || erro));
    var feita = window.Cena3D && window.Cena3D.cenaDo ? window.Cena3D.cenaDo(palco) : null;
    if (feita) feita.parar('falhou');
    marcar(palco, 'reserva', 'falhou');
  };

  var baixados = {};
  function baixar(arquivo) {
    if (!baixados[arquivo]) {
      baixados[arquivo] = new Promise(function (ok, erro) {
        var s = document.createElement('script');
        s.src = base + arquivo;
        s.async = true;
        s.onload = ok;
        s.onerror = erro;
        document.head.appendChild(s);
      });
    }
    return baixados[arquivo];
  }

  var cenas = [];
  function iniciar(palco) {
    var nome = palco.getAttribute('data-3d');
    if (!nomeValido(nome)) return;
    marcar(palco, 'carregando');
    baixar('cena-3d.js')
      .then(function () { return baixar(nome + '-3d.js'); })
      .then(function () {
        var montar = window.Cena3D && window.Cena3D.cenas[nome];
        if (!montar) {
          falhou(palco, 'a cena não se registrou em ' + nome + '-3d.js');
          return;
        }
        var cena = null;
        try {
          cena = montar(palco, window.Cena3D);
        } catch (e) {
          falhou(palco, e);
          return;
        }
        if (!cena) {
          // sem WebGL (ou o desenho não compilou, já avisado pelo motor): a reserva fica
          var feita = window.Cena3D.cenaDo(palco);
          if (feita) feita.parar('falhou');
          marcar(palco, 'reserva', palco.getAttribute('data-3d-motivo') || 'sem-webgl');
          return;
        }
        cenas.push(cena);
        // "pronta" só depois do primeiro quadro desenhado (o motor marca ao desenhar)
        if (palco.getAttribute('data-3d-estado') !== 'pronta') cena.desenhar();
      })
      .catch(function (e) { falhou(palco, e || 'não baixou'); });
  }

  var vigia = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      vigia.unobserve(e.target);
      iniciar(e.target);
    });
  }, { rootMargin: MARGEM });
  palcos.forEach(function (p) { vigia.observe(p); });

  // "Reduzir movimento" ligado com a página aberta: a cena para e a imagem de reserva volta.
  if (reduzir && reduzir.addEventListener) {
    reduzir.addEventListener('change', function () {
      if (!reduzir.matches) return;
      vigia.disconnect();
      cenas.forEach(function (c) { c.parar('reduzir-movimento'); });
      palcos.forEach(function (p) { marcar(p, 'reserva', 'reduzir-movimento'); });
    });
  }
})();
