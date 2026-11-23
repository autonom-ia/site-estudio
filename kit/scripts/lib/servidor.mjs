// Servidor HTTP estático só de leitura: index e telas na mesma origem (os iframes precisam ler
// o documento um do outro; file:// bloqueia). Aceita Range (vídeo). Só serve dentro da raiz,
// conferido pelo caminho real (link que aponta para fora dá 403). Falha de leitura encerra só
// aquela resposta; o servidor continua de pé.
// "/pasta/" devolve "/pasta/index.html"; "/pasta" redireciona para "/pasta/".
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const TIPOS = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
});

function caminhoDoPedido(url) {
  let fim = url.length;
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q !== -1) fim = Math.min(fim, q);
  if (h !== -1) fim = Math.min(fim, h);
  const caminho = decodeURIComponent(url.slice(0, fim));
  // Caractere de controle (quebra de linha, NUL…) não existe em nome de arquivo servido e quebraria o
  // cabeçalho do redirecionamento: vira 400.
  for (const ch of caminho) {
    const cod = ch.codePointAt(0);
    if (cod < 0x20 || cod === 0x7f) throw new Error('caractere de controle no caminho');
  }
  return caminho;
}

// Dentro da pasta servida? rel vem de path.relative(base, alvo). "..notas.css" é um nome válido.
export function dentroDaBase(rel) {
  return !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}

// Caminho real (sem link) do arquivo, dentro do caminho real da base; null se cair fora ou sumir.
function realDentro(baseReal, arquivo) {
  let real;
  try {
    real = fs.realpathSync(arquivo);
  } catch {
    return null;
  }
  return dentroDaBase(path.relative(baseReal, real)) ? real : null;
}

// Manda o arquivo já aberto (fd). Erro de leitura no meio encerra só esta resposta.
export function enviar(res, fd, opcoes) {
  const fluxo = fs.createReadStream(null, { fd, ...opcoes });
  fluxo.on('error', () => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }).end('500');
    else res.destroy();
  });
  // quem pediu desistiu no meio (vídeo pulado, aba fechada): fecha o arquivo
  res.on('close', () => fluxo.destroy());
  fluxo.pipe(res);
}

function abrirParaLer(arquivo) {
  try {
    return fs.openSync(arquivo, 'r');
  } catch {
    return null;
  }
}

// virtuais: { '/caminho.html': '<html>…' } — página gerada em memória na mesma origem.
// Valor em objeto ({ tipo, corpo }) serve outro tipo (ex.: o JSON de identidade do "abrir").
// aoPedir(): chamado a cada pedido (o "abrir" usa para saber se ainda tem alguém olhando).
export function servir(raiz, { virtuais = {}, porta = 0, aoPedir } = {}) {
  const base = path.resolve(raiz);
  const baseReal = fs.realpathSync(base);
  const srv = http.createServer((req, res) => {
    try {
      responder(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }).end('500');
      else res.destroy();
    }
  });
  function responder(req, res) {
    if (aoPedir) aoPedir();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' }).end('405');
      return;
    }
    let pedido;
    try {
      pedido = caminhoDoPedido(req.url || '/');
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' }).end('400');
      return;
    }
    if (Object.hasOwn(virtuais, pedido)) {
      const v = virtuais[pedido];
      const tipo = typeof v === 'string' ? TIPOS['.html'] : v.tipo;
      res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' }).end(typeof v === 'string' ? v : v.corpo);
      return;
    }
    let arquivo = path.resolve(base, `.${pedido}`);
    if (!dentroDaBase(path.relative(base, arquivo))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('403');
      return;
    }
    let st;
    try {
      st = fs.statSync(arquivo);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
      return;
    }
    if (st.isDirectory()) {
      if (!pedido.endsWith('/')) {
        // Cada pedaço codificado: pasta "a#b" ou "a?b" não pode virar âncora nem consulta no Location.
        res.writeHead(301, { Location: `${pedido.split('/').map(encodeURIComponent).join('/')}/` }).end();
        return;
      }
      arquivo = path.join(arquivo, 'index.html');
    }
    // Link que aponta para fora da pasta servida (inclusive o index.html de uma pasta) não sai.
    const real = realDentro(baseReal, arquivo);
    if (!real) {
      const status = fs.existsSync(arquivo) ? 403 : 404;
      res.writeHead(status, { 'Content-Type': 'text/plain' }).end(String(status));
      return;
    }
    // Abre antes de responder: arquivo que sumiu ou não deixa ler vira 404/500, sem derrubar nada.
    const fd = abrirParaLer(real);
    if (fd === null) {
      const status = fs.existsSync(real) ? 500 : 404;
      res.writeHead(status, { 'Content-Type': 'text/plain' }).end(String(status));
      return;
    }
    try {
      st = fs.fstatSync(fd);
    } catch {
      fs.closeSync(fd);
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('500');
      return;
    }
    if (!st.isFile()) {
      fs.closeSync(fd);
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
      return;
    }
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
    const cabecalho = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    const range = req.headers.range;
    if (range && range.startsWith('bytes=')) {
      const [a, b] = range.slice(6).split('-');
      const ini = a === '' ? Math.max(0, st.size - Number(b)) : Number(a);
      const fim = a === '' || b === '' ? st.size - 1 : Math.min(Number(b), st.size - 1);
      if (!Number.isInteger(ini) || !Number.isInteger(fim) || ini > fim || ini >= st.size) {
        fs.closeSync(fd);
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
        return;
      }
      res.writeHead(206, { ...cabecalho, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': fim - ini + 1 });
      if (req.method === 'HEAD') {
        fs.closeSync(fd);
        res.end();
      } else enviar(res, fd, { start: ini, end: fim });
      return;
    }
    res.writeHead(200, { ...cabecalho, 'Content-Length': st.size });
    if (req.method === 'HEAD') {
      fs.closeSync(fd);
      res.end();
    } else enviar(res, fd, {});
  }
  return new Promise((res, rej) => {
    srv.on('error', rej);
    srv.listen(porta, '127.0.0.1', () =>
      res({
        porta: srv.address().port,
        origem: `http://127.0.0.1:${srv.address().port}`,
        fechar: () =>
          new Promise((r) => {
            srv.closeAllConnections?.();
            srv.close(() => r());
          }),
      }),
    );
  });
}
