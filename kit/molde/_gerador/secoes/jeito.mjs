// A parte comum: como o negócio trabalha, em tipografia grande e três combinados separados só por fio.
export default function jeito({ esc }) {
  const combinados = [
    ['Preço antes', 'A gente olha a bicicleta, diz quanto fica e só começa com o seu sim.'],
    ['Qualquer marca', 'Da bicicleta de passeio à de estrada, nova ou herdada.'],
    ['Peça mostrada', 'A peça trocada volta com a bicicleta, para você ver o que saiu.'],
  ];
  return `<section class="jeito" data-secao="jeito" data-molde="jeito" aria-labelledby="jeito-titulo">
  <div class="envelope jeito__grade">
    <h2 class="sobretitulo" id="jeito-titulo">Como a oficina trabalha</h2>
    <p class="jeito__frase" data-revela>Nada de surpresa no fim. <em>Você sabe o preço</em> antes da primeira chave sair da parede.</p>
    <ol class="combinados">
      ${combinados.map(([t, p], k) => `<li data-revela><span class="combinados__numero">0${k + 1}</span><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n      ')}
    </ol>
  </div>
</section>`;
}
