// Funções que rodam DENTRO da página no Chrome (via sessao.avaliar). Leitura pelo DOM, sem regex.
// Cada função vai como texto para a página: não pode usar nada de fora dela mesma.

// Espera a página ficar pronta: load, fontes e imagens (com teto).
export async function pronta() {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  if (document.readyState !== 'complete') {
    await Promise.race([new Promise((r) => addEventListener('load', r, { once: true })), dormir(10000)]);
  }
  try {
    await Promise.race([document.fonts.ready, dormir(6000)]);
  } catch (e) {}
  await dormir(120);
  return { altura: document.documentElement.scrollHeight, titulo: document.title };
}

// Põe a página no estado que a pessoa vê depois que tudo assenta.
// Lições: foto só do topo esconde metade da página; congelar a animação no começo fotografa texto
// invisível. Então: rola a página inteira (dispara o que entra com a rolagem), completa as animações
// finitas, pausa as infinitas, espera as imagens e volta ao topo.
export async function assentar() {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const raiz = document.documentElement;
  try {
    if (window.__lenis && typeof window.__lenis.destroy === 'function') window.__lenis.destroy();
  } catch (e) {}
  raiz.style.scrollBehavior = 'auto';
  if (document.body) document.body.style.scrollBehavior = 'auto';
  const ir = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  const passo = Math.max(200, Math.round(innerHeight * 0.6));
  let y = 0;
  for (let k = 0; k < 400; k += 1) {
    ir(y);
    await quadro();
    await dormir(35);
    const fim = raiz.scrollHeight - innerHeight;
    if (y >= fim) break;
    y = Math.min(fim, y + passo);
  }
  await dormir(150);
  try {
    if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
      for (const st of window.ScrollTrigger.getAll()) {
        try {
          if (st.animation) st.animation.progress(1);
          // seção presa (pin): desfaz o espaçador, senão a foto fica com um buraco de tela cheia
          st.kill(Boolean(st.pin), true);
        } catch (e) {}
      }
    }
  } catch (e) {}
  try {
    if (window.gsap && window.gsap.globalTimeline) {
      for (const t of window.gsap.globalTimeline.getChildren(true, true, true)) {
        try {
          if (t.repeat && t.repeat() === -1) t.pause();
          else t.progress(1);
        } catch (e) {}
      }
    }
  } catch (e) {}
  for (const a of document.getAnimations()) {
    try {
      const tempo = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (tempo && tempo.endTime === Infinity) a.pause();
      else a.finish();
    } catch (e) {}
  }
  for (const v of document.querySelectorAll('video')) {
    try {
      v.pause();
    } catch (e) {}
  }
  for (const img of document.images) {
    if (!img.complete) await Promise.race([new Promise((r) => { img.onload = r; img.onerror = r; }), dormir(5000)]);
  }
  // Volta ao topo e confere. O ScrollTrigger adia um "refresh" pedido durante a rolagem para o fim
  // dela, e esse refresh devolve a página para onde estava quando foi pedido (o fim da página). No
  // piloto, as fotos saíam com a página rolada até o fim e o cabeçalho preso no meio da última parte.
  for (let k = 0; k < 10; k += 1) {
    ir(0);
    await quadro();
    await dormir(250);
    if (scrollY === 0) break;
  }
  return { altura: raiz.scrollHeight, largura: raiz.scrollWidth, topo: scrollY === 0 };
}

// As partes da página para fotografar uma a uma: cabeçalho, cada seção do <main> e o rodapé.
export function secoes() {
  const vistos = new Set();
  const lista = [];
  const candidatos = document.querySelectorAll('body > header, main > section, main > header, main > footer, [data-secao], body > footer');
  let k = 0;
  for (const el of candidatos) {
    if (vistos.has(el)) continue;
    vistos.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    k += 1;
    const nome = el.getAttribute('data-secao') || el.id || (el.classList[0] || el.tagName.toLowerCase());
    lista.push({ ordem: k, nome, x: 0, y: Math.max(0, r.top + scrollY), largura: innerWidth, altura: r.height });
  }
  return lista;
}

