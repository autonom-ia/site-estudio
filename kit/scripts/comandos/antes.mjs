// Guarda o site como está agora, antes de uma mudança, para o "comparar" mostrar o antes e o depois.
// Uso: ./estudio antes <nome>. Apaga o antes e depois anterior deste site (é só cópia) e deixa um
// mudancas.json de molde para o assistente preencher com 2 ou 3 mudanças concretas.
import fs from 'node:fs';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { copiarPasta, listarArquivos } from '../lib/caminhos.mjs';
import { escreverJson } from '../lib/json.mjs';
import { caminhosDoAntesDepois } from '../lib/antes-depois.mjs';

export default async function antes(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  fs.rmSync(ad.pasta, { recursive: true, force: true });
  copiarPasta(c.site, ad.antes);
  escreverJson(ad.mudancas, { pedido: '', mudancas: [] });
  return {
    ok: true,
    codigo: 'ANTES_GUARDADO',
    arquivos: { antes: c.rel('revisao', 'antes-depois', 'antes'), mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') },
    dados: { arquivos: listarArquivos(ad.antes).length },
  };
}
