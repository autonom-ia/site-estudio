// Navegador sem janela + DevTools Protocol, sem dependência (WebSocket nativo do Node 22+).
import { spawn, spawnSync } from 'node:child_process';
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
// Teto para o processo principal fechar sozinho. Normalmente fecha em menos de 1 s e a espera acaba
// ali; o teto só vale para um navegador travado.
const TETO_FECHAR_MS = 30000;
// Teto para os serviços que gravam no perfil saírem depois do principal. Medido num Mac sobrecarregado:
// o principal levou 11 s para sair e o serviço de rede, mais 4 s; num Mac livre, os dois saem em 0,2 s.
const TETO_ESCRITORES_MS = 15000;
// Teto para um processo encerrado à força sumir da lista do sistema.
const TETO_ENCERRAR_MS = 5000;
// Teto do fechamento inteiro (fecharComCalma): as esperas acima saem dele, e quem chama pode dar menos.
export const TETO_FECHAR_COM_CALMA_MS = TETO_FECHAR_MS + TETO_ESCRITORES_MS + TETO_ENCERRAR_MS;

// Números dos processos que ainda existem (process.kill com sinal 0 só pergunta, não encerra).
export function processosVivos(pids) {
  return (pids || []).filter((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  });
}

// Separa "<número> <linha de comando>" no primeiro espaço: { pid, comando }; null se não houver número.
function separarLinha(crua) {
  const linha = String(crua || '').trim();
  const corte = [...linha].findIndex((c) => c === ' ' || c === '\t');
  if (corte <= 0) return null;
  const pid = Number(linha.slice(0, corte));
  if (!Number.isInteger(pid) || pid <= 0) return null;
  return { pid, comando: linha.slice(corte + 1) };
}

// A pasta aparece inteira na linha de comando: logo depois dela vem o fim, um espaço ou aspas (uma
// pasta "perfil" não casa com "perfil2"). No Windows, maiúscula e minúscula são a mesma pasta.
function temAPasta(comando, pasta) {
  const texto = EH_WINDOWS ? comando.toLowerCase() : comando;
  const alvo = EH_WINDOWS ? pasta.toLowerCase() : pasta;
  if (!alvo) return false;
  for (let i = texto.indexOf(alvo); i >= 0; i = texto.indexOf(alvo, i + 1)) {
    const depois = texto[i + alvo.length];
    if (depois === undefined || depois === ' ' || depois === '"' || depois === '\t' || depois === '\r') return true;
  }
  return false;
}

// Da saída de "ps -o pid=,args=" (Mac e Linux) ou do PowerShell (Windows), uma linha por processo
// ("<número> <linha de comando>"): os números cuja linha de comando tem a pasta do perfil (uma pasta
// ou a lista dos jeitos de escrever a mesma pasta).
export function pidsComAPasta(saida, pastas) {
  const lista = [].concat(pastas || []).filter(Boolean);
  return String(saida || '')
    .split('\n')
    .map(separarLinha)
    .filter((p) => p && lista.some((pasta) => temAPasta(p.comando, pasta)))
    .map((p) => p.pid);
}

// A pasta como foi passada e como o sistema a escreve por inteiro (no Mac, /var é /private/var; no
// Windows, o nome curto C:\Users\RUNNER~1 vira o longo): o Chrome pode repassar qualquer uma das duas.
function jeitosDaPasta(pasta) {
  try {
    const inteira = fs.realpathSync.native(pasta);
    return inteira === pasta ? [pasta] : [pasta, inteira];
  } catch {
    return [pasta];
  }
}

