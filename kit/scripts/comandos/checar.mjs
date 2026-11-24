// Confere a estrutura de todas as páginas do site, lendo pelo DOM do Chrome (não por texto):
// RED (reprova, saída 2): endereço externo carregado (CDN), vendor citado que falta, fonte que não carrega,
// mídia ausente, link interno morto (inclusive âncora), sem <title>, sem description, sem lang,
// sem exatamente um <h1>, <select> nativo, travessão no texto visível, erro de JavaScript e
// resto-do-molde (elemento com data-molde: texto do negócio fictício que ainda não foi trocado).
// WARN: og:image relativa, JSON-LD que não abre, fonte usada que não foi declarada, link com o
// mesmo texto 4 vezes ou mais (link-repetido) e a mesma frase 3 vezes ou mais (frase-repetida).
// Letras (lib/letras.mjs): RED fonte-sem-licenca; WARN fonte-pesada (não .woff2, ou soma alta).
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, paginasDoSite, TAMANHOS } from '../lib/site.mjs';
import { abrirSessao, visitar } from '../lib/sessao.mjs';
import { estatico } from '../lib/pagina.mjs';
import { repeticoes } from '../lib/pagina-leitura.mjs';
import { progresso } from '../lib/executar.mjs';
import { esperar } from '../lib/cdp.mjs';
import { anotarLetras } from '../lib/letras.mjs';
import { listarArquivos } from '../lib/caminhos.mjs';
import { foraDoPacote, textosQueCitam, citado } from '../lib/pacote.mjs';

// As bibliotecas de movimento que o molde traz. Cada uma só é exigida se alguma página, CSS ou
// script do site a cita: a direção pode dispensar a rolagem suave (Lenis), e aí o arquivo pode sair.
// A conta de "citado" é a do pacote, então o checar nunca exige o que o pacote chama de não usado.
export const VENDOR_DO_MOLDE = Object.freeze([
  'assets/vendor/gsap/gsap.min.js',
  'assets/vendor/gsap/ScrollTrigger.min.js',
  'assets/vendor/lenis/lenis.min.js',
  'assets/vendor/lenis/lenis.css',
]);

// Os arquivos de VENDOR_DO_MOLDE que o site cita e que não estão na pasta (caminhos relativos a site/).
export function vendorAusente(pastaSite) {
  const arquivos = listarArquivos(pastaSite).filter((rel) => !foraDoPacote(rel));
  const textos = textosQueCitam(pastaSite, arquivos);
  return VENDOR_DO_MOLDE.filter((rel) => !arquivos.includes(rel) && citado(textos, rel));
}

export const REPETICAO = Object.freeze({
  link_repetido: 4, // o mesmo texto de link, na mesma página
  frase_repetida: 3, // a mesma frase, na mesma página
  frase_minima: 16, // letras para contar como frase
  maximo: 25,
});

function ehAbsoluto(url) {
  const baixo = url.toLowerCase();
  return baixo.startsWith('https://') || baixo.startsWith('http://');
}

export function anotarEstatico(pagina, est, rede, errosJs, red, warn) {
  const p = pagina.rel;
  if (est.selects > 0) red.push({ pagina: p, tipo: 'select-nativo', detalhe: `${est.selects} <select> na página` });
  const externos = new Set([...est.externos.map((e) => e.url), ...rede.externos]);
  for (const url of externos) red.push({ pagina: p, tipo: 'endereco-externo', detalhe: url });
  const quebrados = new Map();
  for (const q of [...est.quebrados, ...rede.quebrados]) {
    const atual = quebrados.get(q.url) || { status: 0, link: false };
    quebrados.set(q.url, { status: q.status || atual.status || q.erro || 0, link: atual.link || Boolean(q.link) });
  }
  for (const [url, q] of quebrados) {
    red.push({ pagina: p, tipo: q.link ? 'link-morto' : 'arquivo-ausente', detalhe: `${url} (${q.status || 'sem resposta'})` });
  }
  for (const a of est.ancorasMortas) red.push({ pagina: p, tipo: 'link-morto', detalhe: `${a} (a âncora não existe)` });
  for (const f of est.fontesComErro) red.push({ pagina: p, tipo: 'fonte-quebrada', detalhe: f });
  for (const f of est.fantasmas) warn.push({ pagina: p, tipo: 'fonte-nao-declarada', detalhe: f });
  if (!est.titulo) red.push({ pagina: p, tipo: 'sem-titulo', detalhe: 'falta <title>' });
  if (!est.descricao) red.push({ pagina: p, tipo: 'sem-descricao', detalhe: 'falta <meta name="description">' });
  if (!est.idioma) red.push({ pagina: p, tipo: 'sem-idioma', detalhe: 'falta lang no <html>' });
  if (est.h1 !== 1) red.push({ pagina: p, tipo: 'h1', detalhe: `a página tem ${est.h1} <h1> (precisa de exatamente um)` });
  for (const t of est.travessoes) red.push({ pagina: p, tipo: 'travessao', detalhe: `"…${t}…"` });
  for (const e of errosJs) red.push({ pagina: p, tipo: 'erro-de-script', detalhe: e });
  for (const m of est.molde || []) {
    const onde = m === 'ordem' ? 'site.molde em _gerador/ordem.mjs (nome, negócio e páginas do exemplo)' : `"${m}" (data-molde)`;
    red.push({ pagina: p, tipo: 'resto-do-molde', detalhe: `ainda é do negócio fictício do molde: ${onde}` });
  }
  if (est.ogImage !== null && est.ogImage !== undefined && !ehAbsoluto(est.ogImage)) {
    warn.push({ pagina: p, tipo: 'og-image-relativa', detalhe: est.ogImage || '(vazia)' });
  }
  for (const j of est.jsonLd) if (!j.ok) warn.push({ pagina: p, tipo: 'json-ld-quebrado', detalhe: j.erro });
}

export default async function checar(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const red = [];
  const warn = [];
  for (const rel of vendorAusente(c.site)) red.push({ pagina: '-', tipo: 'vendor-ausente', detalhe: `site/${rel}` });
  anotarLetras(c.site, red, warn);
  const paginas = paginasDoSite(c);
  const notebook = TAMANHOS.find((t) => t.nome === 'notebook');
  const sessao = await abrirSessao(c.site);
  try {
    for (const pagina of paginas) {
      progresso(`Conferindo ${pagina.rel}...`);
      await visitar(sessao, pagina, notebook);
      const est = await sessao.avaliar(estatico);
      await esperar(50);
      anotarEstatico(pagina, est, sessao.rede(), sessao.errosJs(), red, warn);
      for (const w of await sessao.avaliar(repeticoes, REPETICAO)) warn.push({ pagina: pagina.rel, ...w });
    }
  } finally {
    await sessao.fechar();
  }
  const aprovado = red.length === 0;
  return {
    ok: aprovado,
    codigo: aprovado ? (warn.length ? 'CHECAGEM_COM_AVISOS' : 'CHECAGEM_OK') : 'CHECAGEM_REPROVADA',
    sair: aprovado ? 0 : 2,
    avisos: warn.length ? [{ codigo: 'CHECAGEM_COM_AVISOS', dados: { total: warn.length } }] : [],
    arquivos: { site: c.rel('site') },
    dados: { paginas: paginas.map((p) => p.rel), red: red.length, warn: warn.length, vermelhos: red, amarelos: warn },
  };
}
