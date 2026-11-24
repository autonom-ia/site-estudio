// Páginas públicas SINTÉTICAS para testar a leitura sem internet: um perfil de Instagram com 14
// publicações (metade com o JSON embutido, metade só com as etiquetas og: e <time>), o perfil do
// Google (lista com dois resultados, painel do lugar, avaliações com nome de autor que NÃO pode ser
// lido) e um site de duas páginas com JSON-LD. Negócio, nomes, endereço e telefone são inventados.
import http from 'node:http';
import zlib from 'node:zlib';
import { crc32 } from '../../scripts/lib/zip.mjs';

export const USUARIO = 'casa.exemplo';
export const NEGOCIO = 'Casa Exemplo';
export const TOTAL_DE_POSTS = 14;
export const AUTORES = Object.freeze(['Pessoa Inventada Um', 'Pessoa Inventada Dois']);
export const codigo = (n) => `Cex${String(n).padStart(2, '0')}`;
const SEGUNDOS_BASE = 1793000000;

const pagina = (cabeca, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${cabeca}</head><body>${corpo}</body></html>`;
const json = (o) => `<script type="application/json">${JSON.stringify(o)}</script>`;
const esc = (t) => String(t).split('&').join('&amp;').split('"').join('&quot;').split('<').join('&lt;');

// JPEG mínimo: só o cabeçalho com largura e altura (é baixado, nunca desenhado).
export function jpeg(largura, altura) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, altura >> 8, altura & 255, largura >> 8, largura & 255, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

// PNG de verdade (o navegador desenha e mede), cinza, largura x altura.
function png(largura, altura) {
  const pedaco = (tipo, dados) => {
    const t = Buffer.from(tipo, 'ascii');
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, dados])) >>> 0);
    return Buffer.concat([tam, t, dados, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  const linhas = Buffer.alloc((largura + 1) * altura, 128);
  for (let y = 0; y < altura; y += 1) linhas[y * (largura + 1)] = 0;
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([assinatura, pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(linhas)), pedaco('IEND', Buffer.alloc(0))]);
}

function perfil() {
  const dados = { require: [['Perfil', { data: { user: { username: USUARIO, full_name: NEGOCIO, biography: 'Revisão de bicicleta sob encomenda.\nRua Inventada, 100.', bio_links: [{ url: 'https://wa.me/5500900001111' }], external_url: null } } }]] };
  const links = [];
  for (let n = 1; n <= TOTAL_DE_POSTS; n += 1) links.push(`<a href="/${USUARIO}/${n === 5 ? 'reel' : 'p'}/${codigo(n)}/">publicação</a>`);
  // a grade aparece depois de carregar, como na página de verdade
  const grade = `<script>setTimeout(function () { document.getElementById('grade').innerHTML = ${JSON.stringify(links.join(''))}; }, 300);</script>`;
  return pagina(`<title>${NEGOCIO} (@${USUARIO})</title><meta property="og:description" content="120 seguidores">${json(dados)}`, `<main id="grade"></main>${grade}`);
}

function post(n, origem) {
  const cod = codigo(n);
  const legenda = `Legenda ${n} | com barra\nsegunda linha`;
  if (n % 2 === 0) {
    const desc = `12 curtidas, 1 comentários - ${USUARIO} em 3 de novembro de 2026: "${legenda}". `;
    return pagina(
      `<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${origem}/img/${cod}-og.jpg">`,
      `<time datetime="2026-11-0${(n % 9) + 1}T12:00:00.000Z">dia</time>`,
    );
  }
  const foto = (sufixo) => ({ candidates: [{ url: `${origem}/img/${cod}-${sufixo}a.jpg`, width: 1080, height: 1350 }, { url: `${origem}/img/${cod}-${sufixo}b.jpg`, width: 640, height: 800 }] });
  const item = { code: cod, taken_at: SEGUNDOS_BASE + n * 86400, media_type: n === 3 ? 8 : 1, caption: { text: legenda }, image_versions2: foto('') };
  if (n === 3) item.carousel_media = [{ image_versions2: foto('1') }, { image_versions2: foto('2') }];
  const outro = { code: 'Outro99', taken_at: 1, caption: { text: 'publicação de outro perfil' }, image_versions2: foto('x') };
  return pagina(`<meta property="og:description" content="x">${json({ require: [[{ items: [outro] }, { items: [item] }]] })}`, '<p>publicação</p>');
}

function listaDoGoogle() {
  const a = (slug, nome) => `<a href="/maps/place/${slug}/data=1" aria-label="${nome}">${nome}</a>`;
  return pagina('<title>Google Maps</title>', `${a('Casa+Exemplo', NEGOCIO)}${a('Casa+Exemplo+Filial', NEGOCIO + ' Filial')}<div>Trecho de busca: aberto 24 horas</div>`);
}

