// Acha um navegador baseado no Chromium para medir, fotografar e imprimir.
// Ordem: ESTUDIO_CHROME (caminho forçado) → o chrome-headless-shell de versão fixa que o instalador
// gravou em .ferramentas/navegador.txt → Chrome, Chromium ou Edge instalados → qualquer
// chrome-headless-shell achado em .ferramentas/. A versão fixa vem antes do sistema para que
// medidas, contraste e prints sejam iguais no Mac e no Windows, qualquer que seja o script de
// entrada (./estudio, estudio.cmd ou node kit/scripts/estudio.mjs direto).
import fs from 'node:fs';
import path from 'node:path';
import { EH_WINDOWS, EH_MAC, pastaFerramentas } from './caminhos.mjs';

function candidatosDoSistema(env = process.env) {
  if (EH_MAC) {
    const apps = [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Chromium.app/Contents/MacOS/Chromium',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    const bases = ['/Applications'];
    if (env.HOME) bases.push(path.join(env.HOME, 'Applications'));
    return bases.flatMap((b) => apps.map((a) => path.join(b, a)));
  }
  if (EH_WINDOWS) {
    const bases = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    const rel = [
      ['Google', 'Chrome', 'Application', 'chrome.exe'],
      ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
      ['Chromium', 'Application', 'chrome.exe'],
    ];
    return bases.flatMap((b) => rel.map((r) => path.join(b, ...r)));
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ];
}

const NOME_SHELL = EH_WINDOWS ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';

// Procura o chrome-headless-shell dentro de .ferramentas (layout do @puppeteer/browsers).
export function procurarShell(raiz = pastaFerramentas()) {
  const achados = [];
  const andar = (dir, nivel) => {
    if (nivel > 6) return;
    let nomes;
    try {
      nomes = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const nome of nomes) {
      if (nome === 'node_modules' || nome === 'cache' || nome.startsWith('versao-anterior')) continue;
      const c = path.join(dir, nome);
      let info;
      try {
        info = fs.statSync(c);
      } catch {
        continue;
      }
      if (info.isDirectory()) andar(c, nivel + 1);
      else if (nome === NOME_SHELL) achados.push(c);
    }
  };
  andar(raiz, 0);
  achados.sort();
  return achados[achados.length - 1] || '';
}

function ehExecutavel(caminho) {
  try {
    if (!fs.statSync(caminho).isFile()) return false;
    if (!EH_WINDOWS) fs.accessSync(caminho, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Caminho gravado pelo instalador em <ferramentas>/navegador.txt (primeira linha), se for executável.
export function navegadorDoInstalador(ferr = pastaFerramentas()) {
  let texto;
  try {
    texto = fs.readFileSync(path.join(ferr, 'navegador.txt'), 'utf8');
  } catch {
    return '';
  }
  const caminho = texto.split('\n')[0].trim();
  return caminho && ehExecutavel(caminho) ? caminho : '';
}

// Devolve { caminho, tipo } ou null. tipo: 'forcado' | 'shell' | 'sistema'.
export function acharNavegador(env = process.env) {
  const forcado = env.ESTUDIO_CHROME;
  if (forcado && fs.existsSync(forcado)) return { caminho: forcado, tipo: 'forcado' };
  const ferr = pastaFerramentas(undefined, env);
  const fixo = navegadorDoInstalador(ferr);
  if (fixo) return { caminho: fixo, tipo: 'shell' };
  for (const c of candidatosDoSistema(env)) if (fs.existsSync(c)) return { caminho: c, tipo: 'sistema' };
  const shell = procurarShell(ferr);
  if (shell) return { caminho: shell, tipo: 'shell' };
  return null;
}

export function ehShell(caminho) {
  return path.basename(caminho).startsWith('chrome-headless-shell');
}
