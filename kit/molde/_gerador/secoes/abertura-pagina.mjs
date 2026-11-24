// Abertura de uma página interna: mais curta que a da home, com o título da página.
export default function aberturaPagina({ esc }) {
  return `<section class="abertura-pagina" data-secao="abertura" data-molde="abertura-pagina" aria-labelledby="pagina-titulo">
  <div class="envelope">
    <p class="sobretitulo">A oficina</p>
    <h1 id="pagina-titulo">Começou num box de garagem, com uma bancada só.</h1>
    <p class="abertura-pagina__lide">${esc('Cresceu de boca em boca, pedalada por pedalada, até a loja da rua de cima.')}</p>
  </div>
</section>`;
}
