// Instagram SINTÉTICO como ele aparece para quem entrou na conta, para testar a leitura com login sem
// internet e sem conta de verdade:
// - casa.logada: 45 publicações. A página traz as 12 primeiras no JSON embutido; ao rolar, a própria
//   página pede as próximas 12 (resposta com a proteção "for (;;);" na frente, como o Instagram faz).
//   Cada foto tem três tamanhos fora de ordem (640, 1440, 1080); a maior é a de 1440. A resposta
//   também traz uma publicação de outro perfil, que não pode entrar.
// - casa.desafio: 5 publicações, 2 no JSON; a página da 3ª manda para a verificação do Instagram.
// - casa.saiu: o perfil manda direto para a página de entrar (o login acabou).
// Nomes e textos inventados.
import http from 'node:http';
import { jpeg } from './fontes-sinteticas.mjs';

export const USUARIO_LOGADO = 'casa.logada';
export const USUARIO_DESAFIO = 'casa.desafio';
export const USUARIO_SAIU = 'casa.saiu';
export const TOTAL_LOGADO = 45;
export const POR_PAGINA = 12;
export const LARGURA_MAIOR = 1440;
export const PROTECAO = 'for (;;);';
export const codigoLogado = (n) => `Clg${String(n).padStart(2, '0')}`;
export const codigoDesafio = (n) => `Cdz${String(n).padStart(2, '0')}`;
const SEGUNDOS_BASE = 1793000000;
const DIA = 86400;
const LARGURAS = Object.freeze([640, LARGURA_MAIOR, 1080]);

