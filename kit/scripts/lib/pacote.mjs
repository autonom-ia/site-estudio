// Monta o pacote de um site: o .zip da pasta site/, em memória, com o SHA-256 e a contagem.
// Usado pelo comando pacote (que grava o zip em disco) e por quem precisar do zip sem gravar.
// index.html na raiz do zip, caminhos relativos, nada de fora.
// Fica fora do zip o que não é da página: anotação (.md) e arquivo-fonte de desenho (.psd, .ai…).
// Arquivo que nenhuma página, CSS ou script cita vai, mas volta em naoCitados (vira aviso).
// Antes de montar, recusa (PACOTE_ARQUIVO_PRIVADO, saída 2) o que não pode ir para a internet:
// arquivo ou pasta oculta, link, .env, chave, e cópia de segurança ou rascunho — nome terminado em
// .old, .backup, .bak, .orig, .tmp, .swp ou ~, e pasta backup, backups, old, _old ou tmp (comparação
// em minúsculas, pedaço por pedaço do caminho).
// Duas exceções ocultas, de propósito: o arquivo .nojekyll (o GitHub Pages lê para não reprocessar
// o site) e a pasta .well-known/ (security.txt, verificação de domínio e afins). Essas vão no zip.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { listarArquivos } from './caminhos.mjs';
import { montarZip } from './zip.mjs';
import { reprovado } from './saida.mjs';
import { ehLicencaDeFonte } from './marca.mjs';

export const FORA_DO_PACOTE = Object.freeze(['.md', '.psd', '.ai', '.sketch', '.fig', '.xcf', '.afdesign', '.indd']);
// Arquivos que os serviços de hospedagem leem pelo nome, sem nenhuma página citar.
const LIDOS_PELO_SERVIDOR = Object.freeze(['robots.txt', 'sitemap.xml', 'favicon.ico', 'cname', '.nojekyll', '_headers', '_redirects', '404.html']);
const TEXTOS_QUE_CITAM = Object.freeze(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.xml', '.svg']);

const extensao = (rel) => {
  const nome = rel.split('/').pop().toLowerCase();
  const ponto = nome.lastIndexOf('.');
  return ponto > 0 ? nome.slice(ponto) : '';
};

export function foraDoPacote(rel) {
  return FORA_DO_PACOTE.includes(extensao(rel));
}

// Lixo que o sistema cria sozinho em toda pasta: listarArquivos já deixa fora do zip, então não reprova.
const LIXO_DO_SISTEMA = Object.freeze(['.DS_Store', 'Thumbs.db']);
const OCULTOS_PERMITIDOS = Object.freeze({ arquivos: ['.nojekyll'], pastas: ['.well-known'] });
const FINS_DE_CHAVE = Object.freeze(['.pem', '.key']);
// Cópia de segurança e rascunho: valem para arquivo e para pasta ("assets.old/").
const FINS_DE_COPIA = Object.freeze(['.old', '.backup', '.bak', '.orig', '.tmp', '.swp', '~']);
const PASTAS_DE_COPIA = Object.freeze(['backup', 'backups', 'old', '_old', 'tmp']);

// Este nome (de arquivo ou pasta) pode estar num site público?
export function nomePrivado(nome, ehPasta) {
  const baixo = nome.toLowerCase();
  if (baixo.startsWith('.')) {
    const permitidos = ehPasta ? OCULTOS_PERMITIDOS.pastas : OCULTOS_PERMITIDOS.arquivos;
    if (!permitidos.includes(baixo)) return true;
  }
  if (FINS_DE_COPIA.some((fim) => baixo.endsWith(fim))) return true;
  if (ehPasta) return PASTAS_DE_COPIA.includes(baixo);
  if (baixo.includes('.env') || baixo.startsWith('id_rsa')) return true;
  return FINS_DE_CHAVE.some((fim) => baixo.endsWith(fim));
}

// Anda a pasta sem seguir link e devolve o que não pode ir (caminho relativo, "/" no fim se pasta).
export function arquivosPrivados(pasta, rel = '') {
  const achados = [];
  for (const nome of fs.readdirSync(path.join(pasta, ...rel.split('/').filter(Boolean))).sort()) {
    if (LIXO_DO_SISTEMA.includes(nome)) continue;
    const r = rel ? `${rel}/${nome}` : nome;
    const st = fs.lstatSync(path.join(pasta, ...r.split('/')));
    if (st.isSymbolicLink()) achados.push(r);
    else if (st.isDirectory()) {
      if (nomePrivado(nome, true)) achados.push(`${r}/`);
      else achados.push(...arquivosPrivados(pasta, r));
    } else if (nomePrivado(nome, false)) achados.push(r);
  }
  return achados;
}

// Arquivos (fora as páginas) cujo nome não aparece em nenhuma página, CSS, script ou manifesto.
export function arquivosNaoCitados(pasta, arquivos) {
  const textos = arquivos
    .filter((rel) => TEXTOS_QUE_CITAM.includes(extensao(rel)))
    .map((rel) => ({ rel, texto: fs.readFileSync(path.join(pasta, ...rel.split('/')), 'utf8') }));
  const soltos = [];
  for (const rel of arquivos) {
    const nome = rel.split('/').pop();
    if (extensao(rel) === '.html' || LIDOS_PELO_SERVIDOR.includes(nome.toLowerCase())) continue;
    if (ehLicencaDeFonte(nome) || nome.toUpperCase().startsWith('LICENSE')) continue;
    if (!textos.some((t) => t.rel !== rel && t.texto.includes(nome))) soltos.push(rel);
  }
  return soltos;
}

function lerEntradas(pastaSite, arquivos) {
  return arquivos.map((rel) => {
    const abs = path.join(pastaSite, ...rel.split('/'));
    return { nome: rel, dados: fs.readFileSync(abs), data: fs.statSync(abs).mtime };
  });
}

// Monta o zip de pastaSite (a pasta site/ de um site) sem gravar nada.
// Recusa com PACOTE_ARQUIVO_PRIVADO (saída 2) antes de ler qualquer arquivo para o zip.
// Caminhos devolvidos são relativos a site/, sem o prefixo "site/".
export function montarPacote(pastaSite) {
  const privados = arquivosPrivados(pastaSite);
  if (privados.length) reprovado('PACOTE_ARQUIVO_PRIVADO', { arquivos: privados.map((r) => `site/${r}`) });
  const todos = listarArquivos(pastaSite);
  const arquivos = todos.filter((rel) => !foraDoPacote(rel));
  const entradas = lerEntradas(pastaSite, arquivos);
  const zip = montarZip(entradas);
  return {
    zip,
    sha256: crypto.createHash('sha256').update(zip).digest('hex'),
    arquivos: entradas.length,
    paginas: arquivos.filter((a) => a.endsWith('.html')).length,
    conteudoBytes: entradas.reduce((s, e) => s + e.dados.length, 0),
    foraDoPacote: todos.filter(foraDoPacote),
    naoCitados: arquivosNaoCitados(pastaSite, arquivos),
  };
}
