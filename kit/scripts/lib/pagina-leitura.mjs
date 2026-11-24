// Conferências que a revisão do piloto pegava com olho e o computador pega sozinho. Rodam DENTRO da
// página (via sessao.avaliar), com o movimento assentado: não podem usar nada de fora delas mesmas.
// Leitura pelo DOM, sem expressão regular.

// Foto exibida maior que o arquivo: a imagem fica borrada ("esticada"). Mede com object-fit: em
// "cover" a escala é a maior das duas, em "contain" a menor. SVG não estica (é desenho).
// O tamanho do arquivo vem de uma cópia sem srcset: com srcset, naturalWidth já vem dividido pela
// densidade que o "sizes" pediu, e esconderia justamente o "sizes" errado.
export async function fotosEsticadas(L) {
  const lista = [];
  const tamanhoDoArquivo = async (src) => {
    const copia = new Image();
    copia.src = src;
    try {
      await copia.decode();
    } catch (e) {
      return null;
    }
    return { nw: copia.naturalWidth, nh: copia.naturalHeight };
  };
  for (const img of document.images) {
    if (!img.complete || !img.naturalWidth) continue;
    const src = String(img.currentSrc || img.src || '');
    const arquivo = src.split('?')[0].split('#')[0].split('/').pop() || src;
    if (arquivo.toLowerCase().endsWith('.svg')) continue;
    try {
      if (img.checkVisibility && !img.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    } catch (e) {}
    const r = img.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const arq = await tamanhoDoArquivo(src);
    if (!arq || !arq.nw || !arq.nh) continue;
    const { nw, nh } = arq;
    const ajuste = getComputedStyle(img).objectFit;
    const ex = r.width / nw;
    const ey = r.height / nh;
    let escala = Math.max(ex, ey);
    if (ajuste === 'contain' || ajuste === 'scale-down') escala = Math.min(ex, ey);
    else if (ajuste === 'none') escala = 1;
    if (escala > L.foto_escala) {
      lista.push({
        tipo: 'foto-esticada',
        detalhe: `${arquivo} tem ${nw}x${nh} px e aparece com ${Math.round(r.width)}x${Math.round(r.height)} px (${Math.round(escala * 100)}% do tamanho): use um arquivo maior, mostre a foto menor ou acerte o sizes`,
      });
    }
  }
  return lista.slice(0, L.maximo);
}

// Linha de leitura longa demais: no tablet, é o sinal do "celular esticado". Conta as linhas pelo
// desenho de verdade do texto (Range) e divide as letras pelas linhas.
export function linhasLongas(L) {
  const lista = [];
  const BLOCOS = 'p, li, blockquote, dd, figcaption';
  for (const el of document.body.querySelectorAll(BLOCOS)) {
    if (el.closest('[aria-hidden="true"], nav, [data-medir-nao]')) continue;
    try {
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    } catch (e) {}
    const texto = (el.innerText || '').trim();
    if (texto.length < L.linha_texto_minimo) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize) || 16;
    const altura = parseFloat(cs.lineHeight) || px * 1.2;
    const intervalo = document.createRange();
    intervalo.selectNodeContents(el);
    const topos = [...intervalo.getClientRects()].filter((q) => q.width > 1 && q.height > 1).map((q) => q.top).sort((a, b) => a - b);
    let linhas = 0;
    let ultimo = null;
    for (const t of topos) {
      if (ultimo === null || t - ultimo > altura * 0.5) linhas += 1;
      ultimo = t;
    }
    if (linhas < 3) continue;
    const porLinha = Math.round(texto.length / linhas);
    if (porLinha > L.linha_maxima) {
      const id = el.id ? `#${el.id}` : el.classList[0] ? `.${el.classList[0]}` : '';
      lista.push({ tipo: 'linha-longa', detalhe: `${porLinha} letras por linha (o confortável vai até ${L.linha_maxima}): ${el.tagName.toLowerCase()}${id} "${texto.slice(0, 40)}…"` });
    }
  }
  return lista.slice(0, L.maximo);
}

// Link e frase iguais repetidos na mesma página ("Como chegar" 4 vezes, a mesma frase em 3 partes).
// Só conta o que está à vista: menu do celular escondido no computador não entra.
export function repeticoes(L) {
  const juntar = (t) => {
    let s = '';
    let espaco = false;
    for (const ch of String(t || '')) {
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === ' ') espaco = true;
      else {
        if (espaco && s) s += ' ';
        espaco = false;
        s += ch;
      }
    }
    let fim = s.length;
    while (fim > 0 && '.!?;:'.includes(s[fim - 1])) fim -= 1;
    return s.slice(0, fim).toLowerCase();
  };
  const aVista = (el) => {
    if (el.closest('[aria-hidden="true"], [data-medir-nao]')) return false;
    try {
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    } catch (e) {}
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const contar = (mapa, chave, original) => {
    const atual = mapa.get(chave) || { texto: original, vezes: 0 };
    atual.vezes += 1;
    mapa.set(chave, atual);
  };
  const links = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    if (!aVista(a)) continue;
    const original = juntar(a.getAttribute('aria-label') || a.innerText);
    if (original) contar(links, original, (a.innerText || a.getAttribute('aria-label') || '').trim());
  }
  // a frase é o texto do bloco onde ela mora (o primeiro ancestral que não é "em linha")
  const blocos = new Set();
  const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = andar.nextNode(); n; n = andar.nextNode()) {
    if (!n.textContent.trim()) continue;
    let el = n.parentElement;
    if (!el || el.closest('script, style, noscript, template, a, button, svg')) continue;
    while (el && el !== document.body && getComputedStyle(el).display.startsWith('inline')) el = el.parentElement;
    if (el && el !== document.body) blocos.add(el);
  }
  const frases = new Map();
  for (const el of blocos) {
    if (!aVista(el)) continue;
    const chave = juntar(el.innerText);
    if (chave.length >= L.frase_minima) contar(frases, chave, (el.innerText || '').trim().split('\n').join(' '));
  }
  const lista = [];
  for (const { texto, vezes } of links.values()) {
    if (vezes >= L.link_repetido) lista.push({ tipo: 'link-repetido', detalhe: `"${texto.slice(0, 60)}" aparece ${vezes} vezes como link na página` });
  }
  for (const { texto, vezes } of frases.values()) {
    if (vezes >= L.frase_repetida) lista.push({ tipo: 'frase-repetida', detalhe: `"${texto.slice(0, 60)}" aparece ${vezes} vezes na página` });
  }
  return lista.slice(0, L.maximo);
}