// Conferência estrutural pelo DOM: <select>, endereços externos, referências locais (arquivo e
// link interno, incluindo âncora), fontes que não carregam, metadados e travessão no texto visível.
export async function estatico() {
  const SISTEMA = new Set(['arial', 'helvetica', 'helvetica neue', 'georgia', 'times', 'times new roman', 'courier',
    'courier new', 'verdana', 'tahoma', 'trebuchet ms', 'impact', 'segoe ui', 'roboto', 'system-ui', 'ui-sans-serif',
    'ui-serif', 'ui-monospace', 'ui-rounded', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', '-apple-system',
    'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'menlo', 'monaco', 'consolas', 'sf mono', 'sfmono-regular',
    'apple color emoji', 'segoe ui emoji', 'noto color emoji', 'emoji', 'math']);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const origem = location.origin;
  const externos = [];
  const locais = new Map();
  const IGNORAR = ['data:', 'blob:', 'javascript:', 'mailto:', 'tel:', 'about:', 'sms:', 'whatsapp:'];
  const anotar = (bruto, tag) => {
    if (!bruto) return;
    const v = bruto.trim();
    if (!v || IGNORAR.some((p) => v.toLowerCase().startsWith(p))) return;
    let u;
    try {
      u = new URL(v, location.href);
    } catch (e) {
      return;
    }
    if (u.origin !== origem) {
      if (tag !== 'a') externos.push({ tag, url: u.href });
      return;
    }
    const chave = u.origin + u.pathname;
    const atual = locais.get(chave) || { url: chave, tags: new Set(), ancoras: new Set() };
    atual.tags.add(tag);
    if (u.hash && u.hash.length > 1) atual.ancoras.add(decodeURIComponent(u.hash.slice(1)));
    locais.set(chave, atual);
  };
  const ATRIBUTOS = [['script', 'src'], ['link', 'href'], ['img', 'src'], ['video', 'src'], ['video', 'poster'],
    ['audio', 'src'], ['source', 'src'], ['iframe', 'src'], ['track', 'src'], ['image', 'href'], ['use', 'href'],
    ['object', 'data'], ['embed', 'src'], ['a', 'href'], ['area', 'href'], ['form', 'action']];
  for (const [tag, attr] of ATRIBUTOS) for (const el of document.querySelectorAll(tag)) anotar(el.getAttribute(attr), tag);
  for (const el of document.querySelectorAll('img[srcset], source[srcset]')) {
    for (const parte of el.getAttribute('srcset').split(',')) anotar(parte.trim().split(' ')[0], 'srcset');
  }
  const quebrados = [];
  const ancorasMortas = [];
  const aqui = location.origin + location.pathname;
  await Promise.all([...locais.values()].map(async (item) => {
    const rel = item.url.slice(origem.length);
    let texto = null;
    try {
      const precisaTexto = item.ancoras.size > 0 && item.url !== aqui;
      const r = await fetch(item.url, { method: precisaTexto ? 'GET' : 'HEAD', cache: 'no-store' });
      if (!r.ok) {
        quebrados.push({ url: rel, status: r.status, link: item.tags.has('a') || item.tags.has('area') });
        return;
      }
      if (precisaTexto) texto = await r.text();
    } catch (e) {
      quebrados.push({ url: rel, status: 0, link: item.tags.has('a') });
      return;
    }
    if (!item.ancoras.size) return;
    const doc = item.url === aqui ? document : new DOMParser().parseFromString(texto || '', 'text/html');
    for (const id of item.ancoras) {
      if (!doc.getElementById(id) && !doc.getElementsByName(id).length) ancorasMortas.push(`${rel}#${id}`);
    }
  }));
  // fontes: força o carregamento de toda fonte declarada e vê quais falham
  const fontesComErro = [];
  const faces = new Set();
  const limpo = (f) => {
    let s = f.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
    return s;
  };
  const cargas = [];
  for (const f of document.fonts) {
    faces.add(limpo(f.family).toLowerCase());
    if (f.status === 'unloaded') cargas.push(Promise.race([f.load().catch(() => null), dormir(6000)]));
  }
  await Promise.all(cargas);
  for (const f of document.fonts) if (f.status === 'error') fontesComErro.push(limpo(f.family));
  const fantasmas = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    let temTexto = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { temTexto = true; break; }
    if (!temTexto) continue;
    const primeira = limpo(getComputedStyle(el).fontFamily.split(',')[0] || '');
    const chave = primeira.toLowerCase();
    if (chave && !faces.has(chave) && !SISTEMA.has(chave)) fantasmas.add(primeira);
  }
  // texto visível (o que a pessoa lê) + o que o CSS escreve com content:
  const pedacos = [document.body.innerText || ''];
  for (const el of document.body.querySelectorAll('*')) {
    for (const pseudo of ['::before', '::after']) {
      const c = getComputedStyle(el, pseudo).content;
      if (c && c !== 'none' && c !== 'normal' && c.length > 2 && c.startsWith('"')) pedacos.push(c.slice(1, -1));
    }
  }
  const texto = pedacos.join('\n');
  const travessoes = [];
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (ch === '—' || ch === '–') travessoes.push(texto.slice(Math.max(0, i - 40), i + 40).split('\n').join(' ').trim());
  }
  const meta = (nome) => {
    const el = document.querySelector(`meta[name="${nome}"]`) || document.querySelector(`meta[property="${nome}"]`);
    return el ? (el.getAttribute('content') || '').trim() : null;
  };
  const jsonLd = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      JSON.parse(s.textContent);
      jsonLd.push({ ok: true });
    } catch (e) {
      jsonLd.push({ ok: false, erro: String(e.message).slice(0, 160) });
    }
  }
  return {
    selects: document.querySelectorAll('select').length,
    externos,
    quebrados,
    ancorasMortas,
    fontesComErro: [...new Set(fontesComErro)],
    fantasmas: [...fantasmas],
    travessoes: travessoes.slice(0, 10),
    titulo: (document.title || '').trim(),
    descricao: meta('description'),
    idioma: (document.documentElement.getAttribute('lang') || '').trim(),
    h1: document.querySelectorAll('h1').length,
    ogImage: meta('og:image'),
    jsonLd,
    molde: [...document.querySelectorAll('[data-molde]')].map((el) => el.getAttribute('data-molde') || el.getAttribute('data-secao') || el.tagName.toLowerCase()),
  };
}

