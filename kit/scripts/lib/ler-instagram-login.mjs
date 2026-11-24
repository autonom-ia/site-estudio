// Instagram com o login que a pessoa fez na janela do estúdio (lib/instagram-conta.mjs), no Chrome
// sem janela. Diferenças da leitura sem login (lib/ler-instagram.mjs):
// - a grade continua carregando ao rolar: o estúdio guarda as respostas em JSON que a própria página
//   pede (cada uma traz legenda, data e todas as fotos de várias publicações) e só abre a página das
//   publicações que ficaram de fora;
// - ritmo de gente: entre uma rolagem ou uma página e a próxima, de 1 a 2 vezes a pausa (2 a 4 s);
// - ao primeiro sinal de verificação, ou de volta para a página de entrar, para na hora e devolve o
//   que já leu, com o motivo em "bloqueio". Nunca tenta de novo;
// - prazo próprio (7 minutos): acabou, para e devolve o que já leu, com "prazo": true. Uma publicação
//   que falha não derruba as outras.
// Sem expressão regular: JSON.parse, URL e métodos de texto.
import path from 'node:path';
import { acharObjetos, jsonOuNada } from './leitor.mjs';
import { esperar } from './cdp.mjs';
import {
  BASE_INSTAGRAM,
  PRAZO_DA_PAGINA_MS,
  usuarioDoInstagram,
  codigoDoPost,
  dadosDoPerfil,
  dadosDoPost,
  postDoItem,
  baixarFotos,
  lerPerfilNaPagina,
  lerPostNaPagina,
  contarLinks,
  rolar,
} from './ler-instagram.mjs';

export const MAXIMO_COM_LOGIN = 40;
export const PAUSA_COM_LOGIN_MS = 2000;
// Cabe nos 10 minutos do assistente, com o Google, o site e as fotos depois.
export const PRAZO_COM_LOGIN_MS = 7 * 60 * 1000;

// Quantas publicações ler: o pedido (ou o padrão), nunca mais de 40 com login.
export function limiteDePosts(pedidos, comLogin, semLogin = 24) {
  if (!comLogin) return pedidos || semLogin;
  return Math.min(pedidos || MAXIMO_COM_LOGIN, MAXIMO_COM_LOGIN);
}
const ROLAGENS_COM_LOGIN = 20;
const ROLAGENS_SEM_NOVIDADE = 3;
const LIMITE_DE_ITENS = 1000;
// Algumas respostas do Instagram começam com esta proteção antes do JSON.
const PROTECAO = 'for (;;);';

// Primeiro pedaço do endereço que é tela de verificação, e o segundo pedaço depois de /accounts/.
const TELAS_DE_VERIFICACAO = Object.freeze(['challenge', 'checkpoint', 'auth_platform']);
const CONTA_EM_VERIFICACAO = Object.freeze(['suspended', 'disabled']);
const TELAS_DE_ENTRAR = Object.freeze(['login', 'signup', 'emailsignup']);

// 'verificacao' (o Instagram pediu para confirmar a conta), 'login' (mandou para a página de entrar)
// ou '' (página normal), só pelo endereço.
export function bloqueioDoEndereco(href) {
  let partes;
  try {
    partes = new URL(href).pathname.split('/').filter(Boolean).map((p) => p.toLowerCase());
  } catch {
    return '';
  }
  const [primeiro, segundo] = partes;
  if (TELAS_DE_VERIFICACAO.includes(primeiro)) return 'verificacao';
  if (primeiro === 'accounts' && CONTA_EM_VERIFICACAO.includes(segundo)) return 'verificacao';
  if (primeiro === 'accounts' && TELAS_DE_ENTRAR.includes(segundo)) return 'login';
  return '';
}

// Pedido de dados (só o endereço) ou resposta que vale guardar (endereço e tipo): do mesmo endereço do
// Instagram, nas rotas de dados da página.
export function respostaDaLeitura(base = BASE_INSTAGRAM) {
  let host;
  try {
    host = new URL(base).host;
  } catch {
    host = '';
  }
  return (url, tipo) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    if (u.host !== host) return false;
    const rota = u.pathname.includes('graphql') || u.pathname.startsWith('/api/v1/');
    if (tipo === undefined) return rota;
    const dados = tipo.includes('json') || tipo.includes('javascript') || tipo.includes('text');
    return rota && dados;
  };
}

const semProtecao = (texto) => {
  const t = String(texto || '').trim();
  return t.startsWith(PROTECAO) ? t.slice(PROTECAO.length) : t;
};

// Publicação no JSON: tem código, data e legenda (as partes de um carrossel não têm legenda).
const ehPublicacao = (o) => typeof o.code === 'string' && o.code !== '' && 'taken_at' in o && 'caption' in o;

function doPerfil(item, usuario) {
  const dono = (item.user && item.user.username) || (item.owner && item.owner.username);
  return !dono || String(dono).toLowerCase() === usuario;
}

// Itens de publicação do perfil achados nos textos (JSON da página e das respostas), por código.
export function itensDoJson(textos, usuario) {
  const itens = new Map();
  for (const texto of textos) {
    const valor = jsonOuNada(semProtecao(texto));
    for (const o of acharObjetos(valor, ehPublicacao, LIMITE_DE_ITENS)) {
      if (doPerfil(o, usuario) && !itens.has(o.code)) itens.set(o.code, o);
    }
  }
  return itens;
}

// As publicações dos textos, da mais nova para a mais antiga, no máximo "maximo".
export function postsDoJson(textos, usuario, { base = BASE_INSTAGRAM, maximo = MAXIMO_COM_LOGIN } = {}) {
  const itens = [...itensDoJson(textos, usuario).values()].sort((a, b) => Number(b.taken_at) - Number(a.taken_at));
  return itens.slice(0, maximo).map((item) => postDoItem(item, item.code, `${base}/p/${item.code}/`));
}

