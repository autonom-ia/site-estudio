// Sobe um servidor local na pasta site/ e abre o site no navegador.
// O servidor fica de pé em segundo plano e desliga sozinho depois de 3 horas parado.
// Dois "abrir" ao mesmo tempo no mesmo site esperam um pelo outro (trava por site) e usam o
// mesmo servidor. A porta só é reaproveitada se o servidor dela disser que serve esta pasta.
// --sem-navegador: só sobe o servidor e devolve o endereço.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { abrir as abrirNoSistema } from '../lib/abrir.mjs';
import { FERR } from '../lib/caminhos.mjs';
import { falha } from '../lib/saida.mjs';
import { esperar } from '../lib/cdp.mjs';
import { pegarTrava, soltarTrava } from '../lib/trava.mjs';

const SOZINHO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'servidor-sozinho.mjs');
const ROTA_DE_IDENTIDADE = '/__estudio.json';
const ESPERA_DA_TRAVA_MS = 20000;
const TENTATIVAS_DE_SUBIR = 50;

// Porta do servidor que serve esta pasta, ou null (estado ausente, servidor morto, outra pasta,
// ou outro programa na porta).
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
    return info.porta;
  } catch {
    return null;
  }
}

// Trava por site com o pid do dono (lib/trava.mjs). Trava de um "abrir" que morreu (pid que não
// existe mais) sai do caminho; a de um "abrir" vivo, mesmo lento, é esperada. Só a própria é solta.
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

export default async function abrir(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const pastaEstado = path.join(FERR, 'servidores');
  fs.mkdirSync(pastaEstado, { recursive: true });
  const estado = path.join(pastaEstado, `${nome}.json`);
  const pasta = path.resolve(c.site);
  const porta = await comTrava(`${estado}.trava`, () => subirOuReaproveitar(estado, pasta));
  const endereco = `http://127.0.0.1:${porta}/`;
  const semNavegador = args.opcoes['sem-navegador'] === true;
  if (!semNavegador) abrirNoSistema(endereco);
  return {
    ok: true,
    codigo: semNavegador ? 'SERVIDOR_NO_AR' : 'SITE_ABERTO',
    arquivos: { site: c.rel('site') },
    dados: { endereco, porta },
  };
}
