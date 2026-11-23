// Publica o site em <nome>.sites.autonomia.site, só com a confirmação da pessoa e só para quem tem
// acesso liberado em sites.autonomia.site.
//   ./estudio publicar <nome>               monta o pacote (lib/pacote.mjs), envia em partes e espera
//                                            o site responder com cadeado (PUBLICADO ou
//                                            PUBLICADO_CERTIFICADO_PENDENTE).
//   ./estudio publicar <nome> --voltar [n]  põe no ar a versão n (sem n: a anterior).
//   ./estudio publicar --sair               esquece a chave e o pedido de acesso deste computador.
// Sem chave guardada, começa o login por código (lib/publicar-login.mjs) e devolve
// PUBLICAR_AGUARDANDO_LOGIN; a próxima chamada continua o mesmo pedido. Se a aprovação chegou durante a
// espera, devolve PUBLICAR_ACESSO_LIBERADO e publica só na próxima chamada (a espera já gastou o tempo
// da chamada). Chave recusada pelo serviço (401): apaga a chave e começa o login de novo. A chave nunca
// aparece na saída. --sair só apaga a cópia deste computador: cortar de vez é revogar na página da conta.
import { nomeDoSite } from '../lib/args.mjs';
import { abrirSite } from '../lib/site.mjs';
import { montarPacote } from '../lib/pacote.mjs';
import { aviso, falha, KitErro } from '../lib/saida.mjs';
import { configuracao } from '../lib/publicar-servico.mjs';
import { entrar } from '../lib/publicar-login.mjs';
import { enviarPacote, voltarVersao, esperarSiteNoAr } from '../lib/publicar-envio.mjs';
import { apagar, arquivoChave, esquecerTudo, lerChave } from '../lib/publicar-guarda.mjs';

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

async function publicarSite(cfg, nome) {
  const c = abrirSite(nome);
  const pacote = montarPacote(c.site);
  const avisos = pacote.naoCitados.length ? [aviso('ARQUIVO_NAO_USADO', { arquivos: pacote.naoCitados.map((r) => `site/${r}`) })] : [];
  return comAcesso(cfg, async (chave) => {
    const r = await enviarPacote(cfg, chave, nome, pacote);
    const noAr = await esperarSiteNoAr(cfg, r.endereco);
    return {
      ok: true,
      codigo: noAr ? 'PUBLICADO' : 'PUBLICADO_CERTIFICADO_PENDENTE',
      avisos,
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
  if (!v.voltar) return publicarSite(cfg, nome);
  return comAcesso(cfg, async (chave) => {
    const r = await voltarVersao(cfg, chave, nome, v.versao);
    return { ok: true, codigo: 'PUBLICAR_VERSAO_VOLTOU', dados: { nome, versao: r.versao } };
  });
}
