// O porquê da casa, em tipografia grande. Três princípios em colunas, separados só por fio.
export default function manifesto() {
  const principios = [
    ['Tempo', 'A massa descansa o quanto precisa. Não existe fermento que apresse o sabor.'],
    ['Bairro', 'Farinha de moinho pequeno, leite da serra e o café de quem a gente conhece pelo nome.'],
    ['Mesa', 'Sem pressa para ir embora. A segunda xícara é por conta da casa quando chove.'],
  ];
  return `<section class="manifesto" data-secao="manifesto" data-molde="manifesto" aria-labelledby="manifesto-titulo">
  <div class="envelope manifesto__grade">
    <h2 class="sobretitulo" id="manifesto-titulo">Por que abrimos cedo</h2>
    <p class="manifesto__frase" data-revela>Pão bom não tem segredo, tem <em>tempo</em>. A gente acorda antes do bairro para que o seu dia comece com <em>casca crocante</em> e miolo aberto.</p>
    <ol class="principios">
      ${principios.map(([t, p], k) => `<li data-revela><span class="principios__numero">0${k + 1}</span><h3>${t}</h3><p>${p}</p></li>`).join('\n      ')}
    </ol>
  </div>
</section>`;
}
