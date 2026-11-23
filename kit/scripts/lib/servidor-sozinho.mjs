// Servidor local que fica de pé depois que o comando "abrir" termina (processo separado).
// Uso: node servidor-sozinho.mjs <pasta> <arquivo-de-estado>
// Grava {porta, pid, pasta} no arquivo de estado (escrita atômica: arquivo temporário + rename).
// Responde /__estudio.json com {pid, pasta, previa}: é por ali que o "abrir" sabe que a porta é
// deste servidor e desta pasta, e não de outro programa que pegou a mesma porta depois.
// Serve também a prévia lado a lado (lib/previa.mjs) em /__previa/, fora da pasta do site.
// Desliga sozinho depois de 3 horas sem nenhum pedido, e só apaga o estado se ainda for o dele.
import fs from 'node:fs';
import path from 'node:path';
import { servir } from './servidor.mjs';
import { ROTA_DA_PREVIA, paginaDaPrevia } from './previa.mjs';

const OCIOSO_MS = 3 * 60 * 60 * 1000;
const ROTA_DE_IDENTIDADE = '/__estudio.json';

const [pastaPedida, estado] = process.argv.slice(2);
const pasta = path.resolve(pastaPedida);
let ultimo = Date.now();
const identidade = JSON.stringify({ pid: process.pid, pasta, previa: ROTA_DA_PREVIA });
const srv = await servir(pasta, {
  aoPedir: () => {
    ultimo = Date.now();
  },
  virtuais: {
    [ROTA_DE_IDENTIDADE]: { tipo: 'application/json; charset=utf-8', corpo: identidade },
    [ROTA_DA_PREVIA]: paginaDaPrevia(),
  },
});

const temporario = `${estado}.${process.pid}.tmp`;
fs.writeFileSync(temporario, JSON.stringify({ porta: srv.porta, pid: process.pid, pasta }));
fs.renameSync(temporario, estado);

function estadoEhMeu() {
  try {
    return JSON.parse(fs.readFileSync(estado, 'utf8')).pid === process.pid;
  } catch {
    return false;
  }
}

setInterval(async () => {
  if (Date.now() - ultimo > OCIOSO_MS) {
    await srv.fechar();
    if (estadoEhMeu()) {
      try {
        fs.rmSync(estado, { force: true });
      } catch {}
    }
    process.exit(0);
  }
}, 60000);
