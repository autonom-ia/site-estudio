#!/usr/bin/env node
// Gerador do site: lê ordem.mjs, chama cada seção de secoes/ e escreve as páginas em ../site/.
// Sem dependência e sem expressão regular. A última linha impressa é um JSON:
// {"ok":true,"paginas":["index.html","a-casa/index.html"],"removidas":[]}
//
// Cada seção é um arquivo secoes/<nome>.mjs que exporta uma função: recebe o contexto (ctx) e
// devolve o HTML da seção. ctx traz: site, pagina, paginas, esc (escapa texto), link(rota) (link
// relativo para outra página, aceita '#ancora'), assets (caminho relativo até site/assets/) e
// palavras(texto) (cada palavra num <span>, para o efeito de acender).
//
// data-molde: marca o que ainda é do negócio fictício do molde (cada seção, o cabeçalho, a nota do
// rodapé e, com site.molde em ordem.mjs, a página toda). O ./estudio checar reprova (resto-do-molde)
// enquanto sobrar algum. Ao reescrever uma seção para o negócio de verdade, tire o data-molde dela.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(AQUI, '..', 'site');
const REGISTRO = path.join(AQUI, 'gerado.json');
const PERMITIDOS = 'abcdefghijklmnopqrstuvwxyz0123456789-/';

export function esc(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// JSON dentro de <script>: sem como fechar a tag por dentro.
function jsonParaScript(objeto) {
  return JSON.stringify(objeto, null, 2).replaceAll('<', '\\u003c');
}

// Nomes que o Windows reserva para dispositivos: não viram pasta (nem "servicos/con").
// Este gerador vai dentro de cada site e roda sozinho, por isso a lista mora aqui também.
const RESERVADOS_DO_WINDOWS = Object.freeze([
  'con', 'prn', 'aux', 'nul',
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].flatMap((n) => [`com${n}`, `lpt${n}`]),
]);

export function validarRota(rota) {
  if (typeof rota !== 'string') return false;
  if (rota === '') return true;
  if (rota.startsWith('/') || rota.endsWith('/') || rota.includes('//') || rota.includes('..')) return false;
  for (const ch of rota) if (!PERMITIDOS.includes(ch)) return false;
  for (const parte of rota.split('/')) if (RESERVADOS_DO_WINDOWS.includes(parte)) return false;
  return true;
}

const profundidade = (rota) => (rota ? rota.split('/').length : 0);
const prefixo = (rota) => '../'.repeat(profundidade(rota));

// Link relativo de uma página para outra. 'a-casa' → 'a-casa/'; '' → './'; '#visita' → '#visita';
// '/#visita' (home com âncora) → '../#visita' a partir de uma página interna.
export function linkRelativo(de, para) {
  let alvo = String(para);
  let ancora = '';
  const h = alvo.indexOf('#');
  if (h !== -1) {
    ancora = alvo.slice(h);
    alvo = alvo.slice(0, h);
  }
  if (h === 0) return ancora;
  if (alvo === '/') alvo = '';
  if (alvo.startsWith('/')) alvo = alvo.slice(1);
  if (alvo.endsWith('/')) alvo = alvo.slice(0, -1);
  const caminho = `${prefixo(de)}${alvo ? `${alvo}/` : ''}`;
  return `${caminho || './'}${ancora}`;
}

// Cada palavra num <span>: o site.js acende uma a uma com a rolagem (e mostra todas sem movimento).
export function palavras(texto) {
  const lista = [];
  let atual = '';
  for (const ch of String(texto)) {
    if (ch === ' ' || ch === '\n') {
      if (atual) lista.push(atual);
      atual = '';
    } else atual += ch;
  }
  if (atual) lista.push(atual);
  return lista.map((p) => `<span>${esc(p)}</span>`).join(' ');
}

async function carregarSecao(nome) {
  const arquivo = path.join(AQUI, 'secoes', `${nome}.mjs`);
  if (!fs.existsSync(arquivo)) throw new Error(`a seção "${nome}" não existe: crie _gerador/secoes/${nome}.mjs`);
  const modulo = await import(`${pathToFileURL(arquivo).href}?v=${Date.now()}`);
  if (typeof modulo.default !== 'function') throw new Error(`_gerador/secoes/${nome}.mjs precisa exportar uma função (export default)`);
  return modulo.default;
}

// Rolagem suave (Lenis): ligada, a não ser que a ordem diga lenis: false.
const comLenis = (site) => site.lenis !== false;

