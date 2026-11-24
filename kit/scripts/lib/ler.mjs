// Junta as três leituras (Instagram, perfil do Google e site atual), salva o que leu em
// sites/<nome>/coleta/ e põe os fatos, com fonte e data, numa parte própria de fatos.md.
// Com só o @ e o nome do negócio: o nome do Instagram ajuda a busca no Google, e o site atual vem
// do perfil do Google ou do link da bio. Uma fonte que falha vira aviso; as outras seguem.
// Com opcoes.leitorInstagram (o Chrome sem janela com o login da pessoa), o Instagram é lido com login
// (lib/ler-instagram-login.mjs); o Google e o site, sempre sem login, pelo leitor comum.
import fs from 'node:fs';
import path from 'node:path';
import { lerInstagram, BASE_INSTAGRAM, MINIMO_DE_POSTS } from './ler-instagram.mjs';
import { lerInstagramComLogin, PAUSA_COM_LOGIN_MS, PRAZO_COM_LOGIN_MS } from './ler-instagram-login.mjs';
import { lerGoogle, BASE_GOOGLE } from './ler-google.mjs';
import { lerSite, contatosDosLinks, ehSiteDoNegocio } from './ler-site.mjs';
import { hoje, antesDoPrazo, TempoEsgotado } from './leitor.mjs';
import { escreverJson, escreverTexto } from './json.mjs';
import { aviso } from './saida.mjs';
import { sanear } from './executar.mjs';
import * as R from './registros.mjs';

export { ehSiteDoNegocio };

// Fotos menores que isto pedem o original à pessoa (tela cheia no computador).
export const LARGURA_BOA = 1080;

const LIMITE_DO_DETALHE = 300;
const INICIOS_LOCAIS = Object.freeze(['ws://', 'wss://', 'http://127.0.0.1', 'http://localhost', 'https://127.0.0.1']);
const ESPACOS = Object.freeze([' ', '\n', '\r', '\t']);

// Troca cada endereço local (o do DevTools, com o identificador da conexão) por um marcador.
export function semEnderecosLocais(texto) {
  let saida = '';
  let palavra = '';
  const fechar = () => {
    const local = INICIOS_LOCAIS.some((ini) => palavra.toLowerCase().includes(ini));
    saida += local ? '<endereço local>' : palavra;
    palavra = '';
  };
  for (const ch of String(texto)) {
    if (ESPACOS.includes(ch)) {
      fechar();
      saida += ch;
    } else palavra += ch;
  }
  fechar();
  return saida;
}

// O erro como vai para a saída: sem endereço local e sem nada com cara de segredo.
export function detalheDoErro(e) {
  return sanear(semEnderecosLocais(String((e && e.message) || e))).slice(0, LIMITE_DO_DETALHE);
}

// Teto da leitura inteira, contado do início do comando: passa dele, para e grava o que já leu. Vale
// para as três partes (o Instagram com login tem ainda o prazo próprio, de 7 minutos). O assistente
// espera 10 minutos: o minuto que sobra é para fechar o navegador e gravar.
export const TETO_DA_LEITURA_MS = 9 * 60 * 1000;

async function tentar(fn) {
  try {
    return { ok: true, valor: await fn() };
  } catch (e) {
    if (e instanceof TempoEsgotado) return { ok: false, esgotou: true };
    return { ok: false, detalhe: detalheDoErro(e) };
  }
}

function lerOInstagram(pedido, ctx) {
  const comum = { base: ctx.bases.instagram, maximo: pedido.posts, pasta: path.join(ctx.pasta, 'instagram'), aoAvancar: ctx.aoAvancar, permitirEnderecoLocal: ctx.permitirEnderecoLocal, prazo: ctx.prazo };
  if (ctx.leitorInstagram) return lerInstagramComLogin(ctx.leitorInstagram, pedido.instagram, { ...comum, pausa: ctx.pausaComLogin, prazoMs: ctx.prazoComLoginMs });
  return lerInstagram(ctx.leitor, pedido.instagram, { ...comum, pausa: ctx.pausa });
}