const pagina = (cabeca, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${cabeca}</head><body>${corpo}</body></html>`;
const json = (o) => `<script type="application/json">${JSON.stringify(o)}</script>`;

function foto(origem, nome) {
  return { candidates: LARGURAS.map((w) => ({ url: `${origem}/img/${nome}-${w}.jpg`, width: w, height: Math.round((w * 5) / 4) })) };
}

// Item como o do JSON do Instagram logado. n = 1 é a mais nova. A cada 10, uma é carrossel.
export function itemLogado(n, origem, { usuario = USUARIO_LOGADO, codigo = codigoLogado(n) } = {}) {
  const item = {
    pk: String(1000 + n),
    code: codigo,
    taken_at: SEGUNDOS_BASE - n * DIA,
    media_type: 1,
    caption: { text: `Legenda logada ${n}` },
    image_versions2: foto(origem, codigo),
    original_width: LARGURA_MAIOR,
    user: { username: usuario },
  };
  if (n % 10 === 3) {
    item.media_type = 8;
    item.carousel_media = [
      { id: `${codigo}a`, media_type: 1, taken_at: item.taken_at, image_versions2: foto(origem, `${codigo}a`) },
      { id: `${codigo}b`, media_type: 1, taken_at: item.taken_at, image_versions2: foto(origem, `${codigo}b`) },
    ];
  }
  return item;
}

// Resposta da grade: as publicações de "inicio" até inicio + quantidade - 1, e uma de outro perfil.
export function respostaDaGrade(inicio, quantidade, origem) {
  const fim = Math.min(TOTAL_LOGADO, inicio + quantidade - 1);
  const edges = [];
  for (let n = inicio; n <= fim; n += 1) edges.push({ node: itemLogado(n, origem) });
  edges.push({ node: itemLogado(99, origem, { usuario: 'outro.perfil', codigo: 'Outro99' }) });
  return { data: { xdt_api__v1__feed__user_timeline_graphql_connection: { edges, page_info: { has_next_page: fim < TOTAL_LOGADO } } }, status: 'ok' };
}

function perfilLogado(origem) {
  const perfil = { require: [['Perfil', { data: { user: { username: USUARIO_LOGADO, full_name: 'Casa Logada', biography: 'Bio da casa logada.', bio_links: [] } } }]] };
  const iniciais = respostaDaGrade(1, POR_PAGINA, origem);
  const codigos = iniciais.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges.map((e) => e.node.code).filter((c) => c !== 'Outro99');
  const script = `<script>
    var usuario = ${JSON.stringify(USUARIO_LOGADO)}, pagina = 1, buscando = false;
    function por(codigos) {
      document.getElementById('grade').insertAdjacentHTML('beforeend', codigos.map(function (c) { return '<a href="/' + usuario + '/p/' + c + '/">p</a>'; }).join(''));
    }
    setTimeout(function () { por(${JSON.stringify(codigos)}); }, 200);
    window.addEventListener('scroll', function () {
      if (buscando || pagina * ${POR_PAGINA} >= ${TOTAL_LOGADO}) return;
      buscando = true;
      fetch('/graphql/query?pagina=' + pagina).then(function (r) { return r.text(); }).then(function (t) {
        var j = JSON.parse(t.slice(${PROTECAO.length}));
        por(j.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges.map(function (e) { return e.node.code; }).filter(function (c) { return c !== 'Outro99'; }));
        pagina += 1;
        buscando = false;
      });
    });
  </script>`;
  return pagina(`<title>Casa Logada</title>${json(perfil)}${json({ require: [[iniciais]] })}`, `<main id="grade" style="min-height:6000vh"></main>${script}`);
}

function perfilDesafio(origem) {
  const itens = [1, 2].map((n) => itemLogado(n, origem, { usuario: USUARIO_DESAFIO, codigo: codigoDesafio(n) }));
  const links = [1, 2, 3, 4, 5].map((n) => `<a href="/${USUARIO_DESAFIO}/p/${codigoDesafio(n)}/">p</a>`).join('');
  return pagina(`<title>Casa Desafio</title>${json({ require: [[{ items: itens }]] })}`, `<main>${links}</main>`);
}

function responder(req, origem) {
  const u = new URL(req.url, origem);
  const rel = decodeURIComponent(u.pathname);
  if (rel === `/${USUARIO_LOGADO}/`) return { tipo: 'text/html', corpo: perfilLogado(origem) };
  if (rel === '/graphql/query') {
    const n = Number(u.searchParams.get('pagina'));
    return { tipo: 'text/javascript', corpo: PROTECAO + JSON.stringify(respostaDaGrade(n * POR_PAGINA + 1, POR_PAGINA, origem)) };
  }
  if (rel === `/${USUARIO_DESAFIO}/`) return { tipo: 'text/html', corpo: perfilDesafio(origem) };
  if (rel.startsWith(`/${USUARIO_DESAFIO}/p/`)) return { para: '/challenge/AbC123/?next=/' };
  if (rel === `/${USUARIO_SAIU}/`) return { para: `/accounts/login/?next=%2F${USUARIO_SAIU}%2F` };
  if (rel.startsWith('/challenge/') || rel.startsWith('/accounts/login/')) return { tipo: 'text/html', corpo: pagina('<title>Instagram</title>', '<p>confirme</p>') };
  if (rel.startsWith('/img/')) {
    const largura = LARGURAS.find((w) => rel.endsWith(`-${w}.jpg`)) || 640;
    return { tipo: 'image/jpeg', corpo: jpeg(largura, Math.round((largura * 5) / 4)) };
  }
  return null;
}

// Sobe o servidor numa porta livre. pedidos: tudo o que foi pedido.
export function servirInstagramLogado() {
  const pedidos = [];
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const origem = `http://${req.headers.host}`;
      pedidos.push(req.url);
      const r = responder(req, origem);
      if (!r) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
      if (r.para) return res.writeHead(302, { Location: r.para }).end();
      return res.writeHead(200, { 'Content-Type': `${r.tipo}${r.tipo.startsWith('text') ? '; charset=utf-8' : ''}` }).end(r.corpo);
    });
    srv.listen(0, '127.0.0.1', () => {
      const origem = `http://127.0.0.1:${srv.address().port}`;
      resolve({ origem, pedidos, fechar: () => new Promise((r) => srv.close(() => r())) });
    });
  });
}