// Medidas por tamanho de tela, com a página assentada:
// rola-para-o-lado, colisão de texto (rolando até o par), texto cortado por um recorte,
// contraste computado (4,5:1; 3:1 para texto grande), alvo de toque e texto pequeno no celular.
export async function medir(L) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const raiz = document.documentElement;
  const vw = innerWidth;
  const vh = innerHeight;
  const red = [];
  const warn = [];
  const ir = (y) => window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });
  const curto = (t) => (t.length > 40 ? `${t.slice(0, 40)}…` : t);
  const nomeDe = (el, texto) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList && el.classList[0] ? `.${el.classList[0]}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls} "${curto(texto)}"`;
  };
  const juntar = (t) => {
    let s = '';
    let espaco = false;
    for (const ch of t) {
      const b = ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === ' ';
      if (b) espaco = true;
      else {
        if (espaco && s) s += ' ';
        espaco = false;
        s += ch;
      }
    }
    return s;
  };

  // 1. rola para o lado. No celular o navegador alarga a janela para caber o que vaza (innerWidth
  // cresce); a largura de layout de verdade é a do <html> (clientWidth).
  const larguraTela = raiz.clientWidth || vw;
  const larguraDoc = Math.max(raiz.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (larguraDoc > larguraTela + 1) {
    const culpados = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > larguraTela + 1 || r.left < -1) {
        const pai = el.parentElement;
        const pr = pai ? pai.getBoundingClientRect() : null;
        if (pr && (pr.right > larguraTela + 1 || pr.left < -1) && pai !== document.body) continue;
        culpados.push(`${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''} (${Math.round(r.right - larguraTela)} px)`);
        if (culpados.length >= 5) break;
      }
    }
    red.push({ tipo: 'rola-para-o-lado', detalhe: `a página tem ${larguraDoc} px numa tela de ${larguraTela} px: ${culpados.join(', ')}` });
  }

  // cores: rgb/rgba lidos direto; o resto (oklch, color-mix…) passa por um canvas
  const tela = document.createElement('canvas');
  tela.width = 1;
  tela.height = 1;
  const ctx = tela.getContext('2d', { willReadFrequently: true });
  const cor = (c) => {
    const s = String(c || '').trim();
    if (s === 'transparent' || !s) return { r: 0, g: 0, b: 0, a: 0 };
    if (s.startsWith('rgb')) {
      const ini = s.indexOf('(');
      const fim = s.lastIndexOf(')');
      const partes = [];
      for (const p of s.slice(ini + 1, fim).split(',')) for (const q of p.split('/')) for (const w of q.trim().split(' ')) if (w) partes.push(w);
      const n = (v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
      const alfa = partes[3] === undefined ? 1 : partes[3].endsWith('%') ? parseFloat(partes[3]) / 100 : parseFloat(partes[3]);
      return { r: n(partes[0]), g: n(partes[1]), b: n(partes[2]), a: alfa };
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const misturar = (cima, baixo, a) => ({ r: cima.r * a + baixo.r * (1 - a), g: cima.g * a + baixo.g * (1 - a), b: cima.b * a + baixo.b * (1 - a) });
  const luz = (c) => {
    const canal = (v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  };
  const razao = (a, b) => {
    const la = luz(a);
    const lb = luz(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

  // os textos da página, cada um com as caixas reais das linhas (Range), em coordenadas do documento
  const itens = [];
  const porElemento = new Map();
  const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = andar.nextNode(); n; n = andar.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, template, svg, [data-medir-nao]')) continue;
    let it = porElemento.get(el);
    if (!it) {
      it = { el, nos: [], texto: '' };
      porElemento.set(el, it);
      itens.push(it);
    }
    it.nos.push(n);
    it.texto += n.textContent;
  }
  const caixasDe = (it) => {
    const lista = [];
    for (const n of it.nos) {
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1) lista.push({ left: q.left, top: q.top, right: q.right, bottom: q.bottom });
    }
    return lista;
  };
  const opacidade = (el) => {
    let o = 1;
    for (let e = el; e && e !== raiz; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };
  // 'fixed' (preso à tela), 'sticky' (gruda ao rolar) ou '' (rola com a página)
  const ehFixo = (el) => {
    let achou = '';
    for (let e = el; e && e !== raiz; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed') return 'fixed';
      if (p === 'sticky') achou = 'sticky';
    }
    return achou;
  };
  // parte do texto que um recorte (overflow hidden/clip, clip, clip-path) deixa visível
  const recortes = (el) => {
    const lista = [];
    for (let e = el.parentElement; e && e !== raiz; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const corta = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY)
        || (cs.clip && cs.clip !== 'auto') || (cs.clipPath && cs.clipPath !== 'none');
      if (corta) lista.push(e);
    }
    return lista;
  };
  // texto só para leitor de tela (recorte de 1 px ou clip zerado): ninguém vê, não se mede
  const soLeitor = (el) => {
    for (let e = el; e && e !== raiz; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const corta = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY);
      const r = e.getBoundingClientRect();
      if (corta && (r.width <= 2 || r.height <= 2)) return true;
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return true;
    }
    return false;
  };
  ir(0);
  await quadro();
  for (const it of itens) {
    const cs = getComputedStyle(it.el);
    it.soLeitor = soLeitor(it.el);
    it.decorativo = Boolean(it.el.closest('[aria-hidden="true"]'));
    it.cs = cs;
    it.texto = juntar(it.texto);
    it.op = opacidade(it.el);
    it.fixo = ehFixo(it.el);
    it.visivel = cs.visibility !== 'hidden' && cs.display !== 'none';
    const cx = caixasDe(it);
    it.caixas = cx.map((q) => ({ left: q.left + scrollX, top: q.top + scrollY, right: q.right + scrollX, bottom: q.bottom + scrollY }));
    it.sumido = false;
    it.cortado = 0;
    for (const e of recortes(it.el)) {
      const r = e.getBoundingClientRect();
      let dentro = 0;
      let total = 0;
      let vaza = 0;
      for (const q of cx) {
        const a = (q.right - q.left) * (q.bottom - q.top);
        total += a;
        const ix = Math.max(0, Math.min(q.right, r.right) - Math.max(q.left, r.left));
        const iy = Math.max(0, Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top));
        dentro += ix * iy;
        vaza = Math.max(vaza, r.left - q.left, q.right - r.right, r.top - q.top, q.bottom - r.bottom);
      }
      if (total > 0 && dentro < total * 0.05) {
        it.sumido = true;
        break;
      }
      if (vaza > it.cortado) it.cortado = vaza;
    }
  }
  const validos = itens.filter((it) => it.visivel && !it.sumido && !it.soLeitor && it.caixas.length && it.texto.length > 0);

  // 2. texto cortado por um recorte
  for (const it of validos) {
    // faixa decorativa (aria-hidden) pode vazar a tela de propósito
    if (it.op < 0.05 || it.cs.textOverflow === 'ellipsis' || it.decorativo) continue;
    if (it.cortado > L.vazamento) red.push({ tipo: 'texto-cortado', detalhe: `${Math.round(it.cortado)} px escondidos: ${nomeDe(it.el, it.texto)}` });
  }

  // 3. colisão: primeiro pelas caixas no documento, depois rolando até o par para olhar a pilha
  const sobrepoe = (a, b) => {
    let melhor = null;
    for (const p of a) for (const q of b) {
      const ix = Math.min(p.right, q.right) - Math.max(p.left, q.left);
      const iy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (ix > L.sobreposicao && iy > L.sobreposicao && (!melhor || ix * iy > melhor.ix * melhor.iy)) melhor = { ix, iy, x0: Math.max(p.left, q.left), y0: Math.max(p.top, q.top) };
    }
    return melhor;
  };
  const opaca = (el) => {
    const cs = getComputedStyle(el);
    if (cor(cs.backgroundColor).a >= 0.9) return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    return ['IMG', 'VIDEO', 'CANVAS', 'PICTURE'].includes(el.tagName);
  };
  const coberto = (a, b, x0, y0, x1, y1) => {
    for (const fx of [0.25, 0.5, 0.75]) for (const fy of [0.25, 0.5, 0.75]) {
      const x = x0 + (x1 - x0) * fx;
      const y = y0 + (y1 - y0) * fy;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      const pilha = document.elementsFromPoint(x, y);
      const idx = (el) => pilha.findIndex((e) => e === el || el.contains(e));
      const ia = idx(a);
      const ib = idx(b);
      if (ia < 0 || ib < 0) continue;
      let tampa = false;
      for (let k = 0; k < Math.max(ia, ib); k += 1) {
        const e = pilha[k];
        if (e === a || e === b || a.contains(e) || b.contains(e)) continue;
        if (opaca(e)) {
          tampa = true;
          break;
        }
      }
      if (!tampa) return false;
    }
    return true;
  };
  const colisoes = [];
  for (let i = 0; i < validos.length; i += 1) {
    for (let j = i + 1; j < validos.length; j += 1) {
      const a = validos[i];
      const b = validos[j];
      if (a.fixo || b.fixo || a.op < 0.55 || b.op < 0.55) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.texto === b.texto) continue;
      if (a.el.parentElement === b.el.parentElement && a.cs.display.includes('inline') && b.cs.display.includes('inline')) continue;
      if (sobrepoe(a.caixas, b.caixas)) colisoes.push([a, b]);
    }
  }
  for (const [a, b] of colisoes.slice(0, 60)) {
    const topo = Math.min(a.caixas[0].top, b.caixas[0].top);
    ir(topo - 40);
    await quadro();
    const s = sobrepoe(caixasDe(a), caixasDe(b));
    if (!s) continue;
    if (coberto(a.el, b.el, s.x0, s.y0, s.x0 + s.ix, s.y0 + s.iy)) continue;
    red.push({ tipo: 'colisao', detalhe: `${Math.round(s.ix)}x${Math.round(s.iy)} px: ${nomeDe(a.el, a.texto)} × ${nomeDe(b.el, b.texto)}` });
  }

  // 4. contraste, medido onde o texto está: rola em trechos e lê a pilha atrás de cada texto
  const semMedir = [];
  const medidos = new Set();
  const debaixoDePreso = new Set();
  // centro do texto na borda da tela: o navegador não devolve elemento nenhum ali (nem por cima)
  const naBorda = new Set();
  const BORDA = L.borda_da_tela ?? 1; // px; quem chama sem o limite mede com 1 px
  const MIDIA = ['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'IFRAME', 'svg', 'SVG', 'OBJECT', 'EMBED'];
  const medirContraste = (it) => {
    const cx = caixasDe(it);
    if (!cx.length) return false;
    const q = cx[0];
    const x = Math.min(vw - BORDA, Math.max(BORDA, (q.left + q.right) / 2));
    const y = (q.top + q.bottom) / 2;
    // fora da tela, ou a menos de BORDA px da borda: não dá para medir aqui, mede noutra posição
    if (y < BORDA || y > vh - BORDA) {
      if (y >= 0 && y < vh) naBorda.add(it);
      return false;
    }
    const preenchimento = cor(it.cs.webkitTextFillColor || it.cs.color);
    if (preenchimento.a < 0.05) {
      semMedir.push(`${nomeDe(it.el, it.texto)}: texto pintado com fundo (transparente)`);
      return true;
    }
    const pilha = document.elementsFromPoint(x, y);
    // pilha vazia não é sobreposição: o ponto ficou fora do alcance do navegador (borda da tela)
    if (!pilha.length) {
      naBorda.add(it);
      return false;
    }
    let k = pilha.findIndex((e) => e === it.el || it.el.contains(e));
    if (k < 0) {
      // cabeçalho ou barra presos por cima agora: mede noutra posição da rolagem
      if (pilha.length && ehFixo(pilha[0])) {
        debaixoDePreso.add(it);
        return false;
      }
      semMedir.push(`${nomeDe(it.el, it.texto)}: outro elemento por cima`);
      return true;
    }
    const camadas = [];
    for (; k < pilha.length; k += 1) {
      const e = pilha[k];
      if (e !== it.el && it.el.contains(e)) continue;
      if (MIDIA.includes(e.tagName) && !e.contains(it.el)) {
        semMedir.push(`${nomeDe(it.el, it.texto)}: imagem ou vídeo atrás do texto`);
        return true;
      }
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        semMedir.push(`${nomeDe(it.el, it.texto)}: fundo com imagem ou degradê`);
        return true;
      }
      const fundo = cor(cs.backgroundColor);
      if (fundo.a > 0.001) {
        camadas.push(fundo);
        if (fundo.a >= 0.999) break;
      }
    }
    let base = { r: 255, g: 255, b: 255 };
    for (let c = camadas.length - 1; c >= 0; c -= 1) base = misturar(camadas[c], base, camadas[c].a);
    const texto = misturar(preenchimento, base, preenchimento.a * it.op);
    const rz = razao(texto, base);
    const px = parseFloat(it.cs.fontSize);
    const peso = parseInt(it.cs.fontWeight, 10) || 400;
    const grande = px >= 24 || (px >= 18.66 && peso >= 700);
    const minimo = grande ? 3 : 4.5;
    if (rz + 0.005 < minimo) {
      red.push({ tipo: 'contraste', detalhe: `${(Math.floor(rz * 100) / 100).toFixed(2)}:1 (precisa ${minimo}:1) ${hex(texto)} sobre ${hex(base)}, ${Math.round(px)} px: ${nomeDe(it.el, it.texto)}` });
    }
    return true;
  };
  const contaveis = validos.filter((it) => it.op >= 0.05);
  const fimDoc = raiz.scrollHeight;
  for (let topo = 0, k = 0; k < 400; k += 1) {
    ir(topo);
    await quadro();
    const atual = scrollY;
    for (const it of contaveis) {
      if (medidos.has(it)) continue;
      if (it.fixo === 'fixed' && atual > 0) continue;
      if (medirContraste(it)) medidos.add(it);
    }
    if (atual + vh >= fimDoc - 1 || medidos.size === contaveis.length) break;
    topo = atual + Math.round(vh * 0.8);
  }
  for (const it of validos) {
    if (it.op < 0.05 && !it.el.closest('[aria-hidden="true"]')) warn.push({ tipo: 'texto-invisivel', detalhe: `opacidade ${it.op.toFixed(2)} depois de assentar: ${nomeDe(it.el, it.texto)}` });
  }
  for (const it of debaixoDePreso) if (!medidos.has(it)) semMedir.push(`${nomeDe(it.el, it.texto)}: fica sempre debaixo de uma parte presa`);
  for (const it of naBorda) if (!medidos.has(it) && !debaixoDePreso.has(it)) semMedir.push(`${nomeDe(it.el, it.texto)}: fica na borda da tela em toda posição da rolagem`);
  for (const s of semMedir.slice(0, L.maximo)) warn.push({ tipo: 'contraste-nao-medido', detalhe: s });

  // 5. só no celular: alvo de toque e texto pequeno
  if (L.movel) {
    ir(0);
    await quadro();
    const ALVOS = 'a[href], button, input:not([type="hidden"]), textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(ALVOS)) {
      if (el.closest('[inert]') || el.disabled) continue;
      try {
        if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      } catch (e) {}
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2 || r.right < 0 || r.left > vw) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'inline' && el.parentElement) {
        // link no meio de uma frase: a exceção "em linha" da WCAG
        let textoDoPai = '';
        for (const n of el.parentElement.childNodes) if (n !== el && n.nodeType === 3) textoDoPai += n.textContent;
        if (textoDoPai.trim()) continue;
      }
      const sumiu = recortes(el).some((e) => {
        const q = e.getBoundingClientRect();
        return q.width <= 2 || q.height <= 2;
      });
      if (sumiu) continue;
      if (r.width + 0.5 < L.alvo_minimo || r.height + 0.5 < L.alvo_minimo) {
        const rotulo = juntar(el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '');
        red.push({ tipo: 'alvo-pequeno', detalhe: `${Math.round(r.width)}x${Math.round(r.height)} px: ${nomeDe(el, rotulo)}` });
      }
    }
    for (const it of validos) {
      if (it.op < 0.05) continue;
      const px = parseFloat(it.cs.fontSize);
      if (px + 0.01 < L.texto_minimo_celular) warn.push({ tipo: 'texto-pequeno-celular', detalhe: `${Math.round(px * 10) / 10} px: ${nomeDe(it.el, it.texto)}` });
    }
  }
  ir(0);
  await quadro();
  await dormir(20);
  return {
    red: red.slice(0, L.maximo),
    warn: warn.slice(0, L.maximo),
    textos: validos.length,
    contraste_medido: medidos.size,
    contraste_sem_medir: semMedir.length,
  };
}

