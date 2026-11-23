// Onde ficam as coisas: raiz do repositório, pasta de ferramentas e pastas do usuário.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const EH_WINDOWS = process.platform === 'win32';
export const EH_MAC = process.platform === 'darwin';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const KIT = path.join(RAIZ, 'kit');

// Pasta de ferramentas: sempre dentro do estúdio (Mac e Windows). Desinstalar é apagar uma pasta.
export const NOME_PASTA_FERRAMENTAS = '.ferramentas';

export function pastaFerramentas(raiz = RAIZ, env = process.env) {
  if (env.ESTUDIO_FERRAMENTAS) return path.resolve(env.ESTUDIO_FERRAMENTAS);
  return path.join(raiz, NOME_PASTA_FERRAMENTAS);
}

export const FERR = pastaFerramentas();

// Pastas do usuário. Os testes apontam para pastas temporárias pelas variáveis de ambiente.
export function pastaSites(env = process.env) {
  if (env.ESTUDIO_SITES) return path.resolve(env.ESTUDIO_SITES);
  return path.join(RAIZ, 'sites');
}

export function pastaMarca(env = process.env) {
  if (env.ESTUDIO_MARCA) return path.resolve(env.ESTUDIO_MARCA);
  return path.join(RAIZ, 'minha-marca');
}

// Pastas que nunca são tocadas por "atualizar".
export const PASTAS_DO_USUARIO = Object.freeze(['minha-marca', 'sites', 'referencias']);

const PERMITIDOS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const TAMANHO_MAXIMO = 60;

// Nomes que o Windows reserva para dispositivos: não viram pasta, nem com extensão ("con.txt").
const RESERVADOS_DO_WINDOWS = Object.freeze([
  'con', 'prn', 'aux', 'nul',
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].flatMap((n) => [`com${n}`, `lpt${n}`]),
]);

// Compara minúsculo e só o que vem antes do primeiro ponto ("CON.algo" também é reservado).
export function nomeReservado(nome) {
  return RESERVADOS_DO_WINDOWS.includes(String(nome).split('.')[0].trim().toLowerCase());
}

// Nome do site: minúsculas, números e hífen; começa com letra ou número; não é nome reservado do Windows.
export function nomeValido(nome) {
  if (typeof nome !== 'string' || nome.length === 0 || nome.length > TAMANHO_MAXIMO) return false;
  if (nome.startsWith('-') || nome.endsWith('-')) return false;
  for (const ch of nome) if (!PERMITIDOS.includes(ch)) return false;
  return !nomeReservado(nome);
}

// Sugere um nome válido a partir de um texto qualquer (tira acento, troca espaço por hífen).
export function sugerirNome(texto) {
  const semAcento = String(texto || '').normalize('NFD');
  let saida = '';
  for (const ch of semAcento.toLowerCase()) {
    if (PERMITIDOS.includes(ch)) saida += ch;
    else if (ch === ' ' || ch === '_' || ch === '.') saida += '-';
  }
  while (saida.includes('--')) saida = saida.replaceAll('--', '-');
  while (saida.startsWith('-')) saida = saida.slice(1);
  while (saida.endsWith('-')) saida = saida.slice(0, -1);
  saida = saida.slice(0, TAMANHO_MAXIMO);
  while (saida.endsWith('-')) saida = saida.slice(0, -1);
  // "con" não vira pasta no Windows: "con-1" vira.
  return nomeReservado(saida) ? `${saida}-1` : saida;
}

export function relativoARaiz(caminho) {
  const r = path.relative(RAIZ, caminho);
  if (r.startsWith('..') || path.isAbsolute(r)) return caminho.split(path.sep).join('/');
  return r.split(path.sep).join('/');
}

export function existe(caminho) {
  try {
    fs.accessSync(caminho);
    return true;
  } catch {
    return false;
  }
}

export function ehPasta(caminho) {
  try {
    return fs.statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

export function garantirPasta(caminho) {
  fs.mkdirSync(caminho, { recursive: true });
  return caminho;
}

function erroDeLink(caminho) {
  const e = new Error(`link simbólico não é copiado: ${caminho}`);
  e.code = 'LINK_SIMBOLICO';
  return e;
}

// Copia uma pasta inteira (sem .DS_Store nem Thumbs.db). Nunca segue link simbólico (nem junção do
// Windows): um link poderia puxar para dentro da cópia o que está fora da pasta.
// links: 'erro' (padrão) recusa o link; 'recriar' copia o próprio link, sem seguir (uso: devolver
// as skills que a pessoa já tinha, que alguns instaladores põem como link). A própria origem ser
// link é sempre erro: copiar por ela levaria o que está do outro lado.
export function copiarPasta(origem, destino, { links = 'erro' } = {}) {
  if (fs.lstatSync(origem).isSymbolicLink()) throw erroDeLink(origem);
  fs.mkdirSync(destino, { recursive: true });
  for (const nome of fs.readdirSync(origem)) {
    if (nome === '.DS_Store' || nome === 'Thumbs.db') continue;
    const de = path.join(origem, nome);
    const para = path.join(destino, nome);
    const st = fs.lstatSync(de);
    if (st.isSymbolicLink()) {
      if (links !== 'recriar') throw erroDeLink(de);
      // O tipo só conta no Windows: junção pede caminho absoluto; link relativo de pasta vai como 'dir'.
      const alvo = fs.readlinkSync(de);
      const tipo = ehPasta(de) ? (path.isAbsolute(alvo) ? 'junction' : 'dir') : 'file';
      fs.symlinkSync(alvo, para, tipo);
    } else if (st.isDirectory()) copiarPasta(de, para, { links });
    else fs.copyFileSync(de, para);
  }
}

// Lista arquivos de uma pasta, recursivo, com caminho relativo em "/".
export function listarArquivos(base, rel = '') {
  const dir = path.join(base, rel);
  if (!ehPasta(dir)) return [];
  const saida = [];
  for (const nome of fs.readdirSync(dir).sort()) {
    if (nome === '.DS_Store' || nome === 'Thumbs.db') continue;
    const r = rel ? `${rel}/${nome}` : nome;
    if (ehPasta(path.join(base, r))) saida.push(...listarArquivos(base, r));
    else saida.push(r);
  }
  return saida;
}
