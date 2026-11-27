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
// da anterior de uma vez (lib/antes-depois.mjs, trocarPasta). São duas trocas (as fontes do gerador
// em revisao/antes-gerador/ e a comparação), e uma não vale sem a outra: as fontes do gerador da
// comparação anterior ficam ao lado (.anterior) até a comparação nova entrar, e voltam se ela não
// entra. A anterior é fechada só durante as trocas (se o programa morrer no meio, o "escolher" nunca
// volta com o antes de uma e as fontes do gerador da outra). Se uma troca falha (no Windows, um
// arquivo aberto em outro programa), reprova com ANTES_NAO_TROCADO, o site não muda e a comparação
// anterior volta a ser como era: se estava em aberto, o "escolher" ainda responde a ela
// (dados.pergunta_anterior_em_aberto). Rodar "antes" de novo termina.
import fs from 'node:fs';
import path from 'node:path';
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { copiarPasta, listarArquivos, ehPasta, relativoARaiz } from '../lib/caminhos.mjs';
import { escreverJson, escreverTexto, lerJson, lerTexto } from '../lib/json.mjs';
import { aviso, reprovado } from '../lib/saida.mjs';
import { caminhosDoAntesDepois, sobrasDaTroca, trocarPasta } from '../lib/antes-depois.mjs';

// As fontes do gerador em revisao/antes-gerador/, trocadas sem perder as da comparação anterior: elas
// saem para .anterior e só são apagadas depois que a comparação nova entra (concluir). desfazer
// devolve as anteriores ao lugar. Sem _gerador/ no site, a cópia velha só sai.
function trocaDoGerador(c, ad) {
  const anterior = `${ad.gerador}.anterior`;
  const montando = `${ad.gerador}.guardando`;
  let saiu = false;
  let entrou = false;
  return {
    montar() {
      fs.rmSync(anterior, { recursive: true, force: true });
      fs.rmSync(montando, { recursive: true, force: true });
      if (ehPasta(c.gerador)) copiarPasta(c.gerador, montando, { links: 'recriar' });
    },
    trocar() {
      if (fs.existsSync(ad.gerador)) {
        fs.renameSync(ad.gerador, anterior);
        saiu = true;
      }
      if (ehPasta(montando)) {
        fs.renameSync(montando, ad.gerador);
        entrou = true;
      }
    },
    desfazer() {
      fs.rmSync(montando, { recursive: true, force: true });
      if (entrou) fs.rmSync(ad.gerador, { recursive: true, force: true });
      entrou = false;
      if (saiu) fs.renameSync(anterior, ad.gerador);
      saiu = false;
    },
    // Devolve a cópia velha que não saiu (arquivo aberto no Windows), ou null.
    concluir() {
      if (!saiu) return null;
      try {
        fs.rmSync(anterior, { recursive: true, force: true });
        return null;
      } catch {
        return anterior;
      }
    },
  };
}

// A comparação nova (antes/, mudancas.json e estado.json), montada ao lado e trocada inteira.
function montarComparacao(c, ad, montando, temGerador) {
  fs.rmSync(montando, { recursive: true, force: true });
  copiarPasta(c.site, path.join(montando, 'antes'));
  escreverJson(path.join(montando, 'mudancas.json'), { pedido: '', mudancas: [] });
  escreverJson(path.join(montando, 'estado.json'), { aberto: true, gerador: temGerador });
}

// Erro do sistema de arquivos (EPERM, EBUSY, EACCES...): vira reprovação. Outro erro é defeito do
// estúdio e sobe como é.
const ehErroDeArquivo = (erro) => typeof erro?.code === 'string' && typeof erro.syscall === 'string';

// Tira o que foi montado e não entrou (.guardando, e o .trocando de uma troca que parou na entrada).
// Uma cópia presa (arquivo aberto no Windows) fica: não muda o que vale, e o próximo "antes" a apaga.
function tirarMontagens(ad, comparacao) {
  for (const pasta of [comparacao, sobrasDaTroca(ad.pasta).novo, `${ad.gerador}.guardando`]) {
    try {
      fs.rmSync(pasta, { recursive: true, force: true });
    } catch (erro) {
      if (!ehErroDeArquivo(erro)) throw erro;
    }
  }
}

// Depois de uma troca que falhou: devolve o gerador anterior e o estado.json como era (mesmo texto,
// escrita atômica). Se algo aqui também falha, a comparação anterior fica fechada.
function voltarAComparacaoAnterior(gerador, ad, estadoComoEra) {
  try {
    gerador.desfazer();
    if (estadoComoEra !== null) escreverTexto(ad.estado, estadoComoEra);
  } catch (erro) {
    if (!ehErroDeArquivo(erro)) throw erro;
  }
}

// O que vale depois de uma falha: a pergunta "Qual fica?" da comparação anterior ainda está em aberto?
// Lido do estado.json que ficou, não do que se pretendia (uma troca pode ter recuperado uma
// comparação de uma queda anterior, já fechada).
function perguntaEmAberto(ad) {
  try {
    return ehPasta(ad.antes) && JSON.parse(lerTexto(ad.estado)).aberto === true;
  } catch {
    return false;
  }
}

function naoTrocado(nome, ad, comparacao, erro) {
  if (!ehErroDeArquivo(erro)) throw erro;
  tirarMontagens(ad, comparacao);
  // Só o código do erro sai (a mensagem traz caminhos da pessoa).
  reprovado('ANTES_NAO_TROCADO', { nome, erro: erro.code, pergunta_anterior_em_aberto: perguntaEmAberto(ad) });
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
  const gerador = trocaDoGerador(c, ad);
  const comparacao = `${ad.pasta}.guardando`;
  try {
    gerador.montar();
    montarComparacao(c, ad, comparacao, temGerador);
  } catch (erro) {
    naoTrocado(nome, ad, comparacao, erro);
  }
  let estadoComoEra = null;
  let sobras;
  try {
    estadoComoEra = fs.existsSync(ad.estado) ? fs.readFileSync(ad.estado, 'utf8') : null;
    if (estadoComoEra !== null) escreverJson(ad.estado, { aberto: false, escolha: estado.escolha || '' });
    gerador.trocar();
    sobras = [trocarPasta(comparacao, ad.pasta, fs.renameSync, { mover: true }).sobra];
  } catch (erro) {
    if (ehErroDeArquivo(erro)) voltarAComparacaoAnterior(gerador, ad, estadoComoEra);
    naoTrocado(nome, ad, comparacao, erro);
  }
  sobras = [...sobras, gerador.concluir()].filter(Boolean);
  return {
    ok: true,
    codigo: 'ANTES_GUARDADO',
    avisos: sobras.map((sobra) => aviso('SOBRA_DA_TROCA', { sobra: relativoARaiz(sobra) })),
    arquivos: { antes: c.rel('revisao', 'antes-depois', 'antes'), mudancas: c.rel('revisao', 'antes-depois', 'mudancas.json') },
    dados: { arquivos: listarArquivos(ad.antes).length, gerador: ehPasta(ad.gerador), apagados },
  };
}
