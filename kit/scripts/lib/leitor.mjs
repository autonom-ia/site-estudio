// Leitor de páginas da internet: o mesmo navegador sem janela do estúdio, numa aba de computador,
// em português, sem o "Headless" na identificação (alguns sites mostram página vazia para ele).
// Só lê: nada é enviado, publicado nem preenchido. Sem senha e sem cookie do Chrome da pessoa.
// Com perfil (opcoes.perfil), abre a pasta de perfil guardada do estúdio: é como a leitura do
// Instagram usa o login que a pessoa fez na janela do estúdio (lib/instagram-conta.mjs).
import { launch, openTab, navegar, esperar } from './cdp.mjs';
import { chamada } from './sessao.mjs';

const LARGURA = 1280;
const ALTURA = 900;
const IDIOMA = 'pt-BR,pt;q=0.9,en;q=0.5';
const PAUSA_DA_ESPERA_MS = 300;
const TETO_DE_AVALIAR_MS = 60000;

// deps: as peças de verdade; os testes podem trocar.
const PECAS = Object.freeze({ launch, openTab });

// opcoes: { perfil, navegador } repassados ao launch (perfil guardado e navegador escolhido).
export async function abrirLeitor(deps = PECAS, opcoes = {}) {
  const nav = await deps.launch({ largura: LARGURA, altura: ALTURA, ...opcoes });
  let tab = null;
  try {
    tab = await deps.openTab(nav.porta);
    await tab.send('Page.enable');
    await tab.send('Runtime.enable');
    await tab.send('Network.enable');
    const agente = String(await tab.evaluate('navigator.userAgent', 5000)).split('Headless').join('');
    await tab.send('Network.setUserAgentOverride', { userAgent: agente, acceptLanguage: IDIOMA });
    await tab.send('Emulation.setDeviceMetricsOverride', { width: LARGURA, height: ALTURA, deviceScaleFactor: 1, mobile: false });
  } catch (e) {
    try {
      tab?.close();
    } catch {}
    nav.close();
    throw e;
  }
  const avaliar = (fn, ...args) => tab.evaluate(chamada(fn, ...args), TETO_DE_AVALIAR_MS);
  return {
    ir: (url) => navegar(tab, url),
    avaliar,
    endereco: () => tab.evaluate('location.href', 5000),
    // Repete a função na página até ela devolver algo verdadeiro ou o prazo acabar.
    esperarAte: async (fn, prazoMs, ...args) => {
      const fim = Date.now() + prazoMs;
      let ultimo = null;
      while (Date.now() < fim) {
        try {
          ultimo = await avaliar(fn, ...args);
          if (ultimo) return ultimo;
        } catch {
          /* a página ainda está trocando */
        }
        await esperar(PAUSA_DA_ESPERA_MS);
      }
      return ultimo;
    },
    // Cookies que a aba mandaria a estes endereços (só para conferir se há login; nunca vão para a saída).
    cookies: async (urls) => (await tab.send('Network.getCookies', { urls })).cookies || [],
    // Guarda o texto das respostas que a própria página pede e que a função aceita (endereço, tipo).
    // Devolve { textos() (espera as que ainda estão chegando), parar() }.
    escutarRespostas: (aceita) => escutarRespostas(tab, aceita),
    fechar: () => {
      try {
        tab.close();
      } catch {}
      try {
        nav.close();
      } catch {}
    },
    // Fecha pedindo ao navegador: com perfil guardado, ele grava os cookies antes de sair.
    fecharComCalma: async () => {
      try {
        tab.close();
      } catch {}
      if (nav.fecharComCalma) await nav.fecharComCalma();
      else nav.close();
    },
  };
}

function escutarRespostas(tab, aceita) {
  const pedidos = new Set();
  const textos = [];
  const pendentes = [];
  const ouvinte = (m) => {
    const p = m.params || {};
    if (m.method === 'Network.responseReceived' && p.response && aceita(String(p.response.url || ''), String(p.response.mimeType || ''))) pedidos.add(p.requestId);
    else if (m.method === 'Network.loadingFinished' && pedidos.has(p.requestId)) {
      pedidos.delete(p.requestId);
      const lido = tab
        .send('Network.getResponseBody', { requestId: p.requestId })
        .then((r) => textos.push(r.base64Encoded ? Buffer.from(r.body, 'base64').toString('utf8') : r.body))
        .catch(() => {});
      pendentes.push(lido);
    }
  };
  tab.on(ouvinte);
  return {
    textos: async () => {
      await Promise.allSettled(pendentes);
      return [...textos];
    },
    parar: () => tab.off(ouvinte),
  };
}

// Percorre um valor de JSON (objetos e listas) e devolve todo objeto que a função aceita.
export function acharObjetos(valor, aceita, limite = 500) {
  const achados = [];
  const pilha = [valor];
  const vistos = new Set();
  while (pilha.length && achados.length < limite) {
    const v = pilha.pop();
    if (!v || typeof v !== 'object' || vistos.has(v)) continue;
    vistos.add(v);
    if (!Array.isArray(v) && aceita(v)) achados.push(v);
    const filhos = Array.isArray(v) ? v : Object.values(v);
    for (let i = filhos.length - 1; i >= 0; i -= 1) pilha.push(filhos[i]);
  }
  return achados;
}

// JSON.parse que não derruba a leitura: texto quebrado vira null.
export function jsonOuNada(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

// Data do dia, AAAA-MM-DD, no fuso do computador.
export function hoje(agora = new Date()) {
  const dois = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

// Endereço sem âncora, para comparar e não visitar a mesma página duas vezes.
export function semAncora(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return '';
  }
}
