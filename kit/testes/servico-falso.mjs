// Serviço de publicação falso, para os testes do comando publicar. Segue o contrato HTTP de
// sites.autonomia.site: login por código (iniciar/consultar), envio em partes, concluir e voltar.
// Toda resposta é JSON; erro é {"ok":false,"codigo","mensagem"}. Só escuta em 127.0.0.1.
import http from 'node:http';
import crypto from 'node:crypto';

const CODIGO_CURTO = 'BCDF-GHJK';
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

function responder(res, status, corpo) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
}
const erro = (res, status, codigo) => responder(res, status, { ok: false, codigo, mensagem: `frase simples de ${codigo}` });

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    req.on('data', (p) => pedacos.push(p));
    req.on('end', () => resolve(Buffer.concat(pedacos)));
    req.on('error', reject);
  });
}

export async function subirServicoFalso({ parteMax = 1000 } = {}) {
  const e = {
    iniciados: 0,
    consultas: 0,
    pedidos: new Map(),
    chaves: new Set(),
    envios: new Map(),
    tentativasDaParte: new Map(),
    derrubarParte: new Set(),
    publicados: [],
    voltas: [],
    autorizacoes: [],
    erroAoAbrir: null,
    enderecoDoSite: null,
  };
  let base = '';

  function login(caminho, res, dados) {
    if (caminho === '/api/estudio/login/iniciar') {
      e.iniciados += 1;
      const dispositivo = `disp_${crypto.randomBytes(24).toString('hex')}`;
      e.pedidos.set(dispositivo, { estado: 'pendente', nome: dados.nome_maquina });
      return responder(res, 200, {
        ok: true, codigo_dispositivo: dispositivo, codigo_curto: CODIGO_CURTO, endereco: `${base}/estudio/ligar`,
        expira_em: Date.now() + 600000, intervalo_s: 5,
      });
    }
    e.consultas += 1;
    const p = e.pedidos.get(dados.codigo_dispositivo);
    if (!p) return responder(res, 404, { ok: false, estado: 'invalido', erro: 'Pedido desconhecido.' });
    if (p.estado === 'recusado') return responder(res, 403, { ok: false, estado: 'recusado', erro: 'Recusado.' });
    if (p.estado === 'entregue') return responder(res, 410, { ok: false, estado: 'ja_entregue', erro: 'Já entregue.' });
    if (p.estado === 'pendente') return responder(res, 202, { ok: true, estado: 'aguardando', mensagem: 'Aguardando.' });
    p.estado = 'entregue';
    const chave = `se_pub_${crypto.randomBytes(32).toString('base64url')}`;
    e.chaves.add(chave);
    return responder(res, 200, { ok: true, estado: 'entregue', chave, email: 'pessoa@exemplo.com' });
  }

  async function parte(req, res, id, n) {
    const envio = e.envios.get(id);
    if (!envio) return erro(res, 404, 'ENVIO_INEXISTENTE');
    const vez = (e.tentativasDaParte.get(n) || 0) + 1;
    e.tentativasDaParte.set(n, vez);
    if (vez === 1 && e.derrubarParte.has(n)) {
      req.socket.destroy(); // queda de rede no meio do envio
      return undefined;
    }
    const bytes = await lerCorpo(req);
    if (bytes.length > parteMax) return erro(res, 413, 'PARTE_GRANDE_DEMAIS');
    if (sha256(bytes) !== req.headers['x-parte-sha256']) return erro(res, 400, 'PARTE_CORROMPIDA');
    if (envio.partes.has(n) && !envio.partes.get(n).equals(bytes)) return erro(res, 409, 'PARTE_DIFERENTE');
    envio.partes.set(n, bytes);
    return responder(res, 200, { ok: true, recebidas: envio.partes.size, partes: envio.total });
  }

  function concluir(res, id) {
    const envio = e.envios.get(id);
    if (!envio) return erro(res, 404, 'ENVIO_INEXISTENTE');
    if (envio.partes.size !== envio.total) return erro(res, 409, 'FALTAM_PARTES');
    const zip = Buffer.concat([...Array(envio.total).keys()].map((n) => envio.partes.get(n)));
    if (sha256(zip) !== envio.sha256) return erro(res, 400, 'PACOTE_CORROMPIDO');
    const versao = e.publicados.filter((p) => p.slug === envio.slug).length + 1;
    e.publicados.push({ slug: envio.slug, versao, zip });
    e.envios.delete(id);
    const endereco = e.enderecoDoSite || `${base}/no-ar/${envio.slug}/`;
    return responder(res, 200, { ok: true, slug: envio.slug, versao, endereco });
  }

  async function estudio(req, res, partes) {
    const autorizacao = String(req.headers.authorization || '');
    e.autorizacoes.push(autorizacao);
    if (!autorizacao.startsWith('Bearer ') || !e.chaves.has(autorizacao.slice('Bearer '.length))) return erro(res, 401, 'CHAVE_INVALIDA');
    if (req.method === 'PUT' && partes[0] === 'envios' && partes[2] === 'partes') return parte(req, res, partes[1], Number(partes[3]));
    const dados = JSON.parse((await lerCorpo(req)).toString('utf8') || '{}');
    if (partes[0] === 'envios' && partes[2] === 'concluir') return concluir(res, partes[1]);
    if (partes[0] === 'sites' && partes[2] === 'voltar') {
      e.voltas.push(dados);
      if (dados.versao === 99) return erro(res, 404, 'VERSAO_INEXISTENTE');
      return responder(res, 200, { ok: true, versao: dados.versao ?? 1 });
    }
    if (partes[0] === 'sites' && partes[2] === 'envios') {
      if (e.erroAoAbrir) return erro(res, e.erroAoAbrir.status, e.erroAoAbrir.codigo);
      const id = crypto.randomBytes(8).toString('hex');
      const total = Math.max(1, Math.ceil(dados.bytes / parteMax));
      e.envios.set(id, { slug: partes[1], sha256: dados.sha256, total, partes: new Map() });
      return responder(res, 201, { ok: true, envio_id: id, parte_max: parteMax, partes: total, expira_em: Date.now() + 3600000 });
    }
    return erro(res, 404, 'ROTA_DESCONHECIDA');
  }

  const servidor = http.createServer(async (req, res) => {
    const caminho = new URL(req.url, 'http://127.0.0.1').pathname;
    if (caminho.startsWith('/no-ar/')) return res.end('site no ar');
    if (caminho.startsWith('/fora/')) return erro(res, 503, 'SEM_CERTIFICADO');
    if (caminho.startsWith('/api/estudio/login/')) {
      const dados = JSON.parse((await lerCorpo(req)).toString('utf8') || '{}');
      return login(caminho, res, dados);
    }
    if (caminho.startsWith('/api/estudio/')) return estudio(req, res, caminho.slice('/api/estudio/'.length).split('/'));
    return erro(res, 404, 'ROTA_DESCONHECIDA');
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
  return {
    base,
    estado: e,
    aprovar: () => e.pedidos.forEach((p) => { if (p.estado === 'pendente') p.estado = 'aprovado'; }),
    recusar: () => e.pedidos.forEach((p) => { p.estado = 'recusado'; }),
    revogarTudo: () => e.chaves.clear(),
    fechar: () => new Promise((resolve) => { servidor.closeAllConnections(); servidor.close(resolve); }),
  };
}
