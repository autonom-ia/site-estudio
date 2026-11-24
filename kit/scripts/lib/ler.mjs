// Junta as três leituras (Instagram, perfil do Google e site atual), salva o que leu em
// sites/<nome>/coleta/ e põe os fatos, com fonte e data, numa parte própria de fatos.md.
// Com só o @ e o nome do negócio: o nome do Instagram ajuda a busca no Google, e o site atual vem
// do perfil do Google ou do link da bio. Uma fonte que falha vira aviso; as outras seguem.
// Com opcoes.leitorInstagram (o Chrome sem janela com o login da pessoa), o Instagram é lido com login
// (lib/ler-instagram-login.mjs); o Google e o site, sempre sem login, pelo leitor comum.
import fs from 'node:fs';
import path from 'node:path';
import { lerInstagram, BASE_INSTAGRAM, MINIMO_DE_POSTS } from './ler-instagram.mjs';
import { lerInstagramComLogin, PAUSA_COM_LOGIN_MS } from './ler-instagram-login.mjs';
import { lerGoogle, BASE_GOOGLE } from './ler-google.mjs';
import { lerSite, contatosDosLinks, ehSiteDoNegocio } from './ler-site.mjs';
import { hoje } from './leitor.mjs';
import { escreverJson, escreverTexto, lerTexto } from './json.mjs';
import { aviso } from './saida.mjs';
import * as R from './registros.mjs';

export { ehSiteDoNegocio };

// Fotos menores que isto pedem o original à pessoa (tela cheia no computador).
export const LARGURA_BOA = 1080;

async function tentar(fn) {
  try {
    return { ok: true, valor: await fn() };
  } catch (e) {
    return { ok: false, detalhe: String((e && e.message) || e).slice(0, 300) };
  }
}

function lerOInstagram(pedido, ctx) {
  const comum = { base: ctx.bases.instagram, maximo: pedido.posts, pasta: path.join(ctx.pasta, 'instagram'), aoAvancar: ctx.aoAvancar };
  if (ctx.leitorInstagram) return lerInstagramComLogin(ctx.leitorInstagram, pedido.instagram, { ...comum, pausa: ctx.pausaComLogin });
  return lerInstagram(ctx.leitor, pedido.instagram, { ...comum, pausa: ctx.pausa });
}

async function parteInstagram(pedido, ctx) {
  const comLogin = Boolean(ctx.leitorInstagram);
  const r = await tentar(() => lerOInstagram(pedido, ctx));
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_INSTAGRAM_FALHOU', { instagram: pedido.instagram, detalhe: r.detalhe, com_login: comLogin }));
    return null;
  }
  const ig = r.valor;
  // Verificação ou volta para a página de entrar: a leitura parou ali, sem insistir.
  if (ig.bloqueio) {
    ctx.avisos.push(aviso('LER_INSTAGRAM_PEDIU_VERIFICACAO', { motivo: ig.bloqueio, lidas: ig.posts.length }));
    if (!ig.posts.length) return null;
  }
  const dir = path.join(ctx.pasta, 'instagram');
  escreverJson(path.join(dir, 'perfil.json'), ig.perfil);
  escreverJson(path.join(dir, 'posts.json'), ig.posts);
  escreverTexto(path.join(dir, 'posts.md'), R.tabelaDePosts(ig.posts, ctx.data));
  const comLegenda = ig.posts.filter((p) => p.legenda && p.data).length;
  // Com login, menos de 12 é o tamanho do perfil (ou a leitura parou e já avisou), não falta de login.
  if (!comLogin && comLegenda < MINIMO_DE_POSTS) ctx.avisos.push(aviso('LER_INSTAGRAM_POUCOS', { posts: comLegenda, minimo: MINIMO_DE_POSTS }));
  const maior = ig.fotos.reduce((m, f) => Math.max(m, f.largura || 0), 0);
  if (ig.fotos.length && maior < LARGURA_BOA) ctx.avisos.push(aviso('LER_FOTOS_PEQUENAS', { maior_largura: maior, boa: LARGURA_BOA }));
  ctx.registros.push(...R.registrosDoInstagram(ig, ctx.data));
  const contatos = contatosDosLinks(ig.perfil.links).map((c) => ({ ...c, fonte: ig.perfil.endereco }));
  ctx.registros.push(...contatos.map((c) => ({ fato: R.celula(`${c.tipo} na bio do Instagram: ${c.valor}`), fonte: R.celula(`Perfil público do Instagram, ${c.fonte}`), data: ctx.data })));
  ctx.dados.instagram = { usuario: ig.perfil.usuario, com_login: comLogin, posts: ig.posts.length, posts_com_legenda_e_data: comLegenda, fotos: ig.fotos.length, maior_largura: maior };
  return ig;
}

