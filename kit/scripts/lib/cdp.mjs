// Navegador sem janela + DevTools Protocol, sem dependência (WebSocket nativo do Node 22+).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { acharNavegador, ehShell } from './chrome.mjs';
import { EH_WINDOWS, EH_MAC } from './caminhos.mjs';
import { falha, KitErro } from './saida.mjs';

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const TETO_CHAMADA_MS = 30000;
const TETO_SUBIDA_MS = 20000;
// Prazo de cada pergunta ao DevTools durante a subida e da aba nova (endereço e WebSocket).
const TETO_PEDIDO_MS = 2000;
const TETO_ABA_MS = 10000;
const TETO_FECHAR_MS = 5000;

// Prazo de um pedido sem passar do prazo total que ainda resta.
const prazo = (fim, teto) => AbortSignal.timeout(Math.max(1, Math.min(teto, fim - Date.now())));

function portaLivre() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

// Argumentos de cada jeito de abrir. Sem janela: o mesmo navegador escondido de sempre. Com
// janela: um Chrome normal, para a pessoa usar. Perfil guardado (login do Instagram): a chave dos
// cookies não vem do chaveiro do sistema (no Mac, a janela e o modo sem janela usam chaves diferentes
// e um não leria o login do outro; e o chaveiro pediria a senha do computador à pessoa).
export function argumentosDoNavegador({ caminho, porta, perfil, comJanela = false, guardado = false, largura, altura }) {
  const args = [];
  if (!comJanela) args.push(ehShell(caminho) ? '--headless' : '--headless=new', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1');
  args.push(
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${largura},${altura}`,
  );
  if (guardado) {
    if (EH_MAC) args.push('--use-mock-keychain');
    else if (!EH_WINDOWS) args.push('--password-store=basic');
    args.push('--hide-crash-restore-bubble');
  }
  if (!EH_MAC && !EH_WINDOWS && !comJanela) args.push('--no-sandbox');
  return args;
}

// Abre o navegador. largura/altura = tamanho da janela (viewport inicial).
// perfil: pasta de perfil guardada (não é apagada ao fechar); sem ela, um perfil temporário.
// comJanela: Chrome normal, visível. navegador: { caminho } já escolhido. endereco: a primeira página.
export async function launch({ largura = 1920, altura = 1080, perfil = '', comJanela = false, navegador = null, endereco = 'about:blank' } = {}) {
  const achado = navegador || acharNavegador();
  if (!achado) falha('CHROME_NAO_ACHADO', {});
  const porta = await portaLivre();
  const guardado = Boolean(perfil);
  const pastaPerfil = guardado ? perfil : fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-cdp-'));
  const args = argumentosDoNavegador({ caminho: achado.caminho, porta, perfil: pastaPerfil, comJanela, guardado, largura, altura });
  const proc = spawn(achado.caminho, [...args, endereco], { stdio: 'ignore', windowsHide: !comJanela });
  let morreu = false;
  const saiu = new Promise((res) => {
    proc.on('error', () => {
      morreu = true;
      res();
    });
    proc.on('exit', () => {
      morreu = true;
      res();
    });
  });
  const close = () => {
    try {
      proc.kill('SIGKILL');
    } catch {}
    if (guardado) return;
    // o Windows segura o perfil por um instante depois de matar o processo
    setTimeout(() => {
      try {
        fs.rmSync(pastaPerfil, { recursive: true, force: true });
      } catch {}
    }, 300);
  };
  // Fecha pedindo ao navegador (ele grava os cookies no disco antes de sair). Sem resposta no
  // prazo, mata o processo.
  const fecharComCalma = async (prazoMs = TETO_FECHAR_MS) => {
    if (!morreu) {
      try {
        const nav = await conectarNavegador(porta, { prazoMs: TETO_ABA_MS });
        nav.send('Browser.close', {}, prazoMs).catch(() => {});
        await Promise.race([saiu, esperar(prazoMs)]);
        nav.close();
      } catch {
        /* sem conexão: vai à força */
      }
    }
    close();
  };
  const fim = Date.now() + TETO_SUBIDA_MS;
  while (Date.now() < fim && !morreu) {
    try {
      // sem prazo, um navegador que aceita a conexão e não responde prenderia o laço para sempre
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`, { signal: prazo(fim, TETO_PEDIDO_MS) });
      if (r.ok) return { porta, close, fecharComCalma, vivo: () => !morreu, navegador: achado };
    } catch {
      /* subindo */
    }
    await esperar(150);
  }
  close();
  falha('CHROME_NAO_ABRIU', { navegador: achado.caminho });
  return null;
}

