// O pico da página: um número enorme que conta com a rolagem e uma frase que acende palavra por palavra.
// Sem movimento no sistema, o número e a frase aparecem prontos.
export default function pico({ palavras }) {
  return `<section class="pico" data-secao="pico" data-molde="pico" aria-labelledby="pico-titulo">
  <div class="envelope pico__grade">
    <h2 class="sobretitulo" id="pico-titulo">Fermentação</h2>
    <p class="pico__numero"><span data-conta="36">36</span><span class="pico__unidade">horas</span></p>
    <p class="pico__frase" data-acende>${palavras('De descanso para cada pão. É esse tempo que faz a casca cantar quando você parte o pão ainda morno.')}</p>
  </div>
</section>`;
}
