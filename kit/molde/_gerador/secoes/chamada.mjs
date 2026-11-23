// Fecho de página interna: uma frase e o convite para a ação principal do site.
export default function chamada({ link }) {
  return `<section class="chamada" data-secao="chamada" data-molde="chamada" aria-labelledby="chamada-titulo">
  <div class="envelope chamada__grade">
    <h2 id="chamada-titulo" data-revela>A próxima fornada sai às sete.</h2>
    <div class="acoes">
      <a class="botao" href="${link('/#visita')}">Como chegar</a>
      <a class="botao-linha" href="${link('/#cardapio')}">Ver o cardápio</a>
    </div>
  </div>
</section>`;
}