// Espera o WebSocket abrir até o prazo; vencido ou com erro, fecha o socket e dá CHROME_NAO_ABRIU.
function esperarAbrir(ws, fim) {
  return new Promise((res, rej) => {
    const desistir = (detalhe) => {
      clearTimeout(t);
      try {
        ws.close();
      } catch {}
      rej(new KitErro('CHROME_NAO_ABRIU', { detalhe }, 1));
    };
    const t = setTimeout(() => desistir('o DevTools não abriu a conexão da aba no prazo'), Math.max(1, fim - Date.now()));
    ws.onopen = () => {
      clearTimeout(t);
      res();
    };
    ws.onerror = () => desistir('a conexão com o DevTools falhou');
  });
}

// prazoMs: tempo total para criar a aba e abrir a conexão (os testes encurtam).
export async function openTab(porta, { prazoMs = TETO_ABA_MS } = {}) {
  const fim = Date.now() + prazoMs;
  let info = null;
  for (const metodo of ['PUT', 'GET']) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: metodo, signal: prazo(fim, prazoMs) });
      if (r.ok) {
        info = await r.json();
        break;
      }
    } catch {
      /* tenta o próximo */
    }
  }
  if (!info || typeof info.webSocketDebuggerUrl !== 'string') falha('CHROME_NAO_ABRIU', { detalhe: 'aba nova' });
  return conectar(info.webSocketDebuggerUrl, fim);
}

// Conexão com o navegador inteiro (não com uma aba): cookies, abas abertas e fechar.
export async function conectarNavegador(porta, { prazoMs = TETO_ABA_MS } = {}) {
  const fim = Date.now() + prazoMs;
  let info = null;
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/json/version`, { signal: prazo(fim, prazoMs) });
    if (r.ok) info = await r.json();
  } catch {
    /* sem resposta */
  }
  if (!info || typeof info.webSocketDebuggerUrl !== 'string') falha('CHROME_NAO_ABRIU', { detalhe: 'conexão com o navegador' });
  return conectar(info.webSocketDebuggerUrl, fim);
}

// Abre o WebSocket do DevTools e devolve { send, evaluate, on, off, close, aberta }.
async function conectar(endereco, fim) {
  let ws;
  try {
    ws = new WebSocket(endereco);
  } catch (e) {
    falha('CHROME_NAO_ABRIU', { detalhe: String(e.message) });
  }
  await esperarAbrir(ws, fim);
  let id = 0;
  const pend = new Map();
  const ouvintes = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) {
      const { res, rej } = pend.get(m.id);
      pend.delete(m.id);
      if (m.error) rej(new Error(m.error.message));
      else res(m.result);
    } else if (m.method) ouvintes.forEach((f) => f(m));
  };
  let aberta = true;
  ws.onclose = () => {
    aberta = false;
    for (const { rej } of pend.values()) rej(new Error('DevTools fechou a conexão'));
    pend.clear();
  };
  const send = (method, params = {}, teto = TETO_CHAMADA_MS) =>
    new Promise((res, rej) => {
      id += 1;
      const i = id;
      const t = setTimeout(() => {
        pend.delete(i);
        rej(new Error(`DevTools não respondeu: ${method}`));
      }, teto);
      pend.set(i, {
        res: (v) => {
          clearTimeout(t);
          res(v);
        },
        rej: (e) => {
          clearTimeout(t);
          rej(e);
        },
      });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression, teto) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, teto);
    if (r.exceptionDetails) {
      const ex = r.exceptionDetails.exception;
      throw new Error((ex && ex.description) || r.exceptionDetails.text || 'erro na página');
    }
    return r.result.value;
  };
  return {
    send,
    evaluate,
    on: (f) => ouvintes.push(f),
    off: (f) => {
      const k = ouvintes.indexOf(f);
      if (k !== -1) ouvintes.splice(k, 1);
    },
    close: () => ws.close(),
    aberta: () => aberta,
  };
}

// Navega e espera o documento terminar de carregar.
export async function navegar(tab, url, teto = 30000) {
  await tab.send('Page.navigate', { url });
  const inicio = Date.now();
  await esperar(50);
  while (Date.now() - inicio < teto) {
    try {
      const pronto = await tab.evaluate(`document.readyState === 'complete' && location.href !== 'about:blank'`, 5000);
      if (pronto) return;
    } catch {
      /* contexto trocando durante a navegação */
    }
    await esperar(80);
  }
  throw new Error(`a página não terminou de carregar: ${url}`);
}

export async function lerStream(tab, handle) {
  const partes = [];
  for (;;) {
    const r = await tab.send('IO.read', { handle, size: 4 * 1024 * 1024 });
    partes.push(Buffer.from(r.data, r.base64Encoded ? 'base64' : 'utf8'));
    if (r.eof) break;
  }
  await tab.send('IO.close', { handle });
  return Buffer.concat(partes);
}
