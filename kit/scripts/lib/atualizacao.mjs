// Atualização do estúdio (adaptada do Estúdio de Reels): baixa o zip da versão nova só do endereço
// oficial, confere o SHA-256 publicado ao lado, troca só se a VERSAO subiu, preserva as pastas do
// usuário e guarda a versão anterior para voltar se algo falhar no meio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { rodar } from './executar.mjs';
import { KitErro } from './saida.mjs';
import { lerEnv, lerTexto } from './json.mjs';
import { PASTAS_DO_USUARIO, NOME_PASTA_FERRAMENTAS, copiarPasta, ehPasta } from './caminhos.mjs';
import { pegarTrava, soltarTrava } from './trava.mjs';

const DONO = 'autonom-ia';
const REPOSITORIO = 'site-estudio';
export const ENDERECO_OFICIAL = `https://github.com/${DONO}/${REPOSITORIO}/`;
export const ENDERECO_PADRAO = `${ENDERECO_OFICIAL}releases/latest/download/site-estudio.zip`;
// O GitHub entrega o anexo do release redirecionando para um destes. Nenhum outro é seguido.
export const HOSTS_DE_DOWNLOAD = Object.freeze(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);
const MAX_REDIRECIONAMENTOS = 5;
// Nunca trocados: trabalho do usuário, programas instalados, git e as permissões locais.
export const PRESERVADOS = Object.freeze([...PASTAS_DO_USUARIO, NOME_PASTA_FERRAMENTAS, 'node_modules', '.git']);
// Lixo do sistema: nem copiado da versão nova, nem guardado da antiga.
const LIXO_DO_SISTEMA = Object.freeze(['.ds_store', 'thumbs.db']);
// Pastas de instruções que a versão nova traz inteiras; as skills que a pessoa pôs nelas voltam.
const PASTAS_DE_SKILLS = Object.freeze(['.claude', '.agents']);
const COPIAS_GUARDADAS = 2;
// Uma atualização por instalação: a segunda, ao mesmo tempo, recebe ATUALIZACAO_EM_ANDAMENTO.
export const NOME_TRAVA = 'atualizando.trava';

const erro = (codigo, dados = {}) => new KitErro(codigo, dados, 1);

// Mac (APFS) e Windows (NTFS) não diferenciam maiúscula: "SITES" é a mesma pasta que "sites".
const normalizar = (nome) => String(nome).normalize('NFC').toLowerCase();
const PRESERVADOS_NORMAIS = new Set(PRESERVADOS.map(normalizar));
const ehPreservado = (nome) => PRESERVADOS_NORMAIS.has(normalizar(nome));
const ehLixo = (nome) => LIXO_DO_SISTEMA.includes(normalizar(nome));

export function lerVersao(raiz) {
  const arq = path.join(raiz, 'VERSAO');
  if (!fs.existsSync(arq)) return null;
  return lerTexto(arq).trim() || null;
}

