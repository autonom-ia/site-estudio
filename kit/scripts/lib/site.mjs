// Um site: sites/<nome>/ com brief.md, fatos.md, referencias.md, direcao.md, material/,
// _gerador/ (ordem, seções, montar), site/ (o que vai ao ar) e revisao/.
import fs from 'node:fs';
import path from 'node:path';
import { pastaSites, relativoARaiz, ehPasta, listarArquivos } from './caminhos.mjs';
import { falha, avisarNaSaida } from './saida.mjs';
import { recuperarSobras } from './antes-depois.mjs';

export function caminhosDo(nome, base = pastaSites()) {
  const pasta = path.join(base, nome);
  return {
    nome,
    pasta,
    brief: path.join(pasta, 'brief.md'),
    fatos: path.join(pasta, 'fatos.md'),
    referencias: path.join(pasta, 'referencias.md'),
    direcao: path.join(pasta, 'direcao.md'),
    material: path.join(pasta, 'material'),
    gerador: path.join(pasta, '_gerador'),
    montar: path.join(pasta, '_gerador', 'montar.mjs'),
    site: path.join(pasta, 'site'),
    index: path.join(pasta, 'site', 'index.html'),
    assets: path.join(pasta, 'site', 'assets'),
    marca: path.join(pasta, 'site', 'assets', 'marca'),
    revisao: path.join(pasta, 'revisao'),
    pacote: path.join(pasta, `${nome}-site.zip`),
    rel: (...partes) => relativoARaiz(path.join(pasta, ...partes)),
  };
}

// Site existente, sem exigir que já tenha sido montado. Antes, põe de volta no lugar o que uma troca
// do "escolher" parada no meio deixou fora (lib/antes-depois.mjs, recuperarSobras), com um aviso.
export function abrirPastaDoSite(nome) {
  const c = caminhosDo(nome);
  if (!ehPasta(c.pasta)) falha('SITE_NAO_ACHADO', { nome, pasta: relativoARaiz(c.pasta) });
  const voltaram = recuperarSobras(c);
  if (voltaram.length) avisarNaSaida('SITE_POSTO_DE_VOLTA', { nome, pastas: voltaram });
  return c;
}

// Site existente e já montado (site/index.html).
export function abrirSite(nome) {
  const c = abrirPastaDoSite(nome);
  if (!fs.existsSync(c.index)) falha('SITE_SEM_INDEX', { arquivo: c.rel('site', 'index.html') });
  return c;
}

// Nome curto de uma página a partir do caminho: index.html → inicio; a-casa/index.html → a-casa.
export function nomeDaPagina(rel) {
  let r = rel;
  if (r === 'index.html') return 'inicio';
  if (r.endsWith('/index.html')) r = r.slice(0, -'/index.html'.length);
  else if (r.endsWith('.html')) r = r.slice(0, -'.html'.length);
  return r.split('/').join('-');
}

// Todas as páginas .html de site/, fora assets/. A home primeiro.
export function paginasDoSite(c) {
  const lista = listarArquivos(c.site)
    .filter((r) => r.toLowerCase().endsWith('.html') && !r.startsWith('assets/'))
    .map((rel) => ({ rel, nome: nomeDaPagina(rel), url: rel.endsWith('index.html') ? rel.slice(0, -'index.html'.length) : rel }));
  lista.sort((a, b) => (a.rel === 'index.html' ? -1 : b.rel === 'index.html' ? 1 : a.rel.localeCompare(b.rel)));
  if (!lista.length) falha('SITE_SEM_PAGINAS', { pasta: c.rel('site') });
  return lista;
}

// Os quatro tamanhos de tela. "celular" liga as regras de toque e de texto mínimo.
export const TAMANHOS = Object.freeze([
  Object.freeze({ nome: 'celular', largura: 390, altura: 844, movel: true }),
  Object.freeze({ nome: 'tablet', largura: 768, altura: 1024, movel: true }),
  Object.freeze({ nome: 'notebook', largura: 1440, altura: 900, movel: false }),
  Object.freeze({ nome: 'tela-grande', largura: 1920, altura: 1080, movel: false }),
]);

// --tamanhos 390,1440 (ou nomes: celular,notebook). Sem a opção, devolve o padrão.
export function escolherTamanhos(opcoes, padrao = TAMANHOS) {
  const bruto = opcoes.tamanhos;
  if (bruto === undefined) return padrao;
  if (typeof bruto !== 'string' || !bruto.trim()) falha('ARGUMENTO_INVALIDO', { argumento: '--tamanhos', valor: String(bruto), opcoes: TAMANHOS.map((t) => t.largura) });
  const escolhidos = [];
  for (const parte of bruto.split(',')) {
    const p = parte.trim();
    const t = TAMANHOS.find((x) => String(x.largura) === p || x.nome === p);
    if (!t) falha('ARGUMENTO_INVALIDO', { argumento: '--tamanhos', valor: p, opcoes: TAMANHOS.map((x) => `${x.largura} (${x.nome})`) });
    if (!escolhidos.includes(t)) escolhidos.push(t);
  }
  return escolhidos;
}

// Rodada de revisão: --rodada N, ou a próxima depois da última revisao/rodada-N.md escrita.
export function rodadaAtual(c, opcoes) {
  if (opcoes.rodada !== undefined) {
    const n = Number(opcoes.rodada);
    if (!Number.isInteger(n) || n < 1 || n > 99) falha('ARGUMENTO_INVALIDO', { argumento: '--rodada', valor: String(opcoes.rodada) });
    return n;
  }
  let maior = 0;
  if (ehPasta(c.revisao)) {
    for (const nome of fs.readdirSync(c.revisao)) {
      if (!nome.startsWith('rodada-') || !nome.endsWith('.md')) continue;
      const n = Number(nome.slice('rodada-'.length, -'.md'.length));
      if (Number.isInteger(n) && n > maior) maior = n;
    }
  }
  return maior + 1;
}
