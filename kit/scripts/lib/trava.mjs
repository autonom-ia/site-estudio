// Trava exclusiva em arquivo, com o pid do dono dentro. Usada pelo "atualizar" (uma troca por
// instalação) e pelo "abrir" (um servidor por site).
// - pegar: cria o arquivo com 'wx' (só um processo consegue) e grava o próprio pid.
// - trava de outro: só sai do caminho se o pid dono não existe mais (process.kill(pid, 0) dá
//   ESRCH). Idade não conta: um processo vivo e lento continua dono.
// - trava sem pid legível (o dono morreu entre criar o arquivo e escrever o pid) só sai depois
//   de SEM_PID_EXPIRA_MS, porque não há pid para conferir.
// - soltar: só apaga se a trava ainda for deste processo.
import fs from 'node:fs';

const SEM_PID_EXPIRA_MS = 10000;

// O processo existe? EPERM = existe, mas é de outro usuário.
export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== 'ESRCH';
  }
}

function lerDono(trava) {
  try {
    const pid = Number(fs.readFileSync(trava, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return undefined; // sumiu
  }
}

function criar(trava) {
  let fd;
  try {
    fd = fs.openSync(trava, 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    throw e;
  }
  try {
    fs.writeSync(fd, String(process.pid));
  } finally {
    fs.closeSync(fd);
  }
  return true;
}

// A trava existente é órfã (dono morto, ou sem pid há tempo demais)?
function orfa(trava, dono) {
  if (dono) return !pidVivo(dono);
  try {
    return Date.now() - fs.statSync(trava).mtimeMs > SEM_PID_EXPIRA_MS;
  } catch {
    return false;
  }
}

// Tira a trava órfã do caminho. rename é atômico: se dois processos tentam, só um leva o arquivo,
// e quem levou confere que levou a mesma trava órfã (e não uma nova, de um dono vivo).
function tirarOrfa(trava, dono) {
  const velha = `${trava}.${process.pid}.velha`;
  try {
    fs.renameSync(trava, velha);
  } catch {
    return;
  }
  const levado = lerDono(velha);
  if (levado !== dono && levado && pidVivo(levado) && !fs.existsSync(trava)) {
    // levou a trava nova de outro processo: devolve
    try {
      fs.renameSync(velha, trava);
      return;
    } catch {}
  }
  fs.rmSync(velha, { force: true });
}

// true = a trava é deste processo agora; false = outro processo vivo é o dono.
export function pegarTrava(trava) {
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    if (criar(trava)) return true;
    const dono = lerDono(trava);
    if (dono === undefined) continue; // sumiu entre o 'wx' e a leitura
    if (!orfa(trava, dono)) return false;
    tirarOrfa(trava, dono);
  }
  return criar(trava);
}

// Apaga a trava só se ela ainda for deste processo.
export function soltarTrava(trava) {
  if (lerDono(trava) === process.pid) fs.rmSync(trava, { force: true });
}