async function parteGoogle(busca, ctx) {
  const r = await tentar(() => lerGoogle(ctx.leitor, busca, { base: ctx.bases.google }));
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_GOOGLE_FALHOU', { busca, detalhe: r.detalhe }));
    return null;
  }
  const g = r.valor;
  if (!g.achou) {
    ctx.avisos.push(aviso('LER_GOOGLE_NAO_ACHOU', { busca, motivo: g.motivo }));
    return null;
  }
  escreverJson(path.join(ctx.pasta, 'google', 'lugar.json'), g);
  if (g.alternativas.length) ctx.avisos.push(aviso('LER_GOOGLE_PRIMEIRO_DA_LISTA', { escolhido: g.lugar.nome, outros: g.alternativas }));
  if (!g.lugar.horario.length) ctx.avisos.push(aviso('LER_GOOGLE_SEM_HORARIO', { nome: g.lugar.nome }));
  ctx.registros.push(...R.registrosDoGoogle(g, ctx.data));
  ctx.dados.google = { nome: g.lugar.nome, fonte: g.lugar.fonte, dias_com_horario: g.lugar.horario.length, avaliacoes: g.avaliacoes.length };
  return g;
}

async function parteSite(endereco, ctx) {
  const r = await tentar(() => lerSite(ctx.leitor, endereco, { pasta: path.join(ctx.pasta, 'site'), aoAvancar: ctx.aoAvancar }));
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_SITE_FALHOU', { endereco, detalhe: r.detalhe }));
    return null;
  }
  const s = r.valor;
  if (s.desvio) {
    ctx.avisos.push(aviso('LER_SITE_OUTRO_ENDERECO', { endereco, final: s.desvio }));
    return null;
  }
  const dir = path.join(ctx.pasta, 'site');
  escreverJson(path.join(dir, 'paginas.json'), s.paginas.map(({ texto, ...resto }) => resto));
  escreverTexto(path.join(dir, 'texto.md'), R.textoDoSite(s.paginas, ctx.data));
  ctx.registros.push(...R.registrosDoSite(s, ctx.data));
  ctx.dados.site = { endereco: s.inicio, paginas: s.paginas.length, fotos: s.fotos.length };
  return s;
}

// pedido: { instagram, negocio, google, site, posts }. opcoes: { pasta (coleta/), fatos (fatos.md),
// leitor, leitorInstagram (com login, opcional), bases, data, pausa, aoAvancar }.
// Devolve { avisos, dados, registros }.
export async function lerFontes(pedido, opcoes) {
  const ctx = {
    leitor: opcoes.leitor,
    pasta: opcoes.pasta,
    bases: { instagram: BASE_INSTAGRAM, google: BASE_GOOGLE, ...(opcoes.bases || {}) },
    data: opcoes.data || hoje(),
    pausa: opcoes.pausa === undefined ? 1500 : opcoes.pausa,
    pausaComLogin: opcoes.pausa === undefined ? PAUSA_COM_LOGIN_MS : opcoes.pausa,
    leitorInstagram: opcoes.leitorInstagram || null,
    aoAvancar: opcoes.aoAvancar || (() => {}),
    avisos: [],
    registros: [],
    dados: {},
  };
  const ig = pedido.instagram ? await parteInstagram(pedido, ctx) : null;
  const busca = pedido.google || pedido.negocio || (ig && ig.perfil.nome) || '';
  const g = busca ? await parteGoogle(busca, ctx) : null;
  const candidatos = [pedido.site, g && g.lugar.site, ...((ig && ig.perfil.links) || [])].filter(Boolean);
  const endereco = pedido.site || candidatos.find(ehSiteDoNegocio) || '';
  if (endereco) await parteSite(endereco, ctx);
  const registros = R.semRepetir(ctx.registros);
  if (registros.length) {
    escreverJson(path.join(ctx.pasta, 'fatos-lidos.json'), registros);
    const atual = fs.existsSync(opcoes.fatos) ? lerTexto(opcoes.fatos) : '';
    escreverTexto(opcoes.fatos, R.juntarNoFatos(atual, R.secaoLida(registros, ctx.data)));
  }
  return { avisos: ctx.avisos, dados: { ...ctx.dados, fatos_registrados: registros.length, data: ctx.data }, registros };
}
