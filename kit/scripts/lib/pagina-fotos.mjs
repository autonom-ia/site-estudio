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

// Espera as partes em 3D (palcos com data-3d) terminarem antes da foto: cada palco até ficar
// "pronta" ou até a página dizer por que ficou na reserva (data-3d-motivo), com prazo por palco.
// Palco que ainda nem começou (o vigia de rolagem não o viu) é trazido à tela para começar.
// Lição: sem esperar, a foto saía com o palco vazio (a cena ainda baixando) ou no meio da troca;
// e esperar só os "carregando" deixava passar o palco que ainda não tinha começado.
export async function esperarCenas3d(tetoPorPalcoMs) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const palcos = [...document.querySelectorAll('[data-3d]')];
  if (!palcos.length) return 0;
  const terminou = (p) => p.getAttribute('data-3d-estado') === 'pronta' || p.hasAttribute('data-3d-motivo');
  let rolou = false;
  for (const p of palcos) {
    const fim = Date.now() + tetoPorPalcoMs;
    if (!terminou(p) && p.getAttribute('data-3d-estado') !== 'carregando') {
      p.scrollIntoView({ block: 'center', behavior: 'instant' });
      rolou = true;
    }
    while (Date.now() < fim && !terminou(p)) await dormir(100);
  }
  if (rolou) {
    for (let k = 0; k < 10 && scrollY !== 0; k += 1) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      await quadro();
    }
  }
  await quadro();
  for (const a of document.getAnimations()) {
    try {
      const tempo = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (tempo && tempo.endTime !== Infinity) a.finish();
    } catch (e) {}
  }
  await quadro();
  return palcos.length;
}

// Onde está cada palco 3D na página (depois de prenderParaFoto) e em que estado ficou:
// pronta (a cena desenhou), reserva (imagem parada) ou carregando (passou do prazo).
export function cenas3d() {
  return [...document.querySelectorAll('[data-3d]')].map((p) => {
    const r = p.getBoundingClientRect();
    return {
      cena: p.getAttribute('data-3d'),
      estado: p.getAttribute('data-3d-estado') || 'sem-estado',
      motivo: p.getAttribute('data-3d-motivo') || '',
      x: Math.max(0, r.left + scrollX),
      y: Math.max(0, r.top + scrollY),
      largura: Math.min(r.width, innerWidth),
      altura: r.height,
    };
  });
}
