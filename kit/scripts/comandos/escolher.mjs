// Aplica a resposta da pessoa ao "Qual fica?" do antes e depois.
// Uso: ./estudio escolher <nome> <depois|antes|outro>.
//   depois: fica o que mudou; o antes é fechado (o próximo pedido vago guarda um antes novo).
//   antes:  site/ e _gerador/ voltam ao que o "antes" guardou; o antes é fechado.
//   outro:  site/ e _gerador/ voltam ao que foi guardado e o antes continua em aberto, para a nova
//           tentativa ainda ser comparada com o original. As mudanças da tentativa recusada saem.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { ehPasta } from '../lib/caminhos.mjs';
import { escreverJson, lerJson } from '../lib/json.mjs';
import { falha, reprovado } from '../lib/saida.mjs';
import { caminhosDoAntesDepois, trocarPasta, ESCOLHAS } from '../lib/antes-depois.mjs';

const CODIGO = Object.freeze({ depois: 'FICOU_O_DEPOIS', antes: 'VOLTOU_COMO_ESTAVA', outro: 'PRONTO_PARA_OUTRO_CAMINHO' });

export default async function escolher(args) {
  const nome = nomeDoSite(args);
  const escolha = args.posicionais[1] || '';
  if (!ESCOLHAS.includes(escolha)) falha('ARGUMENTO_INVALIDO', { argumento: '<escolha>', valor: escolha, opcoes: ESCOLHAS });
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  if (!ehPasta(ad.antes)) falha('ANTES_NAO_GUARDADO', { nome });
  const estado = lerJson(ad.estado, { aberto: false });
  if (estado.aberto !== true) reprovado('ANTES_JA_RESOLVIDO', { nome, escolha: estado.escolha || '' });

  if (escolha !== 'depois') {
    trocarPasta(ad.antes, c.site);
    if (ehPasta(ad.gerador)) trocarPasta(ad.gerador, c.gerador);
  }
  if (escolha === 'outro') {
    const { pedido } = lerJson(ad.mudancas, { pedido: '' });
    escreverJson(ad.mudancas, { pedido: typeof pedido === 'string' ? pedido : '', mudancas: [] });
  } else {
    escreverJson(ad.estado, { aberto: false, escolha });
  }
  return {
    ok: true,
    codigo: CODIGO[escolha],
    arquivos: { mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') },
    dados: { escolha, gerador_restaurado: escolha !== 'depois' && ehPasta(ad.gerador) },
  };
}
