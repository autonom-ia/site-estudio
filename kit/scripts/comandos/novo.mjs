// Cria sites/<nome>/ a partir de kit/molde/, com a marca de minha-marca/ (ou a de exemplo),
// e já monta as páginas do molde (home + uma página) com o gerador.
// Da marca, só vai para site/assets/marca/ o que a página usa (tokens.css, fontes e licenças,
// logo): marca.md e o resto de minha-marca/ ficam fora do que vai para o ar.
import fs from 'node:fs';
import path from 'node:path';
import { KIT, pastaSites, pastaMarca, copiarPasta, existe, relativoARaiz } from '../lib/caminhos.mjs';
import { copiarMarca } from '../lib/marca.mjs';
import { nomeDoSite } from '../lib/args.mjs';
import { caminhosDo } from '../lib/site.mjs';
import { falha, aviso } from '../lib/saida.mjs';
import { lerTexto, escreverTexto } from '../lib/json.mjs';
import { rodarGerador } from './montar.mjs';

const NOME_PADRAO = 'Café Aurora';
const MARCADOR = "'{{NOME_DO_SITE}}'";

export default async function novo(args) {
  const nome = nomeDoSite(args);
  const titulo = typeof args.opcoes.titulo === 'string' && args.opcoes.titulo.trim() ? args.opcoes.titulo.trim() : NOME_PADRAO;
  fs.mkdirSync(pastaSites(), { recursive: true });
  const c = caminhosDo(nome);
  if (existe(c.pasta)) falha('SITE_JA_EXISTE', { nome, pasta: relativoARaiz(c.pasta) });

  copiarPasta(path.join(KIT, 'molde'), c.pasta);

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
    dados: { nome, titulo, marca: temMarca ? 'minha-marca' : 'exemplo', marca_copiada: marca.copiados, marca_fora_do_site: marca.deixados, paginas: montado.paginas },
  };
}
