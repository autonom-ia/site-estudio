// Diagnóstico: a cada 2 s, uso de CPU da máquina e quantos processos de navegador existem.
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const [destino, parar] = process.argv.slice(2);
const total = () => os.cpus().reduce((a, c) => {
  const t = c.times;
  return { ocioso: a.ocioso + t.idle, tudo: a.tudo + t.user + t.nice + t.sys + t.idle + t.irq };
}, { ocioso: 0, tudo: 0 });
function navegadores() {
  if (process.platform === 'win32') {
    const r = spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' });
    return (r.stdout || '').split('\n').filter((l) => l.startsWith('"chrome.exe"') || l.startsWith('"msedge.exe"')).length;
  }
  const r = spawnSync('ps', ['-eo', 'comm'], { encoding: 'utf8' });
  return (r.stdout || '').split('\n').filter((l) => l.includes('chrom')).length;
}
let antes = total();
const fim = Date.now() + 45 * 60 * 1000;
while (Date.now() < fim && !fs.existsSync(parar)) {
  await new Promise((r) => setTimeout(r, 2000));
  const agora = total();
  const cpu = 1 - (agora.ocioso - antes.ocioso) / Math.max(1, agora.tudo - antes.tudo);
  antes = agora;
  fs.appendFileSync(destino, `${JSON.stringify({ t: Date.now(), cpu: Number(cpu.toFixed(3)), nav: navegadores(), nucleos: os.cpus().length })}\n`);
}