async function parteInstagram(pedido, ctx) {
  const comLogin = Boolean(ctx.leitorInstagram);
  const r = await tentar(() => lerOInstagram(pedido, ctx));
  if (r.esgotou) {
    ctx.esgotou = true;
    return null;
  }
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_INSTAGRAM_FALHOU', { instagram: pedido.instagram, detalhe: r.detalhe, com_login: comLogin }));
    return null;
  }
  const ig = r.valor;
  // Parou pelo teto da leitura inteira (não pelo prazo próprio do login): os outros também param.
  if (ig.esgotou || Date.now() >= ctx.prazo) ctx.esgotou = true;
  // Verificação ou volta para a página de entrar: a leitura parou ali, sem insistir.
  if (ig.bloqueio) {
    ctx.avisos.push(aviso('LER_INSTAGRAM_PEDIU_VERIFICACAO', { motivo: ig.bloqueio, lidas: ig.posts.length }));
    if (!ig.posts.length) return null;
  }
  if (ig.prazo) ctx.avisos.push(aviso('LER_INSTAGRAM_PARCIAL', { lidas: ig.posts.length }));
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
  const r = await tentar(() => antesDoPrazo(lerGoogle(ctx.leitor, busca, { base: ctx.bases.google }), ctx.prazo));
  if (r.esgotou) {
    ctx.esgotou = true;
    return null;
  }
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_GOOGLE_FALHOU', { busca, detalhe: r.detalhe }));
    return null;
  }
  const g = r.valor;
  if (!g.achou) {
    ctx.avisos.push(aviso('LER_GOOGLE_NAO_ACHOU', { busca, motivo: g.motivo }));
    return null;
  }
  // O texto das avaliações fica só aqui, sem o nome de quem escreveu; não vira fato do fatos.md.
  escreverJson(path.join(ctx.pasta, 'google', 'lugar.json'), g);
  if (g.alternativas.length) ctx.avisos.push(aviso('LER_GOOGLE_PRIMEIRO_DA_LISTA', { escolhido: g.lugar.nome, outros: g.alternativas }));
  if (!g.lugar.horario.length) ctx.avisos.push(aviso('LER_GOOGLE_SEM_HORARIO', { nome: g.lugar.nome }));
  ctx.registros.push(...R.registrosDoGoogle(g, ctx.data));
  ctx.dados.google = { nome: g.lugar.nome, fonte: g.lugar.fonte, dias_com_horario: g.lugar.horario.length, avaliacoes: g.avaliacoes.length };
  return g;
}

async function parteSite(endereco, referencia, ctx) {
  const opcoes = { pasta: path.join(ctx.pasta, 'site'), aoAvancar: ctx.aoAvancar, prazo: ctx.prazo, referencia, permitirEnderecoLocal: ctx.permitirEnderecoLocal };
  const r = await tentar(() => lerSite(ctx.leitor, endereco, opcoes));
  if (!r.ok) {
    ctx.avisos.push(aviso('LER_SITE_FALHOU', { endereco, detalhe: r.detalhe }));
    return null;
  }
  const s = r.valor;
  if (s.desvio) {
    ctx.avisos.push(aviso('LER_SITE_OUTRO_ENDERECO', { endereco, final: s.desvio }));
    return null;
  }
  if (s.esgotou) ctx.esgotou = true;
  if (!s.paginas.length) return null;
  const dir = path.join(ctx.pasta, 'site');
  escreverJson(path.join(dir, 'paginas.json'), s.paginas.map(({ texto, ...resto }) => resto));
  escreverTexto(path.join(dir, 'texto.md'), R.textoDoSite(s.paginas, ctx.data));
  if (s.duvidosos.length) ctx.avisos.push(aviso('LER_SITE_CONTATO_DE_TERCEIRO', { contatos: s.duvidosos }));
  if (s.aConferir.length) ctx.avisos.push(aviso('LER_SITE_CONTATO_A_CONFERIR', { contatos: s.aConferir }));
  ctx.registros.push(...R.registrosDoSite(s, ctx.data));
  ctx.dados.site = { endereco: s.inicio, paginas: s.paginas.length, fotos: s.fotos.length, fora_do_site: s.foraDoSite.length };
  return s;
}

// "casa.com.br" vira "https://casa.com.br": a pessoa costuma passar o endereço sem o começo.
export function comEsquema(endereco) {
  const t = String(endereco || '').trim();
  if (!t) return '';
  return t.includes('://') ? t : `https://${t}`;
}

// O endereço de site a ler: o que a pessoa passou, se for site de negócio (rede social, página de
// links e loja de pedidos viram aviso); senão, o do perfil do Google ou o primeiro link da bio que
// for site de negócio.
function siteParaLer(pedido, g, ig, ctx) {
  const doPedido = comEsquema(pedido.site);
  if (doPedido && ehSiteDoNegocio(doPedido)) return doPedido;
  if (doPedido) ctx.avisos.push(aviso('LER_SITE_OUTRO_ENDERECO', { endereco: pedido.site, final: doPedido }));
  const candidatos = [g && g.lugar.site, ...((ig && ig.perfil.links) || [])].filter(Boolean);
  return candidatos.find(ehSiteDoNegocio) || '';
}

