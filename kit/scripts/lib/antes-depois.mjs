// Onde mora o "antes e depois" de um site: sites/<nome>/revisao/antes-depois/, com antes/ (o site
// guardado pelo "antes"), depois/ (o site no "comparar"), mudancas.json (escrito pelo assistente),
// estado.json (em aberto até a pessoa escolher) e index.html (a página lado a lado). As fontes do
// gerador guardadas ficam em revisao/antes-gerador/, fora do que a comparação mostra. Tudo fora de
// site/: nada disso vai para o ar.
import fs from 'node:fs';
import path from 'node:path';
import { listarArquivos, copiarPasta, ehPasta } from './caminhos.mjs';

export const MINIMO_DE_MUDANCAS = 2;
export const MAXIMO_DE_MUDANCAS = 3;

export function caminhosDoAntesDepois(c) {
  const pasta = path.join(c.revisao, 'antes-depois');
  return {
    pasta,
    antes: path.join(pasta, 'antes'),
    depois: path.join(pasta, 'depois'),
    mudancas: path.join(pasta, 'mudancas.json'),
    pagina: path.join(pasta, 'index.html'),
    estado: path.join(pasta, 'estado.json'),
    gerador: path.join(c.revisao, 'antes-gerador'),
  };
}

// As três respostas do "Qual fica?". "antes" e "outro" devolvem o site e o gerador ao que foi guardado;
// "outro" deixa o antes em aberto, para a próxima tentativa ainda comparar com o original.
export const ESCOLHAS = Object.freeze(['depois', 'antes', 'outro']);

// Troca o conteúdo de destino pelo de origem: copia ao lado primeiro e só depois tira o antigo,
// para uma cópia que falhe no meio nunca deixar o site pela metade.
export function trocarPasta(origem, destino) {
  const nova = `${destino}.trocando`;
  fs.rmSync(nova, { recursive: true, force: true });
  copiarPasta(origem, nova, { links: 'recriar' });
  fs.rmSync(destino, { recursive: true, force: true });
  fs.renameSync(nova, destino);
}

// Guarda uma cópia de origem em destino, trocando a anterior. Origem ausente: tira a cópia velha.
export function guardarCopia(origem, destino) {
  fs.rmSync(destino, { recursive: true, force: true });
  if (ehPasta(origem)) copiarPasta(origem, destino, { links: 'recriar' });
}

// Só as mudanças com título de verdade contam. Devolve { pedido, mudancas, ignoradas }.
export function lerMudancas(json) {
  const pedido = typeof json?.pedido === 'string' ? json.pedido.trim() : '';
  const lista = Array.isArray(json?.mudancas) ? json.mudancas : [];
  const mudancas = [];
  for (const m of lista) {
    const titulo = typeof m?.titulo === 'string' ? m.titulo.trim() : '';
    if (!titulo) continue;
    mudancas.push({ titulo, porque: typeof m.porque === 'string' ? m.porque.trim() : '' });
  }
  return { pedido, mudancas, ignoradas: lista.length - mudancas.length };
}

// Duas pastas com os mesmos arquivos e o mesmo conteúdo, byte a byte?
export function pastasIguais(a, b) {
  const la = listarArquivos(a);
  const lb = listarArquivos(b);
  if (la.length !== lb.length || la.some((r, i) => r !== lb[i])) return false;
  return la.every((r) => fs.readFileSync(path.join(a, ...r.split('/'))).equals(fs.readFileSync(path.join(b, ...r.split('/')))));
}
