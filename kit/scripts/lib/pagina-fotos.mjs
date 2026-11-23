// Prepara a página para as fotos de conferência. Roda DENTRO da página (via sessao.avaliar), com a
// página já assentada e no topo: não pode usar nada de fora dela mesma.
//
// Lição do piloto: parte presa suja a foto. O cabeçalho "sticky" aparecia no meio das outras partes,
// a barra "fixed" do celular aparecia no meio da página e a coluna presa de uma parte saía no pé
// dela. A foto passa a mostrar o que a pessoa vê ao abrir a página, parada no topo:
// - "fixed" vira "absolute" no mesmo lugar da primeira tela (fica só na primeira tela); o que
//   está fora da primeira tela (barra que só entra com a rolagem) some da foto;
// - "sticky" volta para o lugar dela no texto (aparece uma vez, onde está escrita);
// - camada de tela cheia (textura, fundo) fica como está.
export function prenderParaFoto() {
  const vw = innerWidth;
  const vh = innerHeight;
  const fixos = [];
  const grudados = [];
  for (const el of document.body.querySelectorAll('*')) {
    const p = getComputedStyle(el).position;
    if (p === 'fixed') fixos.push(el);
    else if (p === 'sticky') grudados.push(el);
  }
  let presos = 0;
  for (const el of fixos) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
    const s = el.style;
    // fora da primeira tela (barra que só entra com a rolagem): a pessoa não vê ao abrir
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) {
      s.setProperty('visibility', 'hidden', 'important');
      presos += 1;
      continue;
    }
    const alvo = { top: r.top + scrollY, left: r.left + scrollX };
    s.setProperty('position', 'absolute', 'important');
    s.setProperty('top', '0px', 'important');
    s.setProperty('left', '0px', 'important');
    s.setProperty('right', 'auto', 'important');
    s.setProperty('bottom', 'auto', 'important');
    s.setProperty('width', `${r.width}px`, 'important');
    s.setProperty('height', `${r.height}px`, 'important');
    s.setProperty('margin', '0', 'important');
    // o bloco de referência do "absolute" pode não ser a página: corrige pela diferença medida
    const agora = el.getBoundingClientRect();
    s.setProperty('top', `${alvo.top - (agora.top + scrollY)}px`, 'important');
    s.setProperty('left', `${alvo.left - (agora.left + scrollX)}px`, 'important');
    presos += 1;
  }
  for (const el of grudados) {
    const s = el.style;
    s.setProperty('position', 'relative', 'important');
    for (const lado of ['top', 'right', 'bottom', 'left']) s.setProperty(lado, 'auto', 'important');
    presos += 1;
  }
  return { presos, altura: document.documentElement.scrollHeight };
}
