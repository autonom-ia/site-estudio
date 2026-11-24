// Cria sites/<nome>/ a partir de kit/molde/, com a marca de minha-marca/ (ou a de exemplo),
// e já monta as páginas do molde (home + uma página) com o gerador.
// --demo <nome>: o molde com uma demo do estúdio por cima (kit/demos/<nome>/, ex.: 3d), para ver,
// fotografar e copiar as peças dela. A demo continua sendo do negócio fictício (molde: true).
// Da marca, só vai para site/assets/marca/ o que a página usa (tokens.css, fontes e licenças,
// logo): marca.md e o resto de minha-marca/ ficam fora do que vai para o ar.
import fs from 'node:fs';
import path from 'node:path';
import { KIT, pastaSites, pastaMarca, copiarPasta, existe, ehPasta, relativoARaiz } from '../lib/caminhos.mjs';
import { copiarMarca } from '../lib/marca.mjs';
import { nomeDoSite } from '../lib/args.mjs';
import { caminhosDo } from '../lib/site.mjs';
import { falha, aviso } from '../lib/saida.mjs';
import { lerTexto, escreverTexto } from '../lib/json.mjs';
import { rodarGerador } from './montar.mjs';

const NOME_PADRAO = 'Oficina Raio';
const MARCADOR = "'{{NOME_DO_SITE}}'";

// As demos: cada pasta de kit/demos/ com um _gerador/ordem.mjs próprio.
export function demosDisponiveis() {
  const pasta = path.join(KIT, 'demos');
  if (!ehPasta(pasta)) return [];
  return fs.readdirSync(pasta).filter((n) => existe(path.join(pasta, n, '_gerador', 'ordem.mjs'))).sort();
}

function escolherDemo(opcoes) {
  if (opcoes.demo === undefined) return '';
  const lista = demosDisponiveis();
  if (typeof opcoes.demo !== 'string' || !lista.includes(opcoes.demo)) falha('ARGUMENTO_INVALIDO', { argumento: '--demo', valor: String(opcoes.demo), opcoes: lista });
  return opcoes.demo;
}

export default async function novo(args) {
  const nome = nomeDoSite(args);
  const demo = escolherDemo(args.opcoes);
  const titulo = typeof args.opcoes.titulo === 'string' && args.opcoes.titulo.trim() ? args.opcoes.titulo.trim() : NOME_PADRAO;
  fs.mkdirSync(pastaSites(), { recursive: true });
  const c = caminhosDo(nome);
  if (existe(c.pasta)) falha('SITE_JA_EXISTE', { nome, pasta: relativoARaiz(c.pasta) });

  copiarPasta(path.join(KIT, 'molde'), c.pasta);
  if (demo) copiarPasta(path.join(KIT, 'demos', demo), c.pasta);

  const avisos = [];
  const marcaUsuario = pastaMarca();
  const temMarca = existe(path.join(marcaUsuario, 'tokens.css'));
  const marca = copiarMarca(temMarca ? marcaUsuario : path.join(KIT, 'marca-exemplo'), c.marca);
  if (!temMarca) avisos.push(aviso('MARCA_DE_EXEMPLO', { pasta: relativoARaiz(marcaUsuario) }));

  const ordem = path.join(c.gerador, 'ordem.mjs');
  // Função de reposição: com texto direto, "$&", "$'" ou "$1" no título seriam lidos como padrão.
  escreverTexto(ordem, lerTexto(ordem).replace(MARCADOR, () => JSON.stringify(titulo)));

  const montado = await rodarGerador(c);
  return {
    ok: true,
    codigo: 'SITE_CRIADO',
    avisos,
    arquivos: { pasta: c.rel(), brief: c.rel('brief.md'), fatos: c.rel('fatos.md'), ordem: c.rel('_gerador', 'ordem.mjs'), site: c.rel('site') },
    dados: { nome, titulo, demo: demo || null, marca: temMarca ? 'minha-marca' : 'exemplo', marca_copiada: marca.copiados, marca_fora_do_site: marca.deixados, paginas: montado.paginas },
  };
}
