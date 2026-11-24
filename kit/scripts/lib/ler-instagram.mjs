// Instagram sem login: a página pública do perfil (nome, bio, link e a grade com as publicações
// mais recentes) e a página pública de cada publicação (legenda, data e foto na maior resolução
// pública). Os dados saem do JSON que a própria página traz embutido; sem ele, das etiquetas
// og: e do <time datetime>. Sem expressão regular: JSON.parse, URL e métodos de texto.
import path from 'node:path';
import { acharObjetos, jsonOuNada, TempoEsgotado, antesDoPrazo } from './leitor.mjs';
import { baixar } from './baixar.mjs';
import { esperar } from './cdp.mjs';

export const BASE_INSTAGRAM = 'https://www.instagram.com';
export const MINIMO_DE_POSTS = 12;
export const PRAZO_DA_PAGINA_MS = 15000;
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

// Roda dentro da página do perfil. Com login, a página também traz publicações no JSON embutido.
export function lerPerfilNaPagina() {
  const links = [...document.querySelectorAll('a[href]')]
    .map((a) => a.href)
    .filter((h) => h.includes('/p/') || h.includes('/reel/'));
  const jsons = [...document.querySelectorAll('script[type="application/json"]')]
    .map((s) => s.textContent || '')
    .filter((t) => t.includes('"biography"'));
  const jsonsDePosts = [...document.querySelectorAll('script[type="application/json"]')]
    .map((s) => s.textContent || '')
    .filter((t) => t.includes('"taken_at"'));
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';
  return { links, jsons, jsonsDePosts, descricao: meta('og:description'), foto: meta('og:image'), titulo: document.title };
}

export function contarLinks() {
  return [...document.querySelectorAll('a[href]')].filter((a) => a.href.includes('/p/') || a.href.includes('/reel/')).length;
}

// Rola e espera dois quadros: o evento de rolagem da página já rodou quando volta (com teto, para uma
// aba sem quadros não prender a leitura).
export function rolar() {
  window.scrollBy(0, window.innerHeight * 3);
  return new Promise((pronto) => {
    setTimeout(() => pronto(true), 1000);
    requestAnimationFrame(() => requestAnimationFrame(() => pronto(true)));
  });
}