// Pedido montado na página (kit/pecas/pedido.js): confere o HTML como chegou do gerador, antes de
// qualquer script rodar (é o que quem abre sem JavaScript recebe). Lê a página de novo pela rede e
// abre com DOMParser, que não executa nada.
// RED: pedido-sem-whatsapp (data-whatsapp sem dígito), pedido-link-quebrado (botão que não leva ao
// WhatsApp do pedido, ou com a mensagem vazia ou sem codificar), pedido-opcao-sem-valor (item sem
// nome em data-item, ou caixa de marcar/rádio de campo sem data-valor), pedido-fala-a-cada-letra
// (aria-live no resumo da mensagem). WARN: pedido-opcao-marcada (opção que já vem marcada: só com
// um fato com fonte que a sustente).
export async function pedidos() {
  const red = [];
  const warn = [];
  if (!document.querySelector('form[data-pedido]')) return { red, warn };
  let bruto;
  try {
    const resposta = await fetch(location.href, { cache: 'no-store' });
    bruto = new DOMParser().parseFromString(await resposta.text(), 'text/html');
  } catch (e) {
    return { red, warn: [{ tipo: 'pedido-nao-conferido', detalhe: `não deu para reler a página: ${String(e.message || e).slice(0, 120)}` }] };
  }
  const digitos = (t) => {
    let s = '';
    for (const ch of String(t || '')) if (ch >= '0' && ch <= '9') s += ch;
    return s;
  };
  const bemCodificado = (t) => {
    try {
      return encodeURIComponent(decodeURIComponent(t)) === t;
    } catch (e) {
      return false;
    }
  };
  bruto.querySelectorAll('form[data-pedido]').forEach((form, i) => {
    const qual = form.id ? `pedido #${form.id}` : `pedido ${i + 1}`;
    const numero = digitos(form.getAttribute('data-whatsapp'));
    if (!numero) red.push({ tipo: 'pedido-sem-whatsapp', detalhe: `${qual}: falta o número do WhatsApp (data-whatsapp, com país e DDD)` });
    const botao = form.querySelector('a[data-pedido-enviar]');
    if (!botao) red.push({ tipo: 'pedido-link-quebrado', detalhe: `${qual}: falta o botão de enviar (a com data-pedido-enviar) dentro do formulário` });
    else if (numero) {
      const href = botao.getAttribute('href') || '';
      const inicio = `https://wa.me/${numero}?text=`;
      const texto = href.startsWith(inicio) ? href.slice(inicio.length) : null;
      if (texto === null) red.push({ tipo: 'pedido-link-quebrado', detalhe: `${qual}: o botão não leva ao WhatsApp ${numero} com a mensagem pronta (use whatsapp() do gerador)` });
      else if (!texto) red.push({ tipo: 'pedido-link-quebrado', detalhe: `${qual}: o botão leva a mensagem vazia` });
      else if (!bemCodificado(texto)) red.push({ tipo: 'pedido-link-quebrado', detalhe: `${qual}: a mensagem do botão não está codificada e se corta sem JavaScript (use whatsapp() do gerador)` });
    }
    form.querySelectorAll('[data-item]').forEach((el) => {
      if (!el.getAttribute('data-item').trim()) red.push({ tipo: 'pedido-opcao-sem-valor', detalhe: `${qual}: item sem nome em data-item` });
    });
    form.querySelectorAll('input[type="checkbox"][data-campo], input[type="radio"][data-campo]').forEach((el) => {
      if (!(el.getAttribute('data-valor') || '').trim()) red.push({ tipo: 'pedido-opcao-sem-valor', detalhe: `${qual}: opção de "${el.getAttribute('data-campo')}" sem data-valor (a mensagem diria "on")` });
    });
    const resumo = form.querySelector('[data-pedido-mensagem]');
    if (resumo && resumo.closest('[aria-live]')) red.push({ tipo: 'pedido-fala-a-cada-letra', detalhe: `${qual}: o resumo da mensagem está numa região viva (aria-live); quem fala é o data-pedido-aviso com role="status"` });
    form.querySelectorAll('input[checked]').forEach((el) => {
      const nome = el.getAttribute('data-item') || el.getAttribute('data-valor') || el.getAttribute('data-campo') || el.name || 'opção';
      warn.push({ tipo: 'pedido-opcao-marcada', detalhe: `${qual}: "${nome}" já vem marcada; só com um fato com fonte que sustente a escolha` });
    });
  });
  return { red, warn };
}
