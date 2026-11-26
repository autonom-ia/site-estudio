// Lê uma vez, do começo ao fim, os arquivos do navegador que os testes vão usar. Roda no Windows do
// CI antes dos testes (.github/workflows/testes.yml).
//
// Por quê (Issue #23): o disco C: de uma máquina nova do GitHub vem frio, e a primeira leitura de
// cada arquivo é lenta. Ler os ~480 MB da pasta do Chrome levou de 15 a 75 s. Sem isso, a primeira
// abertura do Chrome levou de 5 a mais de 21 s, mesmo sozinha, sem nenhum teste rodando; acima de 20 s
// o estúdio desiste (CHROME_NAO_ABRIU). Depois desta leitura, a primeira abertura levou de 0,8 a 3,2 s.
// A causa é da máquina do CI, não do estúdio: no computador de quem usa o estúdio o navegador já
// está em uso e os arquivos dele já foram lidos. Por isso o preparo fica no CI, e não muda prazo nem
// repete teste. O teto fixo de 20 s do estúdio para um disco lento de verdade está anotado na Issue #23.
import fs from 'node:fs';
import path from 'node:path';
import { acharNavegador } from '../../kit/scripts/lib/chrome.mjs';

const BLOCO = 8 * 1024 * 1024;

function lerTudo(arquivo, buffer) {
  const fd = fs.openSync(arquivo, 'r');
  let total = 0;
  try {
    for (let lidos = fs.readSync(fd, buffer); lidos > 0; lidos = fs.readSync(fd, buffer)) total += lidos;
  } finally {
    fs.closeSync(fd);
  }
  return total;
}

function arquivosDa(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(pasta, e.name);
    if (e.isDirectory()) return arquivosDa(caminho);
    return e.isFile() ? [caminho] : [];
  });
}

const achado = acharNavegador();
if (!achado) {
  console.error('Nenhum navegador achado: os testes que precisam dele vão falhar (ESTUDIO_TESTES_EXIGEM_NAVEGADOR=1).');
  process.exit(1);
}
const pasta = path.dirname(achado.caminho);
const inicio = Date.now();
const buffer = Buffer.alloc(BLOCO);
const arquivos = arquivosDa(pasta);
const bytes = arquivos.reduce((soma, a) => soma + lerTudo(a, buffer), 0);
console.log(`${pasta}: ${arquivos.length} arquivos, ${Math.round(bytes / 1e6)} MB lidos em ${Date.now() - inicio} ms`);
