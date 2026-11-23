// Instagram sem login: a página pública do perfil (nome, bio, link e a grade com as publicações
// mais recentes) e a página pública de cada publicação (legenda, data e foto na maior resolução
// pública). Os dados saem do JSON que a própria página traz embutido; sem ele, das etiquetas
// og: e do <time datetime>. Sem expressão regular: JSON.parse, URL e métodos de texto.
import path from 'node:path';
import { acharObjetos, jsonOuNada } from './leitor.mjs';
import { baixar } from './baixar.mjs';
import { esperar } from './cdp.mjs';

export const BASE_INSTAGRAM = 'https://www.instagram.com';
export const MINIMO_DE_POSTS = 12;
const PRAZO_DA_PAGINA_MS = 15000;
const ROLAGENS = 3;

// "@nome", "nome" ou o endereço do perfil viram só "nome".
export function usuarioDoInstagram(entrada) {
  let t = String(entrada || '').trim();
  if (t.includes('instagram.com')) {
    try {
      const u = new URL(t.startsWith('http') ? t : `https://${t}`);
      t = u.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return '';
    }
  }
  while (t.startsWith('@')) t = t.slice(1);
  return t.split('/')[0].split('?')[0].trim().toLowerCase();
}

// Código da publicação a partir do endereço: /<perfil>/p/<código>/ ou /reel/<código>/.
export function codigoDoPost(href) {
  let partes;
  try {
    partes = new URL(href).pathname.split('/').filter(Boolean);
  } catch {
    return '';
  }
  for (let i = 0; i < partes.length - 1; i += 1) if (partes[i] === 'p' || partes[i] === 'reel') return partes[i + 1];
  return '';
}

// Roda dentro da página do perfil.
function lerPerfilNaPagina() {
  const links = [...document.querySelectorAll('a[href]')]
    .map((a) => a.href)
    .filter((h) => h.includes('/p/') || h.includes('/reel/'));
  const jsons = [...document.querySelectorAll('script[type="application/json"]')]
    .map((s) => s.textContent || '')
    .filter((t) => t.includes('"biography"'));
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';
  return { links, jsons, descricao: meta('og:description'), foto: meta('og:image'), titulo: document.title };
}

function contarLinks() {
  return [...document.querySelectorAll('a[href]')].filter((a) => a.href.includes('/p/') || a.href.includes('/reel/')).length;
}

function rolar() {
  window.scrollBy(0, window.innerHeight * 3);
  return true;
}

// Roda dentro da página de uma publicação.
function lerPostNaPagina() {
  const meta = (p) =>
    document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ||
    document.querySelector(`meta[name="${p}"]`)?.getAttribute('content') ||
    '';
  const jsons = [...document.querySelectorAll('script[type="application/json"]')]
    .map((s) => s.textContent || '')
    .filter((t) => t.includes('"taken_at"'));
  const datas = [...document.querySelectorAll('time[datetime]')].map((t) => t.getAttribute('datetime'));
  const pronto = jsons.length > 0 || meta('og:description') !== '';
  return pronto ? { jsons, datas, descricao: meta('og:description') || meta('description'), foto: meta('og:image') } : null;
}

// Nome, bio e links do perfil, do JSON embutido.
export function dadosDoPerfil(lido, usuario) {
  let perfil = null;
  for (const texto of lido.jsons || []) {
    const achados = acharObjetos(jsonOuNada(texto), (o) => typeof o.biography === 'string' && 'full_name' in o, 20);
    perfil = achados.find((o) => String(o.username || '').toLowerCase() === usuario) || achados[0] || perfil;
    if (perfil) break;
  }
  const links = [];
  if (perfil) {
    for (const b of perfil.bio_links || []) if (b && typeof b.url === 'string' && b.url) links.push(b.url);
    if (typeof perfil.external_url === 'string' && perfil.external_url && !links.includes(perfil.external_url)) links.push(perfil.external_url);
  }
  return {
    usuario,
    nome: perfil ? String(perfil.full_name || '') : '',
    bio: perfil ? perfil.biography : '',
    links,
    resumo: lido.descricao || '',
  };
}

// A maior foto pública de um item: a lista vem da maior para a menor; quando há largura, vale ela.
export function melhorFoto(item) {
  const cands = (item && item.image_versions2 && item.image_versions2.candidates) || [];
  if (!cands.length) return item && typeof item.display_uri === 'string' ? { url: item.display_uri, largura: 0 } : null;
  let melhor = cands[0];
  for (const c of cands) if ((c.width || 0) > (melhor.width || 0)) melhor = c;
  return { url: melhor.url, largura: melhor.width || item.original_width || 0 };
}

