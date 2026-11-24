// Publica o site em <nome>.sites.autonomia.site, só com a confirmação da pessoa e só para quem tem
// acesso liberado em sites.autonomia.site.
//   ./estudio publicar <nome>                 monta o pacote (lib/pacote.mjs), envia em partes e espera
//                                              o site responder com cadeado (PUBLICADO ou
//                                              PUBLICADO_CERTIFICADO_PENDENTE).
//   ./estudio publicar <nome> --no-ar <outro> publica com outro nome de endereço (o do painel é de outra
//                                              coisa, ou o do site não serve). Fica anotado em no-ar.json
//                                              e vale para as próximas vezes.
//   ./estudio publicar <nome> --por-cima      publica num endereço que já tem outra coisa da pessoa no
//                                              ar (outro site, uma apresentação), só com o sim dela.
//   ./estudio publicar <nome> --voltar [n]    põe no ar a versão n (sem n: a anterior).
//   ./estudio publicar --sair                 esquece a chave e o pedido de acesso deste computador.
// Antes de falar com o serviço, reprova o que o painel recusaria de qualquer jeito
// (lib/regras-do-painel.mjs: tipo, nome, repetidos, quantidade, index, teto), para a pessoa saber o
// motivo sem mandar o pacote inteiro à toa.
// Nada some por engano (lib/publicar-dono.mjs): o painel aceita uma versão nova em qualquer endereço
// da pessoa, então publicar e --voltar só seguem se o que está no ar foi esta pasta que pôs (registro
// em .ferramentas/publicar/donos.json, pelo caminho da pasta e pelo endereço). Senão reprovam com
// PUBLICAR_ENDERECO_JA_EM_USO ou PUBLICAR_PASTA_MUDOU até ela dizer --por-cima ou escolher --no-ar.
// O envio é registrado como "pendente" antes de mandar: se o processo cair no meio, a próxima vez
// sabe que o que apareceu ali pode ser desta pasta. Recusa do painel antes de publicar desfaz o
// registro; --voltar registra a versão que ficou no ar.
// Sem chave guardada, começa o login por código (lib/publicar-login.mjs) e devolve
// PUBLICAR_AGUARDANDO_LOGIN; a próxima chamada continua o mesmo pedido. Se a aprovação chegou durante a
// espera, devolve PUBLICAR_ACESSO_LIBERADO e publica só na próxima chamada (a espera já gastou o tempo
// da chamada). Chave recusada pelo serviço (401): apaga a chave e começa o login de novo. A chave nunca
// aparece na saída. --sair só apaga a cópia deste computador: cortar de vez é revogar na página da conta.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite, abrirPastaDoSite } from '../lib/site.mjs';
import { nomeValido, sugerirNome } from '../lib/caminhos.mjs';
import { montarPacote } from '../lib/pacote.mjs';
import { conferirParaOPainel } from '../lib/regras-do-painel.mjs';
import { aviso, falha, KitErro } from '../lib/saida.mjs';
import { configuracao } from '../lib/publicar-servico.mjs';
import { entrar } from '../lib/publicar-login.mjs';
import { enviarPacote, voltarVersao, esperarSiteNoAr } from '../lib/publicar-envio.mjs';
import { conferirDono, lerDono, anotarDono, lerNoAr, anotarNoAr, lembreteAtual } from '../lib/publicar-dono.mjs';
import { apagar, arquivoChave, esquecerTudo, lerChave } from '../lib/publicar-guarda.mjs';

// Nome do endereço: --no-ar, senão o já anotado em no-ar.json, senão o do site.
function nomeNoAr(c, opcoes) {
  const pedido = opcoes['no-ar'];
  if (pedido !== undefined) {
    if (pedido === true) falha('ARGUMENTO_FALTANDO', { argumento: '--no-ar <nome>' });
    if (!nomeValido(pedido)) falha('NOME_INVALIDO', { valor: pedido, sugestao: sugerirNome(pedido) });
    return pedido;
  }
  const anotado = lerNoAr(c).nome;
  return typeof anotado === 'string' && nomeValido(anotado) ? anotado : c.nome;
}

// "--voltar 3", "--voltar" sozinho, e "--voltar meu-site" (o nome logo depois da opção).
function lerVoltar({ posicionais, opcoes }) {
  const valor = opcoes.voltar;
  if (valor === undefined) return { voltar: false, args: { posicionais, opcoes } };
  if (valor === true) return { voltar: true, versao: undefined, args: { posicionais, opcoes } };
  const n = Number(valor);
  if (Number.isInteger(n) && n > 0 && String(n) === valor) return { voltar: true, versao: n, args: { posicionais, opcoes } };
  if (!posicionais.length) return { voltar: true, versao: undefined, args: { posicionais: [valor], opcoes } };
  return falha('ARGUMENTO_INVALIDO', { argumento: '--voltar', valor });
}