// Roda dentro da página de uma publicação.
export function lerPostNaPagina() {
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

// O objeto de usuário do perfil pedido, e só dele: a página (sobretudo com login) também traz a conta
// de quem entrou e contas sugeridas, e nenhum dado delas pode entrar. Entre os objetos com o mesmo
// @, prefere o que tem a bio.
export function usuarioDoPerfil(textos, usuario) {
  const alvo = String(usuario || '').toLowerCase();
  if (!alvo) return null;
  const ehOPedido = (o) => typeof o.username === 'string' && o.username.toLowerCase() === alvo;
  let achado = null;
  for (const texto of textos || []) {
    for (const o of acharObjetos(jsonOuNada(texto), ehOPedido, 50)) {
      if (typeof o.biography === 'string') return o;
      achado = achado || o;
    }
  }
  return achado;
}

// Sem o objeto do perfil no JSON: o nome sai do título da página, "Nome (@usuario) • Instagram",
// e só se o título for desse @. Bio e links ficam vazios (as etiquetas não trazem).
export function nomeDoTitulo(titulo, usuario) {
  const t = String(titulo || '');
  const marca = ` (@${String(usuario || '').toLowerCase()})`;
  const fim = t.toLowerCase().indexOf(marca);
  return usuario && fim > 0 ? t.slice(0, fim).trim() : '';
}

// Nome, bio e links do perfil pedido: do JSON embutido, só do objeto com o mesmo @; sem ele, das
// etiquetas da página do perfil. Nunca de outra conta.
export function dadosDoPerfil(lido, usuario) {
  const perfil = usuarioDoPerfil(lido.jsons, usuario);
  const links = [];
  if (perfil) {
    for (const b of perfil.bio_links || []) if (b && typeof b.url === 'string' && b.url) links.push(b.url);
    if (typeof perfil.external_url === 'string' && perfil.external_url && !links.includes(perfil.external_url)) links.push(perfil.external_url);
  }
  const nome = perfil && typeof perfil.full_name === 'string' ? perfil.full_name : nomeDoTitulo(lido.titulo, usuario);
  return {
    usuario,
    nome,
    bio: perfil && typeof perfil.biography === 'string' ? perfil.biography : '',
    links,
    resumo: lido.descricao || '',
    de: perfil ? 'json' : 'etiquetas',
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

export const dataDoSegundo = (s) => new Date(Number(s) * 1000).toISOString().slice(0, 10);

// Uma publicação a partir do item do JSON do Instagram: legenda, data e a maior foto de cada parte.
export function postDoItem(item, codigo, url) {
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
  if (item) return postDoItem(item, codigo, url);
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

// Sem prazo: a leitura não tem hora para acabar (só os testes de uma parte isolada).
const SEM_PRAZO = Number.POSITIVE_INFINITY;

// Lê o perfil e as publicações. pasta: onde salvar as fotos. prazo: hora (Date.now) em que a leitura
// inteira acaba (lib/ler.mjs); passou dela, para e devolve o que já leu, com esgotou: cada passo no
// navegador espera só até o prazo, e o que já foi lido fica. Se o prazo acaba antes da lista de
// publicações, não há nada lido, e o TempoEsgotado sobe. Publicação que não abre (erro do navegador)
// fica de fora, e a leitura segue para a próxima. Devolve
// { perfil, posts, fotos, esgotou }. permitirEnderecoLocal: só os testes (que servem as fotos em
// 127.0.0.1) ligam.
export async function lerInstagram(leitor, entrada, { base = BASE_INSTAGRAM, maximo = 24, pasta, pausa = 1500, aoAvancar = () => {}, permitirEnderecoLocal = false, prazo = SEM_PRAZO } = {}) {
  const usuario = usuarioDoInstagram(entrada);
  if (!usuario) throw new Error('o @ do Instagram veio vazio');
  const endereco = `${base}/${encodeURIComponent(usuario)}/`;
  const passo = (promessa) => antesDoPrazo(promessa, prazo);
  await passo(leitor.ir(endereco));
  const { lido, posts: lista } = await passo(listarPosts(leitor, maximo, pausa));
  const perfil = { ...dadosDoPerfil(lido, usuario), endereco };
  const posts = [];
  let esgotou = false;
  for (const [codigo, href] of lista) {
    if (Date.now() >= prazo) {
      esgotou = true;
      break;
    }
    aoAvancar(`Lendo a publicação ${posts.length + 1} de ${lista.length} do Instagram...`);
    let lidoPost;
    try {
      await passo(leitor.ir(href));
      lidoPost = await passo(leitor.esperarAte(lerPostNaPagina, PRAZO_DA_PAGINA_MS));
    } catch (e) {
      if (!(e instanceof TempoEsgotado)) continue;
      esgotou = true;
      break;
    }
    if (!lidoPost) continue;
    posts.push(dadosDoPost(lidoPost, codigo, href));
  }
  if (!pasta) return { perfil, posts, fotos: [], esgotou };
  const baixados = await baixarFotos(posts, path.join(pasta, 'fotos'), { permitirEnderecoLocal, prazo });
  return { perfil, posts: baixados.posts, fotos: baixados.fotos, esgotou: esgotou || baixados.esgotou };
}

// Cada foto vai para <pasta>/<código>-<n>.jpg; a publicação volta com o arquivo e o tamanho real.
// O baixar recusa endereço interno do computador ou da rede de casa (lib/baixar.mjs). Passou do
// prazo, as fotos que faltam ficam sem arquivo (com erro "sem-tempo") e volta esgotou.
export async function baixarFotos(posts, pasta, { permitirEnderecoLocal = false, prazo = SEM_PRAZO } = {}) {
  const fotos = [];
  const novos = [];
  let esgotou = false;
  for (const post of posts) {
    const lista = [];
    for (let i = 0; i < post.fotos.length; i += 1) {
      const arquivo = path.join(pasta, `${post.codigo}-${i + 1}.jpg`);
      if (esgotou || Date.now() >= prazo) {
        esgotou = true;
        lista.push({ ...post.fotos[i], erro: 'sem-tempo' });
        continue;
      }
      try {
        const r = await baixar(post.fotos[i].url, arquivo, { permitirEnderecoLocal, prazo });
        lista.push({ ...post.fotos[i], arquivo: path.basename(arquivo), largura: r.largura, altura: r.altura });
        fotos.push({ codigo: post.codigo, arquivo, largura: r.largura, altura: r.altura });
      } catch (e) {
        if (e instanceof TempoEsgotado) esgotou = true;
        lista.push({ ...post.fotos[i], erro: esgotou ? 'sem-tempo' : String(e.message) });
      }
    }
    novos.push({ ...post, fotos: lista });
  }
  return { posts: novos, fotos, esgotou };
}