// -1, 0 ou 1. "1.10.0" > "1.9.3". Partes que não são número contam como 0.
export function compararVersoes(a, b) {
  const pa = String(a || '0').split('.').map((p) => Number(p) || 0);
  const pb = String(b || '0').split('.').map((p) => Number(p) || 0);
  for (let k = 0; k < Math.max(pa.length, pb.length); k += 1) {
    const x = pa[k] || 0;
    const y = pb[k] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Endereço https limpo: sem usuário, senha nem porta. null quando não serve.
function urlLimpa(texto) {
  let u;
  try {
    u = new URL(texto);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  return u;
}

// Só o release do repositório oficial. O texto cru não pode ter % (o URL decodifica e normaliza
// "%2e%2e" para outra pasta), barra invertida, ? nem #; a conferência é no caminho já normalizado.
export function enderecoAceito(url) {
  if (typeof url !== 'string') return false;
  for (const proibido of ['%', '\\', '?', '#']) if (url.includes(proibido)) return false;
  const u = urlLimpa(url);
  if (!u || u.hostname !== 'github.com') return false;
  return u.pathname.startsWith(`/${DONO}/${REPOSITORIO}/releases/`);
}

// Para onde um redirecionamento leva. null quando o destino não é um dos hosts do GitHub.
export function destinoDoRedirecionamento(atual, location) {
  let u;
  try {
    u = urlLimpa(new URL(location, atual).href);
  } catch {
    return null;
  }
  if (!u || !HOSTS_DE_DOWNLOAD.includes(u.hostname)) return null;
  return u.href;
}

export function enderecoConfigurado(raiz) {
  const env = lerEnv(path.join(raiz, 'instalar', 'versoes.env'));
  return env.ESTUDIO_ATUALIZAR_URL || ENDERECO_PADRAO;
}

const sha256 = (arquivo) => crypto.createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');
const primeiraPalavra = (texto) => String(texto).trim().split(' ')[0].split('\t')[0].trim().toLowerCase();

// Baixa seguindo redirecionamentos à mão (no máximo 5), só para os hosts do GitHub.
// buscar: o fetch (os testes trocam por um falso).
export async function baixar(url, destino, { buscar = fetch } = {}) {
  let atual = url;
  for (let saltos = 0; saltos <= MAX_REDIRECIONAMENTOS; saltos += 1) {
    let r;
    try {
      r = await buscar(atual, { redirect: 'manual' });
    } catch (e) {
      throw erro('ATUALIZACAO_DOWNLOAD_FALHOU', { url, detalhe: String(e.message) });
    }
    if (r.status >= 300 && r.status < 400) {
      try {
        await r.body?.cancel?.();
      } catch {}
      const location = r.headers.get('location');
      if (!location) throw erro('ATUALIZACAO_DOWNLOAD_FALHOU', { url, status: r.status });
      const proximo = destinoDoRedirecionamento(atual, location);
      if (!proximo) throw erro('ATUALIZACAO_ENDERECO_ESTRANHO', { url: String(location).slice(0, 200) });
      atual = proximo;
      continue;
    }
    if (!r.ok) throw erro('ATUALIZACAO_DOWNLOAD_FALHOU', { url, status: r.status });
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    return;
  }
  throw erro('ATUALIZACAO_DOWNLOAD_FALHOU', { url, motivo: 'redirecionamentos demais' });
}

// Pega o zip (local ou do endereço oficial) e confere o SHA-256.
export async function obterZip(origem, tmp, { buscar } = {}) {
  const zip = path.join(tmp, 'novo.zip');
  let esperado;
  if (fs.existsSync(origem)) {
    if (!fs.existsSync(`${origem}.sha256`)) throw erro('ATUALIZACAO_ARQUIVO_DIFERENTE', { motivo: 'falta o .sha256 ao lado do zip' });
    esperado = primeiraPalavra(lerTexto(`${origem}.sha256`));
    fs.copyFileSync(origem, zip);
  } else {
    if (!enderecoAceito(origem)) throw erro('ATUALIZACAO_ENDERECO_ESTRANHO', { url: origem });
    await baixar(`${origem}.sha256`, path.join(tmp, 'novo.zip.sha256'), { buscar });
    esperado = primeiraPalavra(lerTexto(path.join(tmp, 'novo.zip.sha256')));
    await baixar(origem, zip, { buscar });
  }
  if (esperado.length !== 64 || sha256(zip) !== esperado) throw erro('ATUALIZACAO_ARQUIVO_DIFERENTE', { motivo: 'SHA-256 não confere' });
  return zip;
}

export async function extrairZip(zip, destino) {
  fs.mkdirSync(destino, { recursive: true });
  const tentativas = [
    ['tar', ['-xf', zip, '-C', destino]],
    ['unzip', ['-q', '-o', zip, '-d', destino]],
  ];
  for (const [prog, args] of tentativas) {
    const r = await rodar(prog, args, { timeoutMs: 5 * 60 * 1000 });
    if (r.codigo === 0) return true;
  }
  throw erro('ATUALIZACAO_ZIP_NAO_ABRIU', {});
}

// Acha a raiz da versão nova (a pasta com VERSAO), até 2 níveis abaixo. Não entra em link.
export function acharRaizNova(dir, nivel = 0) {
  if (fs.existsSync(path.join(dir, 'VERSAO'))) return dir;
  if (nivel >= 2) return null;
  for (const nome of fs.readdirSync(dir)) {
    const c = path.join(dir, nome);
    if (fs.lstatSync(c).isDirectory()) {
      const achou = acharRaizNova(c, nivel + 1);
      if (achou) return achou;
    }
  }
  return null;
}

// Links simbólicos (e junções do Windows) dentro da versão nova, com caminho relativo em "/".
export function linksNaArvore(dir, rel = '') {
  const achados = [];
  for (const nome of fs.readdirSync(path.join(dir, rel))) {
    const r = rel ? `${rel}/${nome}` : nome;
    const st = fs.lstatSync(path.join(dir, r));
    if (st.isSymbolicLink()) achados.push(r);
    else if (st.isDirectory()) achados.push(...linksNaArvore(dir, r));
  }
  return achados;
}

// Recusa a versão nova que traria link (poderia escrever fora do estúdio) ou um item de topo com o
// nome de uma pasta preservada escrito de outro jeito ("SITES" trocaria "sites" no Mac e no Windows).
export function conferirVersaoNova(nova) {
  const links = linksNaArvore(nova);
  if (links.length) throw erro('ATUALIZACAO_ARQUIVO_DIFERENTE', { motivo: 'o zip traz link simbólico', itens: links.slice(0, 20) });
  const colisoes = fs.readdirSync(nova).filter((n) => ehPreservado(n) && !PRESERVADOS.includes(n));
  if (colisoes.length) throw erro('ATUALIZACAO_ARQUIVO_DIFERENTE', { motivo: 'o zip traz pasta com nome reservado ao usuário', itens: colisoes });
}

function mesmoConteudo(a, b) {
  const ea = fs.existsSync(a);
  const eb = fs.existsSync(b);
  if (!ea || !eb) return ea === eb;
  return sha256(a) === sha256(b);
}

// Peças que, quando mudam, pedem o instalador de novo: pacotes e versões fixas de Node e navegador.
export const ARQUIVOS_DE_DEPENDENCIA = Object.freeze(['package.json', 'package-lock.json', 'instalar/versoes.env']);

export function dependenciasMudaram(raiz, nova) {
  return ARQUIVOS_DE_DEPENDENCIA.some((rel) => !mesmoConteudo(path.join(raiz, ...rel.split('/')), path.join(nova, ...rel.split('/'))));
}

function limparCopiasAntigas(ferr) {
  if (!fs.existsSync(ferr)) return;
  const lista = fs.readdirSync(ferr).filter((n) => n.startsWith('versao-anterior-')).sort();
  for (const n of lista.slice(0, Math.max(0, lista.length - COPIAS_GUARDADAS))) fs.rmSync(path.join(ferr, n), { recursive: true, force: true });
}

function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Existe, mesmo que seja um link quebrado (existsSync segue o link).
function existeSemSeguir(caminho) {
  try {
    fs.lstatSync(caminho);
    return true;
  } catch {
    return false;
  }
}

// Cópia em JavaScript puro: erro de leitura vira exceção comum (o cpSync nativo pode derrubar o processo).
function copiarItem(de, para, opcoes) {
  const st = fs.lstatSync(de);
  if (st.isSymbolicLink()) {
    if (!opcoes || opcoes.links !== 'recriar') throw new Error(`link simbólico não é copiado: ${de}`);
    const alvo = fs.readlinkSync(de);
    fs.symlinkSync(alvo, para, ehPasta(de) ? (path.isAbsolute(alvo) ? 'junction' : 'dir') : 'file');
  } else if (st.isDirectory()) copiarPasta(de, para, opcoes);
  else fs.copyFileSync(de, para);
}

// Devolve o que é da pessoa e veio na pasta trocada: permissões locais do Claude Code e cada skill
// que ela (ou outro instalador) pôs em .claude/skills ou .agents/skills e que a versão nova não traz.
function devolverDoUsuario(raiz, antigo) {
  const local = path.join(antigo, '.claude', 'settings.local.json');
  if (fs.existsSync(local)) {
    fs.mkdirSync(path.join(raiz, '.claude'), { recursive: true });
    fs.copyFileSync(local, path.join(raiz, '.claude', 'settings.local.json'));
  }
  const devolvidas = [];
  for (const base of PASTAS_DE_SKILLS) {
    const velhas = path.join(antigo, base, 'skills');
    if (!ehPasta(velhas)) continue;
    // A versão nova pode não trazer .agents (ou .claude): a pasta é recriada aqui, dentro da troca
    // (o rollback apaga o que foi criado e devolve a antiga), e as skills da pessoa voltam mesmo assim.
    const novas = path.join(raiz, base, 'skills');
    fs.mkdirSync(novas, { recursive: true });
    for (const skill of fs.readdirSync(velhas)) {
      if (ehLixo(skill) || existeSemSeguir(path.join(novas, skill))) continue;
      copiarItem(path.join(velhas, skill), path.join(novas, skill), { links: 'recriar' });
      devolvidas.push(`${base}/skills/${skill}`);
    }
  }
  return devolvidas;
}

function marcarExecutaveis(raiz) {
  for (const nome of ['estudio', path.join('instalar', 'instalar.sh'), path.join('instalar', 'ambiente.sh'), path.join('instalar', 'verificar.sh')]) {
    try {
      fs.chmodSync(path.join(raiz, nome), 0o755);
    } catch {}
  }
}

// Desfaz a troca, do último item para o primeiro. true quando tudo voltou.
function voltarTudo(raiz, antigo, trocados) {
  let voltou = true;
  for (const nome of [...trocados].reverse()) {
    try {
      fs.rmSync(path.join(raiz, nome), { recursive: true, force: true });
      if (existeSemSeguir(path.join(antigo, nome))) fs.renameSync(path.join(antigo, nome), path.join(raiz, nome));
    } catch {
      voltou = false;
    }
  }
  return voltou;
}

// Troca item por item. Ordem: itens da versão nova; itens de topo que a versão nova não tem mais
// (vão para a cópia anterior); o que é da pessoa volta; VERSAO por último. Falhou em qualquer
// ponto: devolve tudo da cópia anterior.
export function aplicarVersao(raiz, nova, ferr) {
  conferirVersaoNova(nova);
  fs.mkdirSync(ferr, { recursive: true });
  // Pasta exclusiva (sufixo aleatório): duas trocas no mesmo segundo não dividem a mesma cópia.
  const antigo = fs.mkdtempSync(path.join(ferr, `versao-anterior-${carimbo()}-`));
  const fica = (n) => n !== 'VERSAO' && !ehPreservado(n) && !ehLixo(n);
  const itens = fs.readdirSync(nova).filter(fica);
  const nomesNovos = new Set(itens.map(normalizar));
  const sobras = fs.readdirSync(raiz).filter((n) => fica(n) && !nomesNovos.has(normalizar(n)));
  const trocados = [];
  const guardar = (nome) => {
    if (existeSemSeguir(path.join(raiz, nome))) fs.renameSync(path.join(raiz, nome), path.join(antigo, nome));
    trocados.push(nome);
  };
  let etapa = '';
  let skillsMantidas = [];
  try {
    for (const nome of itens) {
      etapa = nome;
      guardar(nome);
      copiarItem(path.join(nova, nome), path.join(raiz, nome));
    }
    for (const nome of sobras) {
      etapa = nome;
      guardar(nome);
    }
    etapa = 'pastas de skills';
    skillsMantidas = devolverDoUsuario(raiz, antigo);
    marcarExecutaveis(raiz);
    etapa = 'VERSAO';
    guardar('VERSAO');
    fs.copyFileSync(path.join(nova, 'VERSAO'), path.join(raiz, 'VERSAO'));
  } catch (e) {
    if (voltarTudo(raiz, antigo, trocados)) {
      fs.rmSync(antigo, { recursive: true, force: true });
      throw erro('ATUALIZACAO_FALHOU', { arquivo: etapa, detalhe: String(e.message) });
    }
    throw erro('ATUALIZACAO_INCOMPLETA', { arquivo: etapa, copia_anterior: antigo, detalhe: String(e.message) });
  }
  limparCopiasAntigas(ferr);
  // A pasta de skills recriada para devolver as da pessoa não conta como removida.
  const removidos = sobras.filter((n) => !existeSemSeguir(path.join(raiz, n)));
  return { copia: antigo, skillsMantidas, removidos };
}

// Trava a instalação antes de qualquer espera (download, extração): duas atualizações ao mesmo
// tempo não trocam os mesmos arquivos. A VERSAO é lida depois da trava, porque outra atualização
// pode ter acabado de trocá-la.
export async function atualizarEstudio({ raiz, ferr, origem, buscar }) {
  fs.mkdirSync(ferr, { recursive: true });
  const trava = path.join(ferr, NOME_TRAVA);
  if (!pegarTrava(trava)) throw erro('ATUALIZACAO_EM_ANDAMENTO', {});
  let tmp;
  try {
    const de = lerVersao(raiz);
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-atualizar-'));
    const zip = await obterZip(origem, tmp, { buscar });
    await extrairZip(zip, path.join(tmp, 'novo'));
    const nova = acharRaizNova(path.join(tmp, 'novo'));
    if (!nova) throw erro('ATUALIZACAO_ARQUIVO_DIFERENTE', { motivo: 'o zip não tem VERSAO' });
    const para = lerVersao(nova);
    if (compararVersoes(para, de) <= 0) return { atualizou: false, de, para };
    const dependencias = dependenciasMudaram(raiz, nova);
    const r = aplicarVersao(raiz, nova, ferr);
    return { atualizou: true, de, para, copia: r.copia, skillsMantidas: r.skillsMantidas, removidos: r.removidos, dependencias };
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    soltarTrava(trava);
  }
}