// Roda "fazer" com a chave guardada; sem chave, ou com a chave recusada, passa pelo login.
async function comAcesso(cfg, fazer) {
  const guardada = lerChave(cfg.base);
  let recusada = false;
  if (guardada) {
    try {
      return await fazer(guardada);
    } catch (erro) {
      if (!(erro instanceof KitErro) || erro.codigo !== 'PUBLICAR_CHAVE_RECUSADA') throw erro;
      apagar(arquivoChave());
      recusada = true;
    }
  }
  const e = await entrar(cfg);
  if (e.resultado) return recusada ? { ...e.resultado, dados: { ...e.resultado.dados, chave_recusada: true } } : e.resultado;
  if (e.esperou) return { ok: true, codigo: 'PUBLICAR_ACESSO_LIBERADO', dados: {} };
  return fazer(e.chave);
}

// Erros depois dos quais o site pode já estar no ar: a anotação do endereço fica.
const TALVEZ_NO_AR = Object.freeze(['PUBLICAR_CONCLUSAO_INCERTA', 'PUBLICAR_NO_AR_AJUSTANDO', 'PUBLICAR_ENVIO_EM_ANDAMENTO']);

// Envia com o endereço registrado antes ("pendente"); desfaz o registro e o lembrete se o painel
// recusou antes de publicar.
async function enviarRegistrando(cfg, chave, c, noAr, pacote) {
  const lembrete = lembreteAtual(c);
  const registro = lerDono(c, noAr);
  anotarNoAr(c, { ...(lembrete && lembrete.nome === noAr ? lembrete : {}), nome: noAr, em: new Date().toISOString() });
  anotarDono(c, noAr, { ...(registro || {}), pendente: true });
  try {
    return await enviarPacote(cfg, chave, noAr, pacote);
  } catch (erro) {
    if (!(erro instanceof KitErro) || !TALVEZ_NO_AR.includes(erro.codigo)) {
      anotarNoAr(c, lembrete);
      anotarDono(c, noAr, registro);
    }
    throw erro;
  }
}

async function publicarSite(cfg, c, noAr, porCima) {
  const pacote = montarPacote(c.site, { paraOPainel: true });
  conferirParaOPainel(pacote);
  const avisos = pacote.naoCitados.length ? [aviso('ARQUIVO_NAO_USADO', { arquivos: pacote.naoCitados.map((r) => `site/${r}`) })] : [];
  return comAcesso(cfg, async (chave) => {
    await conferirDono(cfg, chave, c, noAr, porCima);
    const r = await enviarRegistrando(cfg, chave, c, noAr, pacote);
    anotarDono(c, r.slug, { versao: r.versao });
    anotarNoAr(c, { nome: r.slug, endereco: r.endereco, versao: r.versao, em: new Date().toISOString() });
    const noArAgora = await esperarSiteNoAr(cfg, r.endereco);
    return {
      ok: true,
      codigo: noArAgora ? 'PUBLICADO' : 'PUBLICADO_CERTIFICADO_PENDENTE',
      avisos,
      arquivos: { no_ar: c.rel('no-ar.json') },
      dados: {
        endereco: r.endereco,
        versao: r.versao,
        nome: r.slug,
        arquivos: pacote.arquivos,
        tamanho_kb: Math.round(pacote.zip.length / 102.4) / 10,
      },
    };
  });
}

export default async function publicar(args) {
  const cfg = { ...configuracao(), inicio: Date.now() };
  if (args.opcoes.sair !== undefined) {
    const tinha = esquecerTudo();
    return { ok: true, codigo: 'PUBLICAR_SAIU', dados: { tinha_acesso: tinha.chave, tinha_pedido: tinha.pedido, revogar_em: `${cfg.base}/conta` } };
  }
  const v = lerVoltar(args);
  const nome = nomeDoSite(v.args);
  const porCima = args.opcoes['por-cima'] === true;
  if (!v.voltar) {
    const c = abrirSite(nome);
    return publicarSite(cfg, c, nomeNoAr(c, args.opcoes), porCima);
  }
  const c = abrirPastaDoSite(nome);
  const noAr = nomeNoAr(c, args.opcoes);
  return comAcesso(cfg, async (chave) => {
    await conferirDono(cfg, chave, c, noAr, porCima);
    const r = await voltarVersao(cfg, chave, noAr, v.versao);
    anotarDono(c, noAr, { versao: r.versao });
    const lembrete = lerNoAr(c);
    anotarNoAr(c, { ...(lembrete.nome === noAr ? lembrete : {}), nome: noAr, versao: r.versao, em: new Date().toISOString() });
    return { ok: true, codigo: 'PUBLICAR_VERSAO_VOLTOU', dados: { nome: noAr, versao: r.versao } };
  });
}
