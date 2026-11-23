// Anatomia de foto: a parte que abre com uma foto de verdade, no padrão que checar, medir e
// desempenho conferem. O molde não lista esta parte em ordem.mjs, porque o estúdio não traz foto
// de negócio nenhum: é o modelo para quando a pessoa tiver as dela.
//
// Como usar: exporte a foto em WebP em duas larguras (ex.: 800 e 1600 px) para site/assets/img/,
// troque os nomes, o width/height (o tamanho real da maior, para a página não pular), o alt (o
// que a foto mostra, para quem não vê) e a legenda; ponha 'foto' em secoes, em ordem.mjs.
// Foto no topo da página: troque loading="lazy" por fetchpriority="high" (é o maior elemento).
// Sem a foto em site/assets/img/, o checar reprova com arquivo-ausente.
export default function foto({ esc, assets }) {
  const imagem = {
    pequena: 'foto-800.webp',
    grande: 'foto-1600.webp',
    largura: 1600,
    altura: 1067,
    alt: 'Descreva aqui o que a foto mostra: quem, onde, fazendo o quê.',
    legenda: 'Legenda curta, com o fato que a foto prova.',
  };
  return `<section class="foto" data-secao="foto" data-molde="foto" aria-label="${esc(imagem.legenda)}">
  <figure class="foto__quadro">
    <picture>
      <source type="image/webp" srcset="${assets}img/${imagem.pequena} 800w, ${assets}img/${imagem.grande} 1600w" sizes="100vw">
      <img src="${assets}img/${imagem.grande}" alt="${esc(imagem.alt)}" width="${imagem.largura}" height="${imagem.altura}" loading="lazy" decoding="async">
    </picture>
    <figcaption class="envelope foto__legenda">${esc(imagem.legenda)}</figcaption>
  </figure>
</section>`;
}
