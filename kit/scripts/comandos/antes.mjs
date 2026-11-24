// Guarda o site como está agora, antes de uma mudança, para o "comparar" mostrar o antes e o depois.
// Uso: ./estudio antes <nome> [--de-novo]. Guarda site/ (com assets/) e _gerador/, e deixa um
// mudancas.json de molde para o assistente preencher com 2 ou 3 mudanças concretas.
// Enquanto a pessoa não escolhe (./estudio escolher), o antes fica em aberto e não é trocado: rodar
// "antes" de novo reprova com ANTES_EM_ABERTO, para a tentativa recusada nunca virar o "antes".
// --de-novo troca mesmo assim (só quando a pessoa pediu para começar de onde o site está agora).
// Guardar um antes novo apaga o da comparação anterior (o antes, a página do depois e a versão vista):
// dados.apagados diz o que havia, para o assistente nunca prometer uma versão que já saiu.
import fs from 'node:fs';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { copiarPasta, listarArquivos, ehPasta } from '../lib/caminhos.mjs';
import { escreverJson, lerJson } from '../lib/json.mjs';
import { reprovado } from '../lib/saida.mjs';
import { caminhosDoAntesDepois, guardarCopia } from '../lib/antes-depois.mjs';

export default async function antes(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  const estado = lerJson(ad.estado, { aberto: false });
  if (ehPasta(ad.antes) && estado.aberto === true && args.opcoes['de-novo'] !== true) {
    reprovado('ANTES_EM_ABERTO', { nome });
  }
  const apagados = [['antes', ad.antes], ['comparacao', ad.depois], ['tentativa', ad.tentativa]]
    .filter(([, pasta]) => ehPasta(pasta)).map(([nomeDoItem]) => nomeDoItem);
  fs.rmSync(ad.pasta, { recursive: true, force: true });
  copiarPasta(c.site, ad.antes);
  guardarCopia(c.gerador, ad.gerador);
  escreverJson(ad.mudancas, { pedido: '', mudancas: [] });
  escreverJson(ad.estado, { aberto: true });
  return {
    ok: true,
    codigo: 'ANTES_GUARDADO',
    arquivos: { antes: c.rel('revisao', 'antes-depois', 'antes'), mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') },
    dados: { arquivos: listarArquivos(ad.antes).length, gerador: ehPasta(ad.gerador), apagados },
  };
}
