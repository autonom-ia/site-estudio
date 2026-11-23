/* Site Estúdio: movimento do molde (GSAP + ScrollTrigger + Lenis, todos locais em assets/vendor/).
   Regra: sem JavaScript ou com "reduzir movimento" ligado no sistema, tudo já aparece no lugar.
   Nada começa escondido pelo CSS; quem esconde para animar é este arquivo, e só quando vai animar.
   Atributos que as seções usam:
     data-revela          entra subindo quando chega na tela (uma vez)
     data-assina          as linhas da assinatura do topo ganham peso uma a uma ao abrir a página
     data-conta="12"      o número conta de 0 até o valor com a rolagem
     data-acende          as palavras (<span>) acendem uma a uma com a rolagem */
(function () {
  'use strict';
  var raiz = document.documentElement;
  raiz.classList.add('js');
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gsap = window.gsap;
  if (reduzido || !gsap) return;

  var ScrollTrigger = window.ScrollTrigger;
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis) {
    var lenis = new window.Lenis({ autoRaf: true, anchors: true, lerp: 0.12 });
    window.__lenis = lenis;
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  }

  document.querySelectorAll('[data-assina]').forEach(function (assinatura) {
    var linhas = assinatura.children;
    gsap.from(linhas, { fontWeight: 100, y: 24, duration: 1.4, ease: 'power3.out', stagger: 0.14 });
  });

  if (!ScrollTrigger) return;

  gsap.utils.toArray('[data-revela]').forEach(function (el) {
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  document.querySelectorAll('[data-conta]').forEach(function (el) {
    var fim = Number(el.getAttribute('data-conta')) || 0;
    var estado = { v: 0 };
    el.textContent = '0';
    gsap.to(estado, {
      v: fim,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 35%', scrub: 0.6 },
      onUpdate: function () { el.textContent = String(Math.round(estado.v)); },
    });
  });

  document.querySelectorAll('[data-acende]').forEach(function (bloco) {
    var palavras = bloco.querySelectorAll('span');
    gsap.fromTo(palavras, { opacity: 0.2 }, {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: bloco, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
    });
  });
})();
