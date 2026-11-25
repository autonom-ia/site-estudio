// Onde mora o "antes e depois" de um site: sites/<nome>/revisao/antes-depois/, com antes/ (o site
// guardado pelo "antes"), depois/ (o site no "comparar"), tentativa/ (a versão que a pessoa viu e
// recusou, guardada pelo "escolher" antes de voltar), mudancas.json (escrito pelo assistente),
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
    tentativa: path.join(pasta, 'tentativa'),
    gerador: path.join(c.revisao, 'antes-gerador'),
  };
}

// As três respostas do "Qual fica?". "antes" e "outro" devolvem o site e o gerador ao que foi guardado;
// "outro" deixa o antes em aberto, para a próxima tentativa ainda comparar com o original.
export const ESCOLHAS = Object.freeze(['depois', 'antes', 'outro']);

const existeSemSeguir = (caminho) => {
  try {
    fs.lstatSync(caminho);
    return true;
  } catch {
    return false;
  }
};

// Os nomes ao lado que uma troca usa: o novo é montado em .trocando e o atual sai por .descartando.
export const sobrasDaTroca = (atual) => ({ novo: `${atual}.trocando`, velho: `${atual}.descartando` });

// Sobra de uma troca que parou no meio (o programa morreu entre os dois nomes): se a pasta sumiu e o
// .descartando ficou, ele volta para o lugar. Devolve se voltou. Nada é apagado aqui.
function devolverSeFora(atual, renomear) {
  const { velho } = sobrasDaTroca(atual);
  if (existeSemSeguir(atual) || !existeSemSeguir(velho)) return false;
  renomear(velho, atual);
  return true;
}

// As pastas do site que o "escolher" troca.
const PASTAS_TROCADAS = Object.freeze([['site', (c) => c.site], ['_gerador', (c) => c.gerador]]);

// Põe de volta no lugar o que uma troca parada no meio deixou fora (sem isso o site some e todo
// comando para com SITE_SEM_INDEX, inclusive o "escolher" que terminaria a troca). Chamado ao abrir
// qualquer site (lib/site.mjs). Devolve o nome das pastas que voltaram.
export function recuperarSobras(c, renomear = fs.renameSync) {
  return PASTAS_TROCADAS.filter(([, de]) => devolverSeFora(de(c), renomear)).map(([nome]) => nome);
}

// Troca o conteúdo de destino pelo de origem sem deixar o site sem a pasta: o novo é montado ao lado
// (.trocando), o atual vai para .descartando, o novo entra no lugar e só então o descartado sai. Se a
// entrada do novo falhar (no Windows, um arquivo aberto em outro programa), o atual volta e o erro
// sobe. Sobra de uma troca anterior: a pasta volta ao lugar primeiro; o .trocando de antes é só uma
// cópia montada e sai; um .descartando que sobra com a pasta no lugar é o que uma troca já concluída
// tirou (a versão vista já estava em tentativa/), nunca a única cópia. mover: origem é uma pasta
// montada só para a troca, e entra pelo nome, sem cópia. "renomear" é injetável para os testes.
// Devolve { sobra }: o .descartando que não saiu depois da troca feita (arquivo aberto no Windows),
// ou null. A troca valeu; quem chama avisa, e a próxima troca apaga a sobra.
export function trocarPasta(origem, destino, renomear = fs.renameSync, { mover = false } = {}) {
  const { novo, velho } = sobrasDaTroca(destino);
  devolverSeFora(destino, renomear);
  fs.rmSync(novo, { recursive: true, force: true });
  fs.rmSync(velho, { recursive: true, force: true });
  if (mover) renomear(origem, novo);
  else copiarPasta(origem, novo, { links: 'recriar' });
  const tinha = existeSemSeguir(destino);
  if (tinha) renomear(destino, velho);
  try {
    renomear(novo, destino);
  } catch (erro) {
    if (tinha) renomear(velho, destino);
    fs.rmSync(novo, { recursive: true, force: true });
    throw erro;
  }
  try {
    fs.rmSync(velho, { recursive: true, force: true });
    return { sobra: null };
  } catch {
    return { sobra: velho };
  }
}

// Guarda a versão que a pessoa viu (site/ e _gerador/) em tentativa/, antes de voltar ao antes. Fica
// até o próximo "antes" ou o "depois"; uma tentativa nova substitui a anterior. Montada ao lado e
// trocada no fim. A versão vista é a pasta no lugar; só se ela faltar (troca parada no meio que a
// abertura do site ainda não pôs de volta) é o .descartando. Um .descartando ao lado da pasta é sobra
// de uma troca já concluída, nunca a versão vista. Nada do site é apagado aqui. Devolve as pastas
// guardadas.
export function guardarTentativa(c, ad) {
  const montando = `${ad.tentativa}.guardando`;
  fs.rmSync(montando, { recursive: true, force: true });
  const guardadas = [];
  for (const [nome, de] of PASTAS_TROCADAS) {
    const atual = de(c);
    const { velho } = sobrasDaTroca(atual);
    const origem = existeSemSeguir(atual) ? atual : velho;
    if (!ehPasta(origem)) continue;
    copiarPasta(origem, path.join(montando, nome), { links: 'recriar' });
    guardadas.push(nome);
  }
  fs.mkdirSync(montando, { recursive: true });
  fs.rmSync(ad.tentativa, { recursive: true, force: true });
  fs.renameSync(montando, ad.tentativa);
  return guardadas;
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
