// Teste de teclado do menu: quem navega pelo teclado escolhe um item do menu que leva a uma parte da
// mesma página, aperta Enter e depois Tab. O Tab precisa seguir DENTRO (ou depois) da parte
// escolhida. Achado do piloto: com rolagem suave feita por script, o foco ficava no menu e o
// Tab seguinte voltava para o topo da página. Teclas de verdade (DevTools), página sem assentar
// (o script de rolagem do site precisa estar vivo para o teste valer).
import { esperar } from './cdp.mjs';
import { visitar } from './sessao.mjs';

const ESPERA_ROLAGEM_MS = 300;
const TETO_ROLAGEM_MS = 6000;
const ESPERA_TECLA_MS = 150;
const ESPERA_MENU_MS = 400;

const TECLAS = Object.freeze({
  Enter: { key: 'Enter', code: 'Enter', vk: 13, texto: '\r' },
  Tab: { key: 'Tab', code: 'Tab', vk: 9, texto: '' },
});

async function apertar(tab, nome) {
  const t = TECLAS[nome];
  const base = { key: t.key, code: t.code, windowsVirtualKeyCode: t.vk, nativeVirtualKeyCode: t.vk };
  await tab.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  if (t.texto) await tab.send('Input.dispatchKeyEvent', { type: 'char', key: t.key, code: t.code, text: t.texto, unmodifiedText: t.texto });
  await tab.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

// Roda DENTRO da página. acao: 'plano' | 'botao' | 'link' (k) | 'onde' (id da parte).
export function menuDaPagina(acao, arg) {
  // para o Tab, conta o que existe na tela; transparente ainda recebe foco (a página não foi assentada)
  const visivel = (el) => {
    try {
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false;
    } catch (e) {}
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const descrever = (el) => {
    if (!el || el === document.body || el === document.documentElement) return 'o começo da página';
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().split('\n').join(' ');
    return `${el.tagName.toLowerCase()} "${t.slice(0, 40)}"`;
  };
  // "/" e "/index.html" são a mesma página
  const pagina = (p) => (p.endsWith('/index.html') ? p.slice(0, -'index.html'.length) : p);
  const alvoDe = (a) => {
    if (!a.hash || a.hash.length < 2 || a.origin !== location.origin || pagina(a.pathname) !== pagina(location.pathname)) return null;
    return document.getElementById(decodeURIComponent(a.hash.slice(1)));
  };
  // o menu do topo; sem cabeçalho, o primeiro menu da página
  const links = () => {
    const doTopo = [...document.querySelectorAll('header a[href]')].filter((a) => visivel(a) && alvoDe(a));
    if (doTopo.length) return doTopo;
    const menu = document.querySelector('nav, [role="navigation"]');
    return menu ? [...menu.querySelectorAll('a[href]')].filter((a) => visivel(a) && alvoDe(a)) : [];
  };
  const botao = () => [...document.querySelectorAll('header [aria-expanded], nav [aria-expanded]')].find(visivel) || null;
  const FOCAVEIS = 'a[href], button, input, textarea, select, summary, [tabindex]:not([tabindex="-1"])';
  const MARCA = 'data-estudio-proximo-foco';
  // o primeiro elemento do Tab dentro da parte ou logo depois dela: é onde o Tab precisa chegar
  const primeiroDepois = (alvo) => [...document.querySelectorAll(FOCAVEIS)].find((el) => visivel(el)
    && !el.disabled && (alvo.contains(el) || (alvo.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)));

  if (acao === 'plano') return { links: links().length, botao: Boolean(botao()) };
  if (acao === 'botao') {
    const b = botao();
    if (b) b.focus();
    return Boolean(b) && document.activeElement === b;
  }
  if (acao === 'link') {
    const lista = links();
    const a = lista[lista.length - 1 - arg];
    if (!a) return null;
    const alvo = alvoDe(a);
    const proximo = primeiroDepois(alvo);
    if (proximo) proximo.setAttribute(MARCA, '');
    a.focus();
    return { id: alvo.id, link: descrever(a), focado: document.activeElement === a, temDepois: Boolean(proximo) };
  }
  const alvo = document.getElementById(arg);
  const foco = document.activeElement;
  const certo = alvo && foco && foco !== document.body && (alvo.contains(foco) || foco.hasAttribute(MARCA));
  return { ok: Boolean(certo), foco: descrever(foco) };
}

// Roda DENTRO da página: espera a rolagem (suave ou não) parar de vez, com teto. Quem usa o teclado
// espera a página chegar; o script do site costuma mover o foco só no fim da rolagem.
export async function rolagemParada(teto) {
  const quadro = () => new Promise((r) => requestAnimationFrame(() => r()));
  const inicio = performance.now();
  let ultimo = scrollY;
  let parado = 0;
  while (performance.now() - inicio < teto) {
    await quadro();
    if (Math.abs(scrollY - ultimo) < 0.5) parado += 1;
    else parado = 0;
    ultimo = scrollY;
    if (parado >= 20) return true;
  }
  return false;
}

async function abrirPagina(sessao, pagina, tamanho) {
  await visitar(sessao, pagina, tamanho, { assentar: false });
  await sessao.tab.send('Emulation.setFocusEmulationEnabled', { enabled: true });
}

// Devolve os problemas achados: [{ link, parte, foco }]. maximo = quantos itens do menu testar
// (do último para o primeiro: os do fim levam mais longe na página).
export async function focoDepoisDoMenu(sessao, pagina, tamanho, { maximo = 1 } = {}) {
  await abrirPagina(sessao, pagina, tamanho);
  let plano = await sessao.avaliar(menuDaPagina, 'plano', null);
  let viaBotao = false;
  if (!plano.links && plano.botao) {
    // menu do celular: abre pelo teclado antes de escolher o item
    await sessao.avaliar(menuDaPagina, 'botao', null);
    await apertar(sessao.tab, 'Enter');
    await esperar(ESPERA_MENU_MS);
    plano = await sessao.avaliar(menuDaPagina, 'plano', null);
    viaBotao = true;
  }
  const problemas = [];
  for (let k = 0; k < Math.min(maximo, plano.links); k += 1) {
    await abrirPagina(sessao, pagina, tamanho);
    if (viaBotao) {
      if (!(await sessao.avaliar(menuDaPagina, 'botao', null))) continue;
      await apertar(sessao.tab, 'Enter');
      await esperar(ESPERA_MENU_MS);
    }
    const item = await sessao.avaliar(menuDaPagina, 'link', k);
    if (!item || !item.focado || !item.temDepois) continue;
    await apertar(sessao.tab, 'Enter');
    await esperar(ESPERA_ROLAGEM_MS);
    await sessao.avaliar(rolagemParada, TETO_ROLAGEM_MS);
    await esperar(ESPERA_TECLA_MS);
    await apertar(sessao.tab, 'Tab');
    await esperar(ESPERA_TECLA_MS);
    const r = await sessao.avaliar(menuDaPagina, 'onde', item.id);
    if (!r.ok) problemas.push({ link: item.link, parte: `#${item.id}`, foco: r.foco });
  }
  return problemas;
}
