// A história em anos, como linha do tempo tipográfica (ano grande, fio, texto). Sem caixas.
// Cada ano também está em fatos.md, com a fonte.
export default function historia({ esc }) {
  const marcos = [
    ['2019', 'A garagem', 'Um forno a lenha emprestado, duas mesas na calçada e o pão de fermentação natural que ainda é o mais pedido.'],
    ['2021', 'A loja da esquina', 'A fila da manhã dobrou o quarteirão e a casa mudou para a esquina, com balcão de madeira e janela para a rua.'],
    ['2024', 'O café de verdade', 'Chegou o moedor e o café passou a ser coado na hora, com grão de pequenos produtores da serra.'],
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