function lugarDoGoogle(origem) {
  const dia = (d, h) => `<tr><td>${d}</td><td>${h}</td></tr>`;
  const avaliacao = (id, autor, estrelas, texto, quando) =>
    `<div data-review-id="${id}"><div data-review-id="${id}"><div class="d4r55">${autor}</div><span role="img" aria-label="${estrelas} estrelas"></span><span class="rsqaWe">${quando}</span><span class="wiI7pd">${texto}</span><button class="w8nwRe" onclick="this.previousElementSibling.textContent += ' e o atendimento foi ótimo.'">Mais</button></div></div>`;
  const avaliacoes = `<div id="avaliacoes" hidden>${avaliacao('r1', AUTORES[0], 5, 'Revisão rápida perfeito', 'há 2 semanas')}${avaliacao('r2', AUTORES[1], 4, 'Entrega no horário', 'há 1 mês')}</div>`;
  const aba = '<button role="tab" aria-label="Avaliações de Casa Exemplo" onclick="document.getElementById(\'avaliacoes\').hidden = false">Avaliações</button>';
  const corpo = `<div role="main" aria-label="${NEGOCIO}"><h1>${NEGOCIO}</h1>
    <button data-item-id="address" aria-label="Endereço: Rua Inventada, 100 - Bairro Exemplo, Cidade Exemplo - UF ">x</button>
    <button data-item-id="phone:tel:00000001234" aria-label="Telefone: (00) 0000-1234 ">x</button>
    <a data-item-id="authority" href="${origem}/site/">site</a>
    <table>${dia('segunda-feira', 'Fechado')}${dia('terça-feira', '<div>07:00–12:00</div><div>14:00–19:00</div>')}${dia('quarta-feira', '07:00–19:00')}${dia('sábado', '08:00–13:00')}</table>
    <div class="F7nice"><span>4,8</span><br><span>(37)</span></div>${aba}${avaliacoes}</div>`;
  return pagina('<title>Casa Exemplo - Google Maps</title>', corpo);
}

function site(rel, origem) {
  const ld = { '@context': 'https://schema.org', '@type': 'BicycleStore', name: NEGOCIO, telephone: '(00) 0000-1234', address: { '@type': 'PostalAddress', streetAddress: 'Rua Inventada, 100', addressLocality: 'Cidade Exemplo' }, openingHoursSpecification: [{ dayOfWeek: ['https://schema.org/Wednesday'], opens: '07:00', closes: '19:00' }] };
  if (rel === '/site/contato/') return pagina('<title>Contato</title>', '<h1>Contato</h1><p>Fale com a gente.</p><a href="mailto:ola@casa.example">ola@casa.example</a><a href="/site/">início</a>');
  return pagina(
    `<title>Casa Exemplo</title><meta name="description" content="Bicicletas"><script type="application/ld+json">${JSON.stringify(ld)}</script>`,
    `<h1>Bicicletas da casa</h1><img src="${origem}/img/site-foto.png" alt="vitrine" width="320"><a href="/site/contato/">Contato</a><a href="/site/tabela-de-precos.pdf">Tabela de preços</a><a href="https://example.com/fora">fora</a><a href="tel:+5500000001234">Ligue</a><a href="#topo">topo</a>`,
  );
}

function responder(req, origem) {
  const rel = decodeURIComponent(new URL(req.url, origem).pathname);
  if (rel === `/${USUARIO}/`) return { tipo: 'text/html', corpo: perfil() };
  for (let n = 1; n <= TOTAL_DE_POSTS; n += 1) {
    if (rel === `/${USUARIO}/p/${codigo(n)}/` || rel === `/${USUARIO}/reel/${codigo(n)}/`) return { tipo: 'text/html', corpo: post(n, origem) };
  }
  if (rel.startsWith('/maps/search/')) return { tipo: 'text/html', corpo: listaDoGoogle() };
  if (rel === '/maps/place/Casa+Exemplo/data=1') return { tipo: 'text/html', corpo: lugarDoGoogle(origem) };
  if (rel === '/site/' || rel === '/site/contato/') return { tipo: 'text/html', corpo: site(rel, origem) };
  if (rel === '/img/site-foto.png') return { tipo: 'image/png', corpo: png(700, 4) };
  if (rel.startsWith('/img/')) return { tipo: 'image/jpeg', corpo: rel.endsWith('a.jpg') ? jpeg(1080, 1350) : jpeg(640, 640) };
  return null;
}

// Sobe o servidor numa porta livre. pedidos: tudo o que foi pedido (para conferir o que não foi).
export function servirFontes() {
  const pedidos = [];
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const origem = `http://${req.headers.host}`;
      pedidos.push(req.url);
      const r = responder(req, origem);
      if (!r) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
      return res.writeHead(200, { 'Content-Type': `${r.tipo}${r.tipo.startsWith('text') ? '; charset=utf-8' : ''}` }).end(r.corpo);
    });
    srv.listen(0, '127.0.0.1', () => {
      const origem = `http://127.0.0.1:${srv.address().port}`;
      resolve({ origem, pedidos, fechar: () => new Promise((r) => srv.close(() => r())) });
    });
  });
}
