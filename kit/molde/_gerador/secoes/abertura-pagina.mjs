// Abertura de uma página interna: mais curta que a da home, com o título da página.
export default function aberturaPagina({ esc }) {
  return `<section class="abertura-pagina" data-secao="abertura" data-molde="abertura-pagina" aria-labelledby="pagina-titulo">
  <div class="envelope">
    <p class="sobretitulo">A casa</p>
    <h1 id="pagina-titulo">Um forno, duas mesas e muita paciência.</h1>
    <p class="abertura-pagina__lide">${esc('A padaria nasceu numa garagem da rua de baixo. Cresceu devagar, do jeito que a massa cresce: sem pular etapa.')}</p>
  </div>
</section>`;
}
