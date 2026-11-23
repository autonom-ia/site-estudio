// Anatomia de fotos reais: pequenas e agrupadas, nunca esticadas. O molde não lista esta parte em
// ordem.mjs, porque o estúdio não traz foto de negócio nenhum: é o modelo para quando a pessoa
// tiver as dela.
//
// Por que pequenas e juntas: foto de celular ou de rede social raramente aguenta a tela inteira.
// Esticada, ela borra; em grupo, cada uma no tamanho que tem, ela mostra o lugar, a gente e o
// trabalho de verdade. A regra da imagem: nunca exibida maior que o arquivo (o CSS segura no
// width do próprio <img>, que é a largura real do arquivo).
//
// Como usar: exporte cada foto em WebP na largura em que ela aparece (ex.: 640 px) para
// site/assets/img/, troque os nomes, o width/height (o tamanho real de cada arquivo, para a página
// não pular), o alt (o que a foto mostra, para quem não vê) e a legenda (o fato que a foto prova,
// também em fatos.md). Ponha 'fotos' em secoes, em ordem.mjs. De 3 a 6 fotos por grupo.
// Sem a foto em site/assets/img/, o checar reprova com arquivo-ausente.
export default function fotos({ esc, assets }) {
  const lista = [
    { arquivo: 'foto-1.webp', largura: 640, altura: 800, alt: 'Descreva o que a foto mostra: quem, onde, fazendo o quê.', legenda: 'Legenda curta, com o fato que a foto prova.' },
    { arquivo: 'foto-2.webp', largura: 640, altura: 640, alt: 'Descreva a segunda foto.', legenda: 'Outra legenda curta.' },
    { arquivo: 'foto-3.webp', largura: 640, altura: 800, alt: 'Descreva a terceira foto.', legenda: 'Mais uma legenda curta.' },
  ];
  return `<section class="fotos" data-secao="fotos" data-molde="fotos" aria-labelledby="fotos-titulo">
  <div class="envelope">
    <h2 class="sobretitulo" id="fotos-titulo">Um título curto para o grupo</h2>
    <ul class="fotos__grupo">
      ${lista.map((f) => `<li data-revela><figure>
        <img src="${assets}img/${f.arquivo}" alt="${esc(f.alt)}" width="${f.largura}" height="${f.altura}" loading="lazy" decoding="async">
        <figcaption>${esc(f.legenda)}</figcaption>
      </figure></li>`).join('\n      ')}
    </ul>
  </div>
</section>`;
}
