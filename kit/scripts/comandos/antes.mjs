// Guarda o site como está agora, antes de uma mudança, para o "comparar" mostrar o antes e o depois.
// Uso: ./estudio antes <nome> [--de-novo]. Guarda site/ (com assets/) e _gerador/, e deixa um
// mudancas.json de molde para o assistente preencher com 2 ou 3 mudanças concretas.
// Enquanto a pessoa não escolhe (./estudio escolher), o antes fica em aberto e não é trocado: rodar
// "antes" de novo reprova com ANTES_EM_ABERTO, para a tentativa recusada nunca virar o "antes".
// --de-novo troca mesmo assim (só quando a pessoa pediu para começar de onde o site está agora), mas
// nunca com uma volta ao antes parada no meio: aí o site está meio no antes e tentativa/ guarda a única
// cópia inteira da versão vista.
// Guardar um antes novo apaga o da comparação anterior (o antes, a página do depois e a versão vista):
// dados.apagados diz o que havia, para o assistente nunca prometer uma versão que já saiu.
// Nada é apagado antes de o novo estar inteiro: a comparação nova é montada ao lado e entra no lugar
// da anterior de uma vez (lib/antes-depois.mjs, trocarPasta). A anterior é fechada antes da troca:
// se a troca falha no meio (no Windows, um arquivo aberto em outro programa), reprova com
// ANTES_NAO_TROCADO, o site não muda, e o "escolher" nunca volta com o antes de uma e as fontes do
// gerador da outra. Rodar "antes" de novo termina.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { copiarPasta, listarArquivos, ehPasta, relativoARaiz } from '../lib/caminhos.mjs';
import { escreverJson, lerJson } from '../lib/json.mjs';
import { aviso, reprovado } from '../lib/saida.mjs';
import { caminhosDoAntesDepois, trocarPasta } from '../lib/antes-depois.mjs';

// Monta em "montando" o que vai para "destino" e troca de uma vez. Sem origem, tira a cópia velha.
// Devolve a sobra da troca (lib/antes-depois.mjs) ou null.
function trocarCopia(origem, destino) {
  if (!ehPasta(origem)) {
    fs.rmSync(destino, { recursive: true, force: true });
    return null;
  }
  const montando = `${destino}.guardando`;
  fs.rmSync(montando, { recursive: true, force: true });
  copiarPasta(origem, montando, { links: 'recriar' });
  return trocarPasta(montando, destino, fs.renameSync, { mover: true }).sobra;
}

// A comparação nova (antes/, mudancas.json e estado.json), montada ao lado e trocada inteira.
function trocarComparacao(c, ad, temGerador) {
  const montando = `${ad.pasta}.guardando`;
  fs.rmSync(montando, { recursive: true, force: true });
  copiarPasta(c.site, path.join(montando, 'antes'));
  escreverJson(path.join(montando, 'mudancas.json'), { pedido: '', mudancas: [] });
  escreverJson(path.join(montando, 'estado.json'), { aberto: true, gerador: temGerador });
  return trocarPasta(montando, ad.pasta, fs.renameSync, { mover: true }).sobra;
}

export default async function antes(args) {
  const nome = nomeDoSite(args);
  const c = abrirSite(nome);
  const ad = caminhosDoAntesDepois(c);
  const estado = lerJson(ad.estado, { aberto: false });
  const pendente = estado.restauracao_pendente === true;
  if (ehPasta(ad.antes) && estado.aberto === true && (pendente || args.opcoes['de-novo'] !== true)) {
    reprovado('ANTES_EM_ABERTO', { nome, restauracao_pendente: pendente });
  }
  const apagados = [['antes', ad.antes], ['comparacao', ad.depois], ['tentativa', ad.tentativa]]
    .filter(([, pasta]) => ehPasta(pasta)).map(([nomeDoItem]) => nomeDoItem);
  const temGerador = ehPasta(c.gerador);
  if (ehPasta(ad.pasta)) escreverJson(ad.estado, { aberto: false, escolha: estado.escolha || '' });
  let sobras;
  try {
    sobras = [trocarCopia(c.gerador, ad.gerador), trocarComparacao(c, ad, temGerador)].filter(Boolean);
  } catch (erro) {
    // Só erro do sistema de arquivos (EPERM, EBUSY, EACCES...) vira reprovação, e só o código dele sai
    // (a mensagem traz caminhos da pessoa). Outro erro é defeito do estúdio e sobe como é.
    if (typeof erro?.code !== 'string' || typeof erro.syscall !== 'string') throw erro;
    reprovado('ANTES_NAO_TROCADO', { nome, erro: erro.code });
  }
  return {
    ok: true,
    codigo: 'ANTES_GUARDADO',
    avisos: sobras.map((sobra) => aviso('SOBRA_DA_TROCA', { sobra: relativoARaiz(sobra) })),
    arquivos: { antes: c.rel('revisao', 'antes-depois', 'antes'), mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') },
    dados: { arquivos: listarArquivos(ad.antes).length, gerador: ehPasta(ad.gerador), apagados },
  };
}
