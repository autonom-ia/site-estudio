// Diagnóstico (não vai para a main): grava quando cada arquivo de teste começa e termina.
// Carregado em todo processo node pelo NODE_OPTIONS=--import; só age no processo de um arquivo.
import fs from 'node:fs';
import path from 'node:path';
const alvo = process.env.DIAG_LINHA;
const arq = process.argv[1] || '';
if (alvo && arq.endsWith('.test.mjs') && !arq.includes('*')) {
  const nome = path.basename(arq);
  const gravar = (ev) => fs.appendFileSync(alvo, `${JSON.stringify({ arq: nome, ev, t: Date.now(), pid: process.pid })}\n`);
  gravar('ini');
  process.on('exit', () => gravar('fim'));
}
