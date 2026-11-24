// Sessão de navegador para um site: servidor local na pasta site/ + Chrome sem janela + uma aba.
// Registra o que a rede pediu (endereço externo, arquivo que não carregou, peso) e os erros de
// JavaScript da página (exceção e console.error). O tamanho de tela troca a qualquer momento.
// O navegador abre com o desenho 3D por software ligado (cdp.mjs, ARGS_3D), então a sessão
// recusa todo pedido que não seja do próprio computador: endereço de fora aparece na rede como
// pedido recusado (o checar acusa), mas nada de fora chega a rodar na página.
import path from 'node:path';
import { launch, openTab, navegar, esperar } from './cdp.mjs';
import { servir } from './servidor.mjs';

// Roda uma função DENTRO da página. A função vai como texto: não pode usar nada de fora dela.
export function chamada(fn, ...args) {
  return `(${fn.toString()})(${args.map((a) => JSON.stringify(a === undefined ? null : a)).join(', ')})`;
}

// deps: as peças de verdade; os testes trocam por falsas para simular falha no meio.
const PECAS = Object.freeze({ launch, openTab, servir });

// Só o próprio computador: pedido para outro endereço é recusado antes de sair.
const LOCAIS = Object.freeze(['127.0.0.1', 'localhost', '[::1]']);
export function ehLocal(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return true;
  return (u.protocol === 'http:' || u.protocol === 'https:') && LOCAIS.includes(u.hostname);
}

async function apenasLocal(tab) {
  tab.on((m) => {
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const passa = ehLocal(request.url);
    // a resposta pode chegar com a aba já fechando (fim da conferência): nada a fazer
    tab.send(passa ? 'Fetch.continueRequest' : 'Fetch.failRequest', passa ? { requestId } : { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
  });
  await tab.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
}

export async function abrirSessao(raizServida, { tamanho = null } = {}, deps = PECAS) {
  const srv = await deps.servir(raizServida);
  let nav = null;
  let tab = null;
  // Qualquer falha na partida fecha o que já abriu: aba, Chrome e servidor não ficam soltos.
  try {
    nav = await deps.launch({ largura: 1920, altura: 1080, com3d: true });
    tab = await deps.openTab(nav.porta);
    await apenasLocal(tab);
    await tab.send('Page.enable');
    await tab.send('Runtime.enable');
    await tab.send('Network.enable');
    await tab.send('Network.setCacheDisabled', { cacheDisabled: true });
    return await montarSessao(srv, nav, tab, tamanho);
  } catch (e) {
    try {
      tab?.close();
    } catch {}
    try {
      nav?.close();
    } catch {}
    await srv.fechar();
    throw e;
  }
}

async function montarSessao(srv, nav, tab, tamanho) {
  let pedidos = new Map();
  let errosJs = [];
  tab.on((m) => {
    if (m.method === 'Network.requestWillBeSent') {
      pedidos.set(m.params.requestId, { url: m.params.request.url, tipo: m.params.type || '', status: null, falhou: null, bytes: 0 });
    } else if (m.method === 'Network.responseReceived') {
      const p = pedidos.get(m.params.requestId);
      if (p) p.status = m.params.response.status;
    } else if (m.method === 'Network.loadingFinished') {
      const p = pedidos.get(m.params.requestId);
      if (p) p.bytes = m.params.encodedDataLength || 0;
    } else if (m.method === 'Network.loadingFailed') {
      const p = pedidos.get(m.params.requestId);
      if (p && !m.params.canceled) p.falhou = m.params.errorText || 'falhou';
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      // erro que a própria página escreveu (ex.: o 3D que não compilou e voltou para a reserva)
      const texto = (m.params.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ');
      errosJs.push(`console.error: ${texto}`.split('\n')[0].slice(0, 240));
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      const ex = d.exception || {};
      errosJs.push(String(ex.description || d.text || 'erro de JavaScript').split('\n')[0].slice(0, 240));
    }
  });

  const sessao = {
    srv,
    tab,
    portaDevtools: nav.porta,
    origem: srv.origem,
    url: (rel) => `${srv.origem}/${rel.split(path.sep).join('/')}`,
    zerar: () => {
      pedidos = new Map();
      errosJs = [];
    },
    errosJs: () => [...new Set(errosJs)],
    // pedidos para fora da origem local, pedidos que falharam e o peso de cada arquivo
    rede: () => {
      const externos = [];
      const quebrados = [];
      const arquivos = [];
      for (const p of pedidos.values()) {
        const u = p.url;
        if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:') || u.startsWith('chrome')) continue;
        if (!u.startsWith(`${srv.origem}/`)) {
          externos.push(u);
          continue;
        }
        const rel = u.slice(srv.origem.length);
        arquivos.push({ url: rel, tipo: p.tipo, bytes: p.bytes });
        if (p.falhou || (p.status !== null && p.status >= 400)) quebrados.push({ url: rel, status: p.status || 0, erro: p.falhou || '' });
      }
      return { externos: [...new Set(externos)], quebrados, arquivos };
    },
    avaliar: (fn, ...args) => tab.evaluate(chamada(fn, ...args), 120000),
    // Troca o tamanho da tela. reduzido = emula "reduzir movimento" do sistema.
    tamanho: async (t, { reduzido = false } = {}) => {
      await tab.send('Emulation.setDeviceMetricsOverride', {
        width: t.largura,
        height: t.altura,
        deviceScaleFactor: 1,
        mobile: Boolean(t.movel),
      });
      await tab.send('Emulation.setTouchEmulationEnabled', { enabled: Boolean(t.movel), maxTouchPoints: t.movel ? 5 : 1 });
      await tab.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduzido ? 'reduce' : 'no-preference' }],
      });
    },
    ir: async (url) => {
      await navegar(tab, url);
    },
    fechar: async () => {
      try {
        tab.close();
      } catch {}
      try {
        nav.close();
      } catch {}
      await srv.fechar();
    },
  };
  if (tamanho) await sessao.tamanho(tamanho);
  await esperar(10);
  return sessao;
}

// Abre uma página do site num tamanho de tela e deixa o movimento assentado.
// Devolve { altura, largura } do documento já assentado.
export async function visitar(sessao, pagina, tamanho, { reduzido = false, assentar: deveAssentar = true } = {}) {
  const { pronta, assentar } = await import('./pagina.mjs');
  await sessao.tamanho(tamanho, { reduzido });
  sessao.zerar();
  await sessao.ir(sessao.url(pagina.url || pagina.rel));
  const p = await sessao.avaliar(pronta);
  if (!deveAssentar) return { altura: p.altura, largura: tamanho.largura };
  return sessao.avaliar(assentar);
}
