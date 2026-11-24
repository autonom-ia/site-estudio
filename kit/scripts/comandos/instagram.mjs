// A conta do Instagram da pessoa, para o ler trazer mais publicações (lib/instagram-conta.mjs).
//   ./estudio instagram entrar              não abre nada nem olha o login guardado: devolve
//                                            INSTAGRAM_ANTES_DE_ENTRAR (o aviso que o assistente diz antes).
//   ./estudio instagram entrar --confirmar  se o login guardado ainda vale, INSTAGRAM_JA_ENTROU; senão
//                                            abre a janela do Instagram e espera a pessoa entrar (até 9
//                                            minutos): INSTAGRAM_ENTROU, INSTAGRAM_JANELA_FECHADA,
//                                            INSTAGRAM_PRAZO_ACABOU ou INSTAGRAM_ENTRAR_FALHOU.
//   ./estudio instagram sair                apaga o login guardado neste computador (INSTAGRAM_SAIU).
// No dia em que o Instagram pediu verificação, entrar devolve INSTAGRAM_PAUSADO_HOJE.
// A senha nunca passa pelo estúdio: a pessoa digita direto no Instagram, numa janela normal do Chrome.
import { falha } from '../lib/saida.mjs';
import { progresso } from '../lib/executar.mjs';
import { esperarEntrar, temLoginSalvo, sairDaConta, lugarPadrao, pausadoHoje } from '../lib/instagram-conta.mjs';
import { acharNavegadorComJanela } from '../lib/chrome.mjs';

const ACOES = Object.freeze(['entrar', 'sair']);
const CODIGO_DA_ESPERA = Object.freeze({
  entrou: 'INSTAGRAM_ENTROU',
  fechou: 'INSTAGRAM_JANELA_FECHADA',
  prazo: 'INSTAGRAM_PRAZO_ACABOU',
  erro: 'INSTAGRAM_ENTRAR_FALHOU',
});

async function entrar(opcoes, lugar) {
  // Sem Chrome que abra janela, nem vale dizer o aviso.
  if (!acharNavegadorComJanela()) falha('INSTAGRAM_SEM_CHROME', {});
  if (pausadoHoje(lugar)) return { ok: false, codigo: 'INSTAGRAM_PAUSADO_HOJE', dados: { entrou: false } };
  if (opcoes.confirmar !== true) return { ok: true, codigo: 'INSTAGRAM_ANTES_DE_ENTRAR', dados: { entrou: false } };
  if (await temLoginSalvo({ lugar })) return { ok: true, codigo: 'INSTAGRAM_JA_ENTROU', dados: { entrou: true } };
  progresso('Abrindo a janela do Instagram. Esperando você entrar na sua conta...');
  const r = await esperarEntrar({ lugar });
  const dados = r.detalhe ? { entrou: false, detalhe: r.detalhe } : { entrou: r.estado === 'entrou' };
  return { ok: r.estado === 'entrou', codigo: CODIGO_DA_ESPERA[r.estado], dados };
}

export default async function instagram({ posicionais, opcoes }) {
  const acao = posicionais[0];
  if (!acao) falha('ARGUMENTO_FALTANDO', { argumento: 'entrar ou sair' });
  if (!ACOES.includes(acao)) falha('ARGUMENTO_INVALIDO', { argumento: 'instagram', valor: acao, opcoes: ACOES });
  const lugar = lugarPadrao();
  if (acao === 'sair') return { ok: true, codigo: 'INSTAGRAM_SAIU', dados: { tinha_login: sairDaConta(lugar) } };
  return entrar(opcoes, lugar);
}
