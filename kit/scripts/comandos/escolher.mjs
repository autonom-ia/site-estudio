// Aplica a resposta da pessoa ao "Qual fica?" do antes e depois.
// Uso: ./estudio escolher <nome> <depois|antes|outro>.
//   depois: fica o que mudou; o antes é fechado (o próximo pedido vago guarda um antes novo) e a
//           versão vista de uma tentativa anterior sai. Se uma volta ao antes tinha parado no meio,
//           a versão vista volta inteira de tentativa/ antes disso.
//   antes:  a versão vista (site/ e _gerador/) é guardada em tentativa/ e site/ e _gerador/ voltam ao
//           que o "antes" guardou; o antes é fechado.
//   outro:  igual, mas o antes continua em aberto, para a nova tentativa ainda ser comparada com o
//           original. As mudanças da tentativa recusada saem de mudancas.json.
// A volta é feita pasta por pasta sem nunca deixar o site sem ela (lib/antes-depois.mjs). Se uma troca
// falhar (no Windows, um arquivo aberto em outro programa), reprova com RESTAURACAO_FALHOU e o estado
// guarda que a volta ficou pendente: rodar de novo continua de onde parou e não guarda o site pela
// metade por cima da versão vista. Troca feita com a cópia velha ainda ao lado (não saiu agora) vale,
// com o aviso SOBRA_DA_TROCA. Se o antes foi guardado sem _gerador/ (estado.gerador false), voltar ao
// antes tira o _gerador/ que apareceu depois (ele fica na tentativa/).
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { ehPasta, relativoARaiz } from '../lib/caminhos.mjs';
import { escreverJson, lerJson } from '../lib/json.mjs';
import { aviso, falha, reprovado } from '../lib/saida.mjs';
import { caminhosDoAntesDepois, trocarPasta, guardarTentativa, ESCOLHAS } from '../lib/antes-depois.mjs';

const CODIGO = Object.freeze({ depois: 'FICOU_O_DEPOIS', antes: 'VOLTOU_COMO_ESTAVA', outro: 'PRONTO_PARA_OUTRO_CAMINHO' });

// Troca as pastas da lista [pasta, origem, destino]; origem null tira a pasta. Devolve { feitas,
// sobras }; falha vira RESTAURACAO_FALHOU.
function trocarTodas(c, escolha, trocas) {
  const feitas = [];
  const sobras = [];
  for (const [pasta, origem, destino] of trocas) {
    try {
      if (origem === null) fs.rmSync(destino, { recursive: true, force: true });
      else {
        const { sobra } = trocarPasta(origem, destino);
        if (sobra) sobras.push(sobra);
      }
    } catch (erro) {
      reprovado('RESTAURACAO_FALHOU', { nome: c.nome, escolha, pasta, erro: erro.code || String(erro.message || erro), tentativa: c.rel('revisao', 'antes-depois', 'tentativa') });
    }
    feitas.push(pasta);
  }
  return { feitas, sobras };
}

// Volta site/ e _gerador/ ao que o "antes" guardou.
function voltarAoAntes(c, ad, escolha, estado) {
  const trocas = [['site', ad.antes, c.site]];
  if (ehPasta(ad.gerador)) trocas.push(['_gerador', ad.gerador, c.gerador]);
  else if (estado.gerador === false && ehPasta(c.gerador)) trocas.push(['_gerador', null, c.gerador]);
  return trocarTodas(c, escolha, trocas);
}

// Uma volta ao antes parou no meio e a pessoa ficou com o depois: a versão vista, guardada em
// tentativa/, volta inteira.
function voltarAVersaoVista(c, ad, escolha) {
  const trocas = [['site', path.join(ad.tentativa, 'site'), c.site], ['_gerador', path.join(ad.tentativa, '_gerador'), c.gerador]];
  return trocarTodas(c, escolha, trocas.filter(([, origem]) => ehPasta(origem)));
}

export default async function escolher(args) {
  const nome = nomeDoSite(args);
  const escolha = args.posicionais[1] || '';
  if (!ESCOLHAS.includes(escolha)) falha('ARGUMENTO_INVALIDO', { argumento: '<escolha>', valor: escolha, opcoes: ESCOLHAS });
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  if (!ehPasta(ad.antes)) falha('ANTES_NAO_GUARDADO', { nome });
  const estado = lerJson(ad.estado, { aberto: false });
  if (estado.aberto !== true) reprovado('ANTES_JA_RESOLVIDO', { nome, escolha: estado.escolha || '' });

  const avisos = [];
  let troca = { feitas: [], sobras: [] };
  if (escolha === 'depois') {
    if (estado.restauracao_pendente === true) troca = voltarAVersaoVista(c, ad, escolha);
    fs.rmSync(ad.tentativa, { recursive: true, force: true });
  } else {
    // A versão vista só é guardada uma vez por volta: se uma volta anterior parou no meio, o site já
    // está meio no antes, e guardar de novo trocaria a versão vista por essa metade.
    if (estado.restauracao_pendente !== true) {
      if (ehPasta(ad.tentativa)) avisos.push(aviso('TENTATIVA_SUBSTITUIDA', { nome }));
      guardarTentativa(c, ad);
      escreverJson(ad.estado, { ...estado, restauracao_pendente: true });
    }
    troca = voltarAoAntes(c, ad, escolha, estado);
  }
  const restauradas = troca.feitas;
  avisos.push(...troca.sobras.map((sobra) => aviso('SOBRA_DA_TROCA', { sobra: relativoARaiz(sobra) })));
  if (escolha === 'outro') {
    const { pedido } = lerJson(ad.mudancas, { pedido: '' });
    escreverJson(ad.mudancas, { pedido: typeof pedido === 'string' ? pedido : '', mudancas: [] });
    escreverJson(ad.estado, { aberto: true, ...(typeof estado.gerador === 'boolean' ? { gerador: estado.gerador } : {}) });
  } else {
    escreverJson(ad.estado, { aberto: false, escolha });
  }
  const arquivos = { mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') };
  if (escolha !== 'depois') arquivos.tentativa = c.rel('revisao', 'antes-depois', 'tentativa');
  return {
    ok: true,
    codigo: CODIGO[escolha],
    avisos,
    arquivos,
    dados: { escolha, restauradas, gerador_restaurado: restauradas.includes('_gerador') },
  };
}
