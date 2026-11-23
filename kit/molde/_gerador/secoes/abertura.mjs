// Primeira dobra da página inicial: a promessa em uma frase, a ação principal e o horizonte.
// O sol sobe uma vez, ao abrir (site.js). Sem movimento no sistema, ele já aparece no lugar.
export default function abertura({ esc, link }) {
  return `<section class="abertura" data-secao="abertura" data-molde="abertura" aria-labelledby="abertura-titulo">
  <div class="envelope abertura__texto">
    <p class="sobretitulo">Padaria e café de bairro, desde 2019</p>
    <h1 id="abertura-titulo">O pão sai do forno <span class="luz">antes do sol.</span></h1>
    <p class="abertura__lide">${esc('Fermentação natural, café coado na hora e uma mesa perto da janela. A gente abre cedo porque é cedo que o bairro acorda.')}</p>
    <div class="acoes">
      <a class="botao" href="${link('#visita')}">Como chegar</a>
      <a class="botao-linha" href="${link('#cardapio')}">Ver o cardápio</a>
    </div>
  </div>
  <div class="horizonte" aria-hidden="true">
    <div class="horizonte__sol" data-sol></div>
    <div class="horizonte__chao"></div>
  </div>
</section>`;
}
