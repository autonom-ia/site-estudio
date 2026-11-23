// O momento mais forte da página, um só: a promessa em letra enorme, a frase que acende palavra por
// palavra com a rolagem e, logo abaixo, a ação principal. Sem movimento, tudo aparece pronto.
export default function pico({ palavras }) {
  return `<section class="pico" data-secao="pico" data-molde="pico" aria-labelledby="pico-titulo">
  <div class="envelope pico__grade">
    <h2 class="pico__promessa" id="pico-titulo">Mesmo dia.</h2>
    <p class="pico__frase" data-acende>${palavras('Chegou até as 10h, sai revisada no fim da tarde. Você volta pedalando.')}</p>
    <div class="acoes">
      <a class="botao" href="tel:+551100000000">Agendar a revisão</a>
    </div>
  </div>
</section>`;
}