// Grava a parte lida em fatos.md. Marca quebrada: não mexe em fatos.md (aviso); o que foi lido fica
// em coleta/. Antes de reescrever, guarda o fatos.md anterior em coleta/fatos-antes-da-leitura.md.
const BOM = '\uFEFF';

function gravarNoFatos(registros, ctx, arquivo) {
  const bruto = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf8') : '';
  const comBom = bruto.startsWith(BOM); // o Bloco de Notas antigo do Windows grava assim: mantém
  const atual = comBom ? bruto.slice(1) : bruto;
  const junto = R.juntarNoFatos(atual, R.secaoLida(registros, ctx.data));
  if (junto === null) {
    ctx.avisos.push(aviso('LER_FATOS_MARCADOR_QUEBRADO', { inicio: R.MARCA_INICIO, fim: R.MARCA_FIM }));
    return false;
  }
  if (fs.existsSync(arquivo)) escreverTexto(path.join(ctx.pasta, 'fatos-antes-da-leitura.md'), bruto);
  escreverTexto(arquivo, `${comBom ? BOM : ''}${junto}`);
  return true;
}

// pedido: { instagram, negocio, google, site, posts }. opcoes: { pasta (coleta/), fatos (fatos.md),
// leitor, leitorInstagram (com login, opcional), bases, data, pausa, prazoComLoginMs, aoAvancar,
// inicio }. inicio: o instante (Date.now) em que o comando começou; o teto conta dali, com a abertura
// do navegador dentro dele. Só os testes passam tetoMs (teto da leitura) e permitirEnderecoLocal
// (páginas e fotos servidas em 127.0.0.1); o comando nunca. Devolve { avisos, dados, registros }.
export async function lerFontes(pedido, opcoes) {
  const ctx = {
    leitor: opcoes.leitor,
    pasta: opcoes.pasta,
    bases: { instagram: BASE_INSTAGRAM, google: BASE_GOOGLE, ...(opcoes.bases || {}) },
    data: opcoes.data || hoje(),
    pausa: opcoes.pausa === undefined ? 1500 : opcoes.pausa,
    pausaComLogin: opcoes.pausa === undefined ? PAUSA_COM_LOGIN_MS : opcoes.pausa,
    leitorInstagram: opcoes.leitorInstagram || null,
    prazoComLoginMs: opcoes.prazoComLoginMs === undefined ? PRAZO_COM_LOGIN_MS : opcoes.prazoComLoginMs,
    aoAvancar: opcoes.aoAvancar || (() => {}),
    prazo: (opcoes.inicio ?? Date.now()) + (opcoes.tetoMs ?? TETO_DA_LEITURA_MS),
    permitirEnderecoLocal: opcoes.permitirEnderecoLocal === true,
    esgotou: false,
    avisos: [],
    registros: [],
    dados: {},
  };
  const ig = pedido.instagram && Date.now() < ctx.prazo ? await parteInstagram(pedido, ctx) : null;
  if (pedido.instagram && !ig && Date.now() >= ctx.prazo) ctx.esgotou = true;
  const busca = pedido.google || pedido.negocio || (ig && ig.perfil.nome) || '';
  const g = busca && Date.now() < ctx.prazo ? await parteGoogle(busca, ctx) : null;
  if (busca && !g && Date.now() >= ctx.prazo) ctx.esgotou = true;
  const endereco = siteParaLer(pedido, g, ig, ctx);
  const referencia = {
    nomes: [g && g.lugar.nome, ig && ig.perfil.nome, String(pedido.negocio || '').split(',')[0]].filter(Boolean),
    telefones: [g && g.lugar.telefone].filter(Boolean),
  };
  if (endereco && Date.now() < ctx.prazo) await parteSite(endereco, referencia, ctx);
  else if (endereco) ctx.esgotou = true;
  if (ctx.esgotou) ctx.avisos.push(aviso('LER_TEMPO_ESGOTADO', { minutos: Math.round((opcoes.tetoMs ?? TETO_DA_LEITURA_MS) / 60000) }));
  const registros = R.semRepetir(ctx.registros);
  let noFatos = false;
  if (registros.length) {
    escreverJson(path.join(ctx.pasta, 'fatos-lidos.json'), registros);
    noFatos = gravarNoFatos(registros, ctx, opcoes.fatos);
  }
  return { avisos: ctx.avisos, dados: { ...ctx.dados, fatos_registrados: registros.length, fatos_no_arquivo: noFatos, data: ctx.data }, registros };
}