// Pergunta ao sistema a linha de comando de cada processo. Sem resposta, ''.
const TETO_PERGUNTA_MS = 15000;
function linhasDeComando(pids) {
  const opcoes = { encoding: 'utf8', windowsHide: true, timeout: TETO_PERGUNTA_MS };
  try {
    if (EH_WINDOWS) {
      const filtro = pids.map((pid) => `ProcessId=${pid}`).join(' OR ');
      const script = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter '${filtro}' | ForEach-Object { [string]$_.ProcessId + ' ' + $_.CommandLine }`;
      return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], opcoes).stdout || '';
    }
    return spawnSync('ps', ['-ww', '-o', 'pid=,args=', '-p', pids.join(',')], opcoes).stdout || '';
  } catch {
    return '';
  }
}

// Dos números guardados, os que AINDA são do navegador deste perfil. O sistema reaproveita o número
// de um processo que saiu (no Windows, logo): entre guardar a lista e encerrar passam até dezenas de
// segundos, e o número pode já ser de outro programa da pessoa, até de outro Chrome. Só conta quem
// tem esta pasta de perfil na linha de comando (todos os processos do Chrome a recebem). Se o sistema
// não responder, ninguém conta: melhor deixar um processo para trás do que encerrar o de outra pessoa.
export function processosComAPasta(pids, pasta) {
  if (!pids.length) return [];
  return pidsComAPasta(linhasDeComando(pids), jeitosDaPasta(pasta)).filter((pid) => pids.includes(pid));
}

function encerrar(pid) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* já saiu */
  }
}

// Fechou por inteiro: o principal saiu sozinho E se conhece a lista dos processos (sem ela, não dá para
// saber se os serviços que gravam no perfil terminaram nem encerrar os que sobraram).
export function fechouPorInteiro(principalSaiu, processos) {
  return Boolean(principalSaiu) && Array.isArray(processos) && processos.length > 0;
}

// Espera todos os processos saírem, até "fim". Devolve true se saíram.
async function esperarSumirem(pids, fim) {
  while (processosVivos(pids).length) {
    if (Date.now() >= fim) return false;
    await esperar(100);
  }
  return true;
}

// Os processos do navegador ({ pid, tipo }: principal, páginas, GPU, rede, armazenamento) pelo DevTools.
// Se o DevTools não responder, lista vazia (e o fechamento não conta como inteiro).
async function processosDoNavegador(nav, prazoMs = TETO_PEDIDO_MS * 2) {
  try {
    const r = await nav.send('SystemInfo.getProcessInfo', {}, prazoMs);
    return (r.processInfo || [])
      .map((p) => ({ pid: Number(p.id), tipo: String(p.type || '') }))
      .filter((p) => Number.isInteger(p.pid) && p.pid > 0);
  } catch {
    return [];
  }
}

// Serviços que gravam no perfil: o de rede (cookies) e o de armazenamento.
export function ehEscritor(tipo) {
  const t = String(tipo || '');
  return t.includes('NetworkService') || t.includes('StorageService');
}

// Espera a promessa, no máximo ms, sem deixar relógio pendurado (ele seguraria o processo aberto).
function ateNoMaximo(promessa, ms) {
  let relogio;
  const limite = new Promise((res) => {
    relogio = setTimeout(res, ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(relogio));
}

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

// 3D nas fotos: o desenho em WebGL é sempre feito pelo SwiftShader, o desenhista por software que
// vem dentro do Chrome. Igual no Mac, no Linux e no Windows, com ou sem placa de vídeo (o servidor
// de testes não tem nenhuma), e a mesma foto em toda máquina. Desde o Chrome 137 o Chrome não cai
// mais sozinho no SwiftShader quando falta placa: sem "--enable-unsafe-swiftshader" a página fica
// sem WebGL e a parte 3D sai vazia (ou na imagem de reserva). O "unsafe" é sobre página de fora
// rodando no desenhista por software. Por isso as chaves vêm desligadas (com3d: false) e só a
// sessão das conferências liga (lib/sessao.mjs): ela abre só o site da pasta, servido no próprio
// computador, e recusa todo pedido para fora dele. O leitor, que abre sites da internet (inclusive
// o Instagram com login), e o "verificar" abrem sem.
export const ARGS_3D = Object.freeze(['--use-angle=swiftshader', '--enable-unsafe-swiftshader']);

// Argumentos de cada jeito de abrir. Sem janela: o mesmo navegador escondido de sempre. Com
// janela: um Chrome normal, para a pessoa usar. Perfil guardado (login do Instagram): a chave dos
// cookies não vem do chaveiro do sistema (no Mac, a janela e o modo sem janela usam chaves diferentes
// e um não leria o login do outro; e o chaveiro pediria a senha do computador à pessoa).
// com3d: ver ARGS_3D.
export function argumentosDoNavegador({ caminho, porta, perfil, comJanela = false, guardado = false, largura, altura, com3d = false }) {
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
  if (com3d) args.push(...ARGS_3D);
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
// com3d: liga o desenho 3D por software (ver ARGS_3D); só a sessão das conferências usa.
export async function launch({ largura = 1920, altura = 1080, perfil = '', comJanela = false, navegador = null, endereco = 'about:blank', com3d = false } = {}) {
  const achado = navegador || acharNavegador();
  if (!achado) falha('CHROME_NAO_ACHADO', {});
  const porta = await portaLivre();
  const guardado = Boolean(perfil);
  const pastaPerfil = guardado ? perfil : fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-cdp-'));
  const args = argumentosDoNavegador({ caminho: achado.caminho, porta, perfil: pastaPerfil, comJanela, guardado, largura, altura, com3d });
  const proc = spawn(achado.caminho, [...args, endereco], { stdio: 'ignore', windowsHide: !comJanela });
  // O Chrome não segura o estúdio aberto. Sem isto, um caminho que esquecesse de fechar o navegador
  // (um erro no meio, um prazo de teste vencido) deixaria o processo do estúdio vivo para sempre,
  // esperando o Chrome sair. Quando o estúdio termina, o Chrome é encerrado junto (aoSair, abaixo).
  proc.unref();
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
  // No Windows, o Chrome abre vários processos: encerra a árvore inteira.
  const matar = () => {
    if (morreu) return;
    if (EH_WINDOWS && proc.pid) {
      try {
        spawnSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore', windowsHide: true });
      } catch {}
    }
    try {
      proc.kill('SIGKILL');
    } catch {}
  };
  // Se o processo do estúdio acabar, o Chrome não fica para trás (aberto e escondido; com perfil
  // guardado, segurando o login). Perfil temporário: apaga a pasta, repetindo por alguns segundos (o
  // Windows solta os arquivos de um processo encerrado com atraso).
  // Interrompido (Ctrl+C), só o perfil guardado: ele é o que segura o login.
  const aoSair = () => {
    matar();
    if (guardado) return;
    try {
      fs.rmSync(pastaPerfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {}
  };
  const aoInterromper = () => {
    matar();
    process.exit(130);
  };
  process.on('exit', aoSair);
  if (guardado) {
    process.once('SIGINT', aoInterromper);
    process.once('SIGTERM', aoInterromper);
  }
  const soltar = () => {
    process.off('exit', aoSair);
    process.off('SIGINT', aoInterromper);
    process.off('SIGTERM', aoInterromper);
  };
  const close = () => {
    matar();
    soltar();
    if (guardado) return;
    // o Windows segura o perfil por um instante depois de matar o processo
    setTimeout(() => {
      try {
        fs.rmSync(pastaPerfil, { recursive: true, force: true });
      } catch {}
    }, 300);
  };
  // Fecha pedindo ao navegador (Browser.close: no fechamento normal, o Chrome grava os cookies no
  // disco antes de o processo principal sair) e espera o principal sair de verdade, até
  // TETO_FECHAR_MS: num computador lento ele leva mais de 10 s, e matar antes perde o login. Depois,
  // dá até TETO_ESCRITORES_MS aos serviços que gravam no perfil (rede e armazenamento), que podem
  // sair depois do principal; o que sobrar (páginas, GPU, um serviço travado) é encerrado, para o
  // próximo navegador abrir o perfil sem ninguém segurando os arquivos (no Windows, segurar o
  // arquivo dos cookies esconde o login). Só se encerra processo que ainda tem esta pasta de perfil
  // na linha de comando (processosComAPasta). Encerrar o principal à força é o último recurso, depois
  // do teto. tetoMs é o prazo do fechamento inteiro: cada espera sai do que resta dele, e
  // TETO_ENCERRAR_MS fica guardado para o fim. Devolve true se fechou por inteiro (fechouPorInteiro).
  // ultimoFechamento() conta o que sobrou.
  let sobraram = [];
  const fecharComCalma = async (tetoMs = TETO_FECHAR_COM_CALMA_MS) => {
    const fimDoFechar = Date.now() + Math.max(tetoMs, TETO_ENCERRAR_MS);
    // o que resta para uma espera, sem tocar no tempo guardado para encerrar à força
    const resta = (teto) => Math.max(1, Math.min(teto, fimDoFechar - TETO_ENCERRAR_MS - Date.now()));
    let processos = [];
    let calmo = morreu;
    if (!morreu) {
      try {
        const nav = await conectarNavegador(porta, { prazoMs: resta(TETO_ABA_MS) });
        processos = await processosDoNavegador(nav, resta(TETO_PEDIDO_MS * 2));
        nav.send('Browser.close', {}, resta(TETO_FECHAR_MS)).catch(() => {});
        await ateNoMaximo(saiu, resta(TETO_FECHAR_MS));
        nav.close();
        calmo = fechouPorInteiro(morreu, processos);
        const escritores = processos.filter((p) => ehEscritor(p.tipo)).map((p) => p.pid);
        if (morreu) await esperarSumirem(escritores, Date.now() + resta(TETO_ESCRITORES_MS));
      } catch {
        /* sem conexão: vai à força */
        calmo = false;
      }
    }
    close();
    const vivos = processosVivos(processos.map((p) => p.pid));
    sobraram = processos.filter((p) => vivos.includes(p.pid)).map((p) => p.tipo);
    const doPerfil = processosComAPasta(vivos, pastaPerfil);
    for (const pid of doPerfil) encerrar(pid);
    // encerrar é um pedido ao sistema: espera os encerrados sumirem de fato
    await esperarSumirem(doPerfil, Math.max(fimDoFechar, Date.now() + 1000));
    return calmo;
  };
  const fim = Date.now() + TETO_SUBIDA_MS;
  while (Date.now() < fim && !morreu) {
    try {
      // sem prazo, um navegador que aceita a conexão e não responde prenderia o laço para sempre
      const r = await fetch(`http://127.0.0.1:${porta}/json/version`, { signal: prazo(fim, TETO_PEDIDO_MS) });
      if (r.ok) return { porta, close, fecharComCalma, ultimoFechamento: () => ({ sobraram }), vivo: () => !morreu, navegador: achado };
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