const ritmo = (pausa) => pausa * (1 + Math.random());

async function bloqueio(leitor) {
  try {
    return bloqueioDoEndereco(await leitor.endereco());
  } catch {
    return '';
  }
}

// Rola a grade juntando os links e os itens do JSON, até ter "maximo", parar de vir novidade ou
// aparecer um bloqueio. Depois de cada rolagem, espera a página terminar de pedir os dados (num
// computador ou internet lentos, a resposta demora): "sem novidade" só conta com a página quieta.
async function rolarGrade(leitor, o) {
  const grade = new Map();
  let itens = new Map();
  let lido = null;
  let vistos = 0;
  let semNovidade = 0;
  let parou = '';
  for (let volta = 0; volta <= ROLAGENS_COM_LOGIN; volta += 1) {
    if (volta > 0 && o.acabou()) break;
    lido = await leitor.avaliar(lerPerfilNaPagina);
    for (const href of lido.links) {
      const c = codigoDoPost(href);
      if (c && !grade.has(c)) grade.set(c, href);
    }
    itens = itensDoJson([...lido.jsonsDePosts, ...(await o.escuta.textos())], o.usuario);
    const total = new Set([...grade.keys(), ...itens.keys()]).size;
    if (total >= o.maximo) break;
    semNovidade = total > vistos ? 0 : semNovidade + 1;
    vistos = total;
    if (semNovidade >= ROLAGENS_SEM_NOVIDADE || volta === ROLAGENS_COM_LOGIN) break;
    o.aoAvancar(`Rolando o Instagram: ${total} publicações até agora...`);
    await leitor.avaliar(rolar);
    await esperar(ritmo(o.pausa));
    await o.escuta.esperarQuieto();
    parou = await bloqueio(leitor);
    if (parou) break;
  }
  return { grade, itens, lido, parou, prazo: o.acabou() };
}

// A ordem da grade primeiro; depois as que só vieram no JSON, da mais nova para a mais antiga.
function ordem(grade, itens, maximo) {
  const soNoJson = [...itens.values()]
    .filter((i) => !grade.has(i.code))
    .sort((a, b) => Number(b.taken_at) - Number(a.taken_at))
    .map((i) => i.code);
  return [...grade.keys(), ...soNoJson].slice(0, maximo);
}

async function percorrer(leitor, o) {
  const perfilVazio = { ...dadosDoPerfil({}, o.usuario), endereco: o.endereco };
  await leitor.ir(o.endereco);
  let parou = await bloqueio(leitor);
  if (parou) return { perfil: perfilVazio, posts: [], fotos: [], comLogin: true, bloqueio: parou, prazo: false, falhas: [] };
  await leitor.esperarAte(contarLinks, PRAZO_DA_PAGINA_MS);
  await o.escuta.esperarQuieto();
  const g = await rolarGrade(leitor, o);
  parou = g.parou;
  const respostas = (await o.escuta.textos()).filter((t) => t.includes('"biography"'));
  const perfil = { ...dadosDoPerfil({ ...g.lido, jsons: [...g.lido.jsons, ...respostas] }, o.usuario), endereco: o.endereco };
  const lista = ordem(g.grade, g.itens, o.maximo);
  const posts = [];
  const falhas = [];
  let prazo = false;
  for (const codigo of lista) {
    const href = g.grade.get(codigo) || `${o.base}/p/${codigo}/`;
    if (g.itens.has(codigo)) {
      posts.push(postDoItem(g.itens.get(codigo), codigo, href));
      continue;
    }
    if (parou || prazo) continue;
    if (o.acabou()) {
      prazo = true;
      continue;
    }
    o.aoAvancar(`Lendo a publicação ${posts.length + 1} de ${lista.length} do Instagram...`);
    try {
      await esperar(ritmo(o.pausa));
      await leitor.ir(href);
      parou = await bloqueio(leitor);
      if (parou) continue;
      const lidoPost = await leitor.esperarAte(lerPostNaPagina, PRAZO_DA_PAGINA_MS);
      if (lidoPost) posts.push(dadosDoPost(lidoPost, codigo, href));
    } catch {
      falhas.push(codigo);
    }
  }
  return { perfil, posts, fotos: [], comLogin: true, bloqueio: parou, prazo: prazo || (g.prazo && posts.length < o.maximo), falhas };
}

// Lê o perfil e as publicações com login. Devolve { perfil, posts, fotos, comLogin, bloqueio, prazo,
// falhas (códigos das publicações que deram erro) }.
export async function lerInstagramComLogin(leitor, entrada, { base = BASE_INSTAGRAM, maximo = MAXIMO_COM_LOGIN, pasta, pausa = PAUSA_COM_LOGIN_MS, prazoMs = PRAZO_COM_LOGIN_MS, aoAvancar = () => {} } = {}) {
  const usuario = usuarioDoInstagram(entrada);
  if (!usuario) throw new Error('o @ do Instagram veio vazio');
  const endereco = `${base}/${encodeURIComponent(usuario)}/`;
  const escuta = leitor.escutarRespostas(respostaDaLeitura(base));
  const fim = Date.now() + prazoMs;
  const acabou = () => Date.now() >= fim;
  let r;
  try {
    r = await percorrer(leitor, { usuario, endereco, base, maximo: Math.min(maximo, MAXIMO_COM_LOGIN), pausa, escuta, aoAvancar, acabou });
  } finally {
    escuta.parar();
  }
  if (!pasta || !r.posts.length) return r;
  const baixados = await baixarFotos(r.posts, path.join(pasta, 'fotos'));
  return { ...r, posts: baixados.posts, fotos: baixados.fotos };
}
