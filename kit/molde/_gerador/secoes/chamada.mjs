// Fecho de página interna: uma frase e o convite para a ação principal do site.
export default function chamada({ link }) {
  return `<section class="chamada" data-secao="chamada" data-molde="chamada" aria-labelledby="chamada-titulo">
  <div class="envelope chamada__grade">
    <h2 id="chamada-titulo" data-revela>Traga a bicicleta até as 10h.</h2>
    <div class="acoes">
      <a class="botao" href="tel:+551100000000">Agendar: (11) 0000-0000</a>
      <a class="botao-linha" href="${link('/#servicos')}">Ver os preços</a>
    </div>
  </div>
</section>`;
}
