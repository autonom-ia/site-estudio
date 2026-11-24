// A história em anos, como linha do tempo tipográfica (ano grande, fio, texto). Sem caixas.
// Cada ano também está em fatos.md, com a fonte.
export default function historia({ esc }) {
  const marcos = [
    ['2016', 'O box de garagem', 'Uma bancada, um suporte de parede e as bicicletas da vizinhança.'],
    ['2020', 'A loja da rua de cima', 'A fila de bicicletas na calçada pediu porta de enrolar e bancada dupla.'],
    ['2023', 'Busca em casa', 'A oficina passou a buscar e levar a bicicleta de quem não pode vir.'],
  ];
  return `<section class="historia" data-secao="historia" data-molde="historia" aria-labelledby="historia-titulo">
  <div class="envelope">
    <h2 class="sobretitulo" id="historia-titulo">Ano a ano</h2>
    <ol class="historia__lista">
      ${marcos.map(([ano, titulo, texto]) => `<li data-revela><p class="historia__ano">${ano}</p><div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p></div></li>`).join('\n      ')}
    </ol>
  </div>
</section>`;
}
