// Envio do pacote ao serviço, em partes, e a espera do site responder com cadeado.
// 1. POST /api/estudio/sites/<nome>/envios {bytes, sha256, arquivos} → {envio_id, parte_max, partes}
// 2. PUT  /api/estudio/envios/<id>/partes/<n> (bytes crus + X-Parte-Sha256). Falha de rede ou parte
//    que chegou corrompida: manda a mesma parte de novo, até 3 vezes (reenviar é inofensivo).
// 3. POST /api/estudio/envios/<id>/concluir → {slug, versao, endereco}
// 4. GET  <endereco> com verificação normal do cadeado (TLS), até o prazo.
import crypto from 'node:crypto';
import { KitErro } from './saida.mjs';
import { chamar, esperar, exigir, enderecoSeguro, erroDoServico, ErroDeRede, semConexao } from './publicar-servico.mjs';

export const REENVIOS_POR_PARTE = 3;
const TEMPO_DA_CONSULTA_DO_SITE_MS = 15000;

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function semFalhaDeRede(fazer) {
  try {
    return await fazer();
  } catch (erro) {
    if (erro instanceof ErroDeRede) throw semConexao(erro);
    throw erro;
  }
}

function conferirAbertura(corpo, bytes) {
  const { envio_id: id, parte_max: max, partes } = corpo;
  const valido = typeof id === 'string' && id !== '' && Number.isInteger(max) && max > 0 &&
    Number.isInteger(partes) && partes === Math.max(1, Math.ceil(bytes / max));
  if (!valido) throw new KitErro('PUBLICAR_RESPOSTA_ESTRANHA', { etapa: 'abrir envio' });
  return { id, max, partes };
}

// Manda uma parte. Reenvia em falha de rede, em erro do servidor (5xx) e em parte corrompida.
async function mandarParte(cfg, chave, envio, n, pedaco) {
  const caminho = `/api/estudio/envios/${encodeURIComponent(envio.id)}/partes/${n}`;
  const cabecalhos = { 'x-parte-sha256': sha256(pedaco) };
  let ultimo = null;
  for (let tentativa = 0; tentativa <= REENVIOS_POR_PARTE; tentativa += 1) {
    if (tentativa > 0) await esperar(Math.min(cfg.tempos.intervaloMs, 2000));
    let r;
    try {
      r = await chamar(cfg, 'PUT', caminho, { chave, bytes: pedaco, cabecalhos });
    } catch (erro) {
      if (!(erro instanceof ErroDeRede)) throw erro;
      ultimo = semConexao(erro);
      continue;
    }
    const corrompida = r.status === 400 && r.corpo && r.corpo.codigo === 'PARTE_CORROMPIDA';
    if (r.status >= 500 || corrompida) {
      ultimo = erroDoServico(r);
      continue;
    }
    return exigir(r, 200);
  }
  throw ultimo;
}

// Publica o pacote montado (lib/pacote.mjs). Devolve { slug, versao, endereco, partes }.
export async function enviarPacote(cfg, chave, nome, pacote) {
  const bytes = pacote.zip.length;
  const aberto = await semFalhaDeRede(() =>
    chamar(cfg, 'POST', `/api/estudio/sites/${encodeURIComponent(nome)}/envios`, {
      chave,
      json: { bytes, sha256: pacote.sha256, arquivos: pacote.arquivos },
    }));
  const envio = conferirAbertura(exigir(aberto, 201, 200), bytes);
  for (let n = 0; n < envio.partes; n += 1) {
    await mandarParte(cfg, chave, envio, n, pacote.zip.subarray(n * envio.max, Math.min(bytes, (n + 1) * envio.max)));
  }
  const fim = await semFalhaDeRede(() => chamar(cfg, 'POST', `/api/estudio/envios/${encodeURIComponent(envio.id)}/concluir`, { chave, json: {} }));
  const c = exigir(fim, 200);
  if (!Number.isInteger(c.versao) || typeof c.endereco !== 'string') throw new KitErro('PUBLICAR_RESPOSTA_ESTRANHA', { etapa: 'concluir' });
  return { slug: typeof c.slug === 'string' ? c.slug : nome, versao: c.versao, endereco: c.endereco, partes: envio.partes };
}

// Volta o site para uma versão guardada (sem versão: a anterior). Devolve { versao }.
export async function voltarVersao(cfg, chave, nome, versao) {
  const json = versao === undefined ? {} : { versao };
  const r = await semFalhaDeRede(() => chamar(cfg, 'POST', `/api/estudio/sites/${encodeURIComponent(nome)}/voltar`, { chave, json }));
  const c = exigir(r, 200);
  if (!Number.isInteger(c.versao)) throw new KitErro('PUBLICAR_RESPOSTA_ESTRANHA', { etapa: 'voltar' });
  return { versao: c.versao };
}

// O site responde no endereço, com o cadeado conferido? Tenta até o prazo. true ou false.
export async function esperarSiteNoAr(cfg, endereco) {
  const alvo = enderecoSeguro(endereco, cfg);
  if (!alvo) return false;
  const limite = Date.now() + cfg.tempos.prazoMs;
  for (;;) {
    try {
      const r = await fetch(alvo, { redirect: 'follow', signal: AbortSignal.timeout(TEMPO_DA_CONSULTA_DO_SITE_MS) });
      await r.arrayBuffer();
      if (r.ok) return true;
    } catch {
      // Cadeado ainda não emitido ou rota ainda não criada: espera e tenta de novo.
    }
    if (Date.now() + cfg.tempos.intervaloMs > limite) return false;
    await esperar(cfg.tempos.intervaloMs);
  }
}