// O texto que a pessoa lê, para a conferência de fatos: innerText, o que o CSS escreve com
// content: e os endereços tel: e mailto: dos links.
export function textoParaFatos() {
  const pedacos = [document.body.innerText || ''];
  for (const el of document.body.querySelectorAll('*')) {
    for (const pseudo of ['::before', '::after']) {
      const c = getComputedStyle(el, pseudo).content;
      if (c && c !== 'none' && c !== 'normal' && c.length > 2 && c.startsWith('"')) pedacos.push(c.slice(1, -1));
    }
  }
  const enderecos = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const h = (a.getAttribute('href') || '').trim();
    const baixo = h.toLowerCase();
    if (baixo.startsWith('tel:') || baixo.startsWith('mailto:')) enderecos.push(h);
  }
  return { texto: pedacos.join('\n'), enderecos };
}

// Métricas de carregamento da própria página: LCP, CLS, FCP e tempos da navegação.
export async function metricas() {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const coletar = (tipo) => new Promise((resolve) => {
    const lista = [];
    try {
      const obs = new PerformanceObserver((l) => lista.push(...l.getEntries()));
      obs.observe({ type: tipo, buffered: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(lista);
      }, 400);
    } catch (e) {
      resolve(lista);
    }
  });
  await dormir(300);
  const lcp = await coletar('largest-contentful-paint');
  const cls = await coletar('layout-shift');
  const nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
  const ultimo = lcp.length ? lcp[lcp.length - 1] : null;
  let soma = 0;
  for (const e of cls) if (!e.hadRecentInput) soma += e.value;
  let elementoLcp = null;
  if (ultimo && ultimo.element) {
    const el = ultimo.element;
    elementoLcp = `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ''}`;
  }
  return {
    lcp_ms: ultimo ? Math.round(ultimo.startTime) : null,
    lcp_elemento: elementoLcp,
    cls: Math.round(soma * 1000) / 1000,
    fcp_ms: fcp ? Math.round(fcp.startTime) : null,
    dom_pronto_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    carregada_ms: nav ? Math.round(nav.loadEventEnd) : null,
  };
}