// Legenda dentro do og:description: '... no <data>: "legenda". '
export function legendaDaDescricao(descricao) {
  const t = String(descricao || '');
  const ini = t.indexOf(': "');
  const fim = t.lastIndexOf('"');
  return ini !== -1 && fim > ini + 2 ? t.slice(ini + 3, fim) : '';
}

const dataDoSegundo = (s) => new Date(Number(s) * 1000).toISOString().slice(0, 10);

// Legenda, data e fotos de uma publicação.
export function dadosDoPost(lido, codigo, url) {
  let item = null;
  for (const texto of lido.jsons || []) {
    const achados = acharObjetos(jsonOuNada(texto), (o) => 'taken_at' in o && (o.code === codigo || o.shortcode === codigo), 5);
    if (achados.length) {
      item = achados[0];
      break;
    }
  }
  if (item) {
    const partes = Array.isArray(item.carousel_media) && item.carousel_media.length ? item.carousel_media : [item];
    return {
      codigo,
      url,
      data: dataDoSegundo(item.taken_at),
      legenda: (item.caption && item.caption.text) || '',
      video: item.media_type === 2,
      fotos: partes.map(melhorFoto).filter(Boolean),
      de: 'json',
    };
  }
  const data = (lido.datas || []).find(Boolean) || '';
  return {
    codigo,
    url,
    data: data.slice(0, 10),
    legenda: legendaDaDescricao(lido.descricao),
    video: false,
    fotos: lido.foto ? [{ url: lido.foto, largura: 0 }] : [],
    de: 'etiquetas',
  };
}

async function listarPosts(leitor, maximo, pausa) {
  await leitor.esperarAte(contarLinks, PRAZO_DA_PAGINA_MS);
  let lido = await leitor.avaliar(lerPerfilNaPagina);
  for (let i = 0; i < ROLAGENS && new Set(lido.links.map(codigoDoPost)).size < maximo; i += 1) {
    await leitor.avaliar(rolar);
    await esperar(pausa);
    lido = await leitor.avaliar(lerPerfilNaPagina);
  }
  const vistos = new Map();
  for (const href of lido.links) {
    const c = codigoDoPost(href);
    if (c && !vistos.has(c)) vistos.set(c, href);
  }
  return { lido, posts: [...vistos.entries()].slice(0, maximo) };
}

// Lê o perfil e as publicações. pasta: onde salvar as fotos. Devolve { perfil, posts, fotos }.
export async function lerInstagram(leitor, entrada, { base = BASE_INSTAGRAM, maximo = 24, pasta, pausa = 1500, aoAvancar = () => {} } = {}) {
  const usuario = usuarioDoInstagram(entrada);
  if (!usuario) throw new Error('o @ do Instagram veio vazio');
  const endereco = `${base}/${encodeURIComponent(usuario)}/`;
  await leitor.ir(endereco);
  const { lido, posts: lista } = await listarPosts(leitor, maximo, pausa);
  const perfil = { ...dadosDoPerfil(lido, usuario), endereco };
  const posts = [];
  for (const [codigo, href] of lista) {
    aoAvancar(`Lendo a publicação ${posts.length + 1} de ${lista.length} do Instagram...`);
    await leitor.ir(href);
    const lidoPost = await leitor.esperarAte(lerPostNaPagina, PRAZO_DA_PAGINA_MS);
    if (!lidoPost) continue;
    posts.push(dadosDoPost(lidoPost, codigo, href));
  }
  if (!pasta) return { perfil, posts, fotos: [] };
  const baixados = await baixarFotos(posts, path.join(pasta, 'fotos'));
  return { perfil, posts: baixados.posts, fotos: baixados.fotos };
}

// Cada foto vai para <pasta>/<código>-<n>.jpg; a publicação volta com o arquivo e o tamanho real.
async function baixarFotos(posts, pasta) {
  const fotos = [];
  const novos = [];
  for (const post of posts) {
    const lista = [];
    for (let i = 0; i < post.fotos.length; i += 1) {
      const arquivo = path.join(pasta, `${post.codigo}-${i + 1}.jpg`);
      try {
        const r = await baixar(post.fotos[i].url, arquivo);
        lista.push({ ...post.fotos[i], arquivo: path.basename(arquivo), largura: r.largura, altura: r.altura });
        fotos.push({ codigo: post.codigo, arquivo, largura: r.largura, altura: r.altura });
      } catch (e) {
        lista.push({ ...post.fotos[i], erro: String(e.message) });
      }
    }
    novos.push({ ...post, fotos: lista });
  }
  return { posts: novos, fotos };
}
