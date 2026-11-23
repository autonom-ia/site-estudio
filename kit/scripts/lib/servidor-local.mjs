// Servidor local de uma pasta, de pé em segundo plano (lib/servidor-sozinho.mjs), reaproveitado
// entre comandos. Dois pedidos ao mesmo tempo para a mesma pasta esperam um pelo outro (trava com
// pid) e usam o mesmo servidor. A porta só é reaproveitada se o servidor dela disser que serve esta
// pasta e que tem a prévia lado a lado (servidor de versão antiga é trocado por um novo).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { falha } from './saida.mjs';
import { esperar } from './cdp.mjs';
import { pegarTrava, soltarTrava } from './trava.mjs';
import { ROTA_DA_PREVIA } from './previa.mjs';

const SOZINHO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'servidor-sozinho.mjs');
export const ROTA_DE_IDENTIDADE = '/__estudio.json';
export { ROTA_DA_PREVIA };
const ESPERA_DA_TRAVA_MS = 20000;
const TENTATIVAS_DE_SUBIR = 50;

// Porta do servidor que serve esta pasta, ou null (estado ausente, servidor morto, outra pasta,
// servidor sem a prévia, ou outro programa na porta).
async function servidorVivo(estado, pasta) {
  let info;
  try {
    info = JSON.parse(fs.readFileSync(estado, 'utf8'));
  } catch {
    return null;
  }
  if (!Number.isInteger(info.porta)) return null;
  try {
    const r = await fetch(`http://127.0.0.1:${info.porta}${ROTA_DE_IDENTIDADE}`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return null;
    const id = await r.json();
    if (typeof id.pasta !== 'string' || path.resolve(id.pasta) !== path.resolve(pasta)) return null;
    if (id.previa !== ROTA_DA_PREVIA) return null;
    return info.porta;
  } catch {
    return null;
  }
}

// Trava com o pid do dono (lib/trava.mjs). Trava de quem morreu (pid que não existe mais) sai do
// caminho; a de um pedido vivo, mesmo lento, é esperada. Só a própria é solta.
async function comTrava(trava, fazer) {
  const limite = Date.now() + ESPERA_DA_TRAVA_MS;
  while (!pegarTrava(trava)) {
    if (Date.now() > limite) falha('SERVIDOR_NAO_SUBIU', { motivo: 'outro abrir do mesmo site não terminou' });
    await esperar(100);
  }
  try {
    return await fazer();
  } finally {
    soltarTrava(trava);
  }
}

async function subirOuReaproveitar(estado, pasta) {
  let porta = await servidorVivo(estado, pasta);
  if (porta) return porta;
  fs.rmSync(estado, { force: true });
  const filho = spawn(process.execPath, [SOZINHO, pasta, estado], { detached: true, stdio: 'ignore', windowsHide: true });
  filho.unref();
  for (let k = 0; k < TENTATIVAS_DE_SUBIR && !porta; k += 1) {
    await esperar(100);
    porta = await servidorVivo(estado, pasta);
  }
  if (!porta) {
    // Desistiu: o servidor que subiu tarde não pode gravar estado depois desta resposta.
    try {
      filho.kill();
    } catch {}
    falha('SERVIDOR_NAO_SUBIU', {});
  }
  return porta;
}

// Sobe (ou reaproveita) o servidor da pasta; "estado" é o arquivo .json com porta e pid.
export async function servidorDaPasta(pasta, estado) {
  fs.mkdirSync(path.dirname(estado), { recursive: true });
  return comTrava(`${estado}.trava`, () => subirOuReaproveitar(estado, path.resolve(pasta)));
}