function cabeca(ctx) {
  const { site, pagina, assets } = ctx;
  const titulo = pagina.rota ? `${pagina.titulo} · ${site.nome}` : `${site.nome} · ${pagina.titulo}`;
  const linhas = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(pagina.descricao)}">`,
    `<meta name="theme-color" content="${esc(site.corDoNavegador)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="${esc(site.idioma.replaceAll('-', '_'))}">`,
    `<meta property="og:site_name" content="${esc(site.nome)}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(pagina.descricao)}">`,
  ];
  if (site.endereco) {
    const base = site.endereco.endsWith('/') ? site.endereco : `${site.endereco}/`;
    const url = `${base}${pagina.rota ? `${pagina.rota}/` : ''}`;
    linhas.push(`<link rel="canonical" href="${esc(url)}">`, `<meta property="og:url" content="${esc(url)}">`);
    if (site.imagemSocial) linhas.push(`<meta property="og:image" content="${esc(base + site.imagemSocial)}">`);
  }
  linhas.push(
    `<link rel="icon" href="${assets}img/icone.svg" type="image/svg+xml">`,
    `<link rel="stylesheet" href="${assets}marca/tokens.css">`,
    ...(comLenis(site) ? [`<link rel="stylesheet" href="${assets}vendor/lenis/lenis.css">`] : []),
    `<link rel="stylesheet" href="${assets}css/site.css">`,
  );
  const n = site.negocio;
  if (n && n.tipo) {
    const dados = {
      '@context': 'https://schema.org',
      '@type': n.tipo,
      name: site.nome,
      description: pagina.descricao,
      telephone: n.telefone || undefined,
      email: n.email || undefined,
      address: n.rua ? { '@type': 'PostalAddress', streetAddress: n.rua, addressLocality: n.cidade, addressRegion: n.estado, addressCountry: 'BR' } : undefined,
    };
    if (site.endereco) dados.url = site.endereco;
    linhas.push(`<script type="application/ld+json">\n${jsonParaScript(dados)}\n</script>`);
  }
  return linhas.join('\n');
}

async function montarPagina(pagina, ordem) {
  const ctx = {
    site: ordem.site,
    paginas: ordem.paginas,
    pagina,
    esc,
    palavras,
    assets: `${prefixo(pagina.rota)}assets/`,
    link: (para) => linkRelativo(pagina.rota, para),
  };
  const partes = [];
  for (const nome of pagina.secoes) partes.push((await carregarSecao(nome))(ctx));
  const topo = ordem.site.cabecalho ? (await carregarSecao(ordem.site.cabecalho))(ctx) : '';
  const fim = ordem.site.rodape ? (await carregarSecao(ordem.site.rodape))(ctx) : '';
  const a = ctx.assets;
  return `<!doctype html>
<html lang="${esc(ordem.site.idioma)}">
<head>
${cabeca(ctx)}
</head>
<body data-pagina="${esc(pagina.rota || 'inicio')}"${ordem.site.molde ? ' data-molde="ordem"' : ''}>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${topo}
<main id="conteudo" tabindex="-1">
${partes.join('\n')}
</main>
${fim}
<script src="${a}vendor/gsap/gsap.min.js" defer></script>
<script src="${a}vendor/gsap/ScrollTrigger.min.js" defer></script>
${comLenis(ordem.site) ? `<script src="${a}vendor/lenis/lenis.min.js" defer></script>\n` : ''}<script src="${a}js/site.js" defer></script>
</body>
</html>
`;
}

function arquivoDa(rota) {
  return rota ? `${rota}/index.html` : 'index.html';
}

export async function montar() {
  const ordem = await import(`${pathToFileURL(path.join(AQUI, 'ordem.mjs')).href}?v=${Date.now()}`);
  if (!ordem.site || !Array.isArray(ordem.paginas) || !ordem.paginas.length) throw new Error('ordem.mjs precisa exportar site e paginas (com ao menos uma página)');
  const rotas = new Set();
  for (const p of ordem.paginas) {
    if (!validarRota(p.rota)) throw new Error(`rota inválida: "${p.rota}" (só minúsculas, números, hífen e /; sem nome reservado do Windows como con, aux, nul, com1, lpt1)`);
    if (rotas.has(p.rota)) throw new Error(`rota repetida: "${p.rota}"`);
    if (!Array.isArray(p.secoes) || !p.secoes.length) throw new Error(`a página "${p.rota || 'inicial'}" não tem seções`);
    rotas.add(p.rota);
  }
  if (!rotas.has('')) throw new Error('falta a página inicial (rota "")');
  const escritas = [];
  for (const p of ordem.paginas) {
    const html = await montarPagina(p, ordem);
    const destino = path.join(SITE, ...arquivoDa(p.rota).split('/'));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
    escritas.push(arquivoDa(p.rota));
  }
  // páginas que o gerador escreveu antes e saíram da ordem: só essas são apagadas
  let antes = [];
  try {
    antes = JSON.parse(fs.readFileSync(REGISTRO, 'utf8')).paginas || [];
  } catch {}
  const removidas = [];
  for (const rel of antes) {
    if (escritas.includes(rel)) continue;
    const arq = path.join(SITE, ...rel.split('/'));
    if (fs.existsSync(arq)) {
      fs.rmSync(arq);
      removidas.push(rel);
      const pasta = path.dirname(arq);
      if (pasta !== SITE && fs.readdirSync(pasta).length === 0) fs.rmdirSync(pasta);
    }
  }
  fs.writeFileSync(REGISTRO, `${JSON.stringify({ paginas: escritas }, null, 2)}\n`);
  return { paginas: escritas, removidas };
}

function rodandoDireto() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (rodandoDireto()) {
  try {
    const r = await montar();
    process.stdout.write(`${JSON.stringify({ ok: true, ...r })}\n`);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ ok: false, erro: String((e && e.message) || e) })}\n`);
    process.exitCode = 1;
  }
}
