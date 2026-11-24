// A conta do Instagram da pessoa, para o ler trazer mais publicações (lib/instagram-conta.mjs).
//   ./estudio instagram entrar              não abre nada: devolve INSTAGRAM_ANTES_DE_ENTRAR (o aviso
//                                            que o assistente diz antes) ou INSTAGRAM_JA_ENTROU.
//   ./estudio instagram entrar --confirmar  abre a janela do Instagram e espera a pessoa entrar
//                                            (até 9 minutos). INSTAGRAM_ENTROU, INSTAGRAM_JANELA_FECHADA
//                                            ou INSTAGRAM_PRAZO_ACABOU.
//   ./estudio instagram sair                apaga o login guardado neste computador (INSTAGRAM_SAIU).
// A senha nunca passa pelo estúdio: a pessoa digita direto no Instagram, numa janela normal do Chrome.
import { falha } from '../lib/saida.mjs';
import { progresso } from '../lib/executar.mjs';
import { esperarEntrar, temLoginSalvo, sairDaConta } from '../lib/instagram-conta.mjs';
import { acharNavegadorComJanela } from '../lib/chrome.mjs';

const ACOES = Object.freeze(['entrar', 'sair']);
const CODIGO_DA_ESPERA = Object.freeze({ entrou: 'INSTAGRAM_ENTROU', fechou: 'INSTAGRAM_JANELA_FECHADA', prazo: 'INSTAGRAM_PRAZO_ACABOU' });

async function entrar(opcoes) {
  // Sem Chrome que abra janela, nem vale dizer o aviso.
  if (!acharNavegadorComJanela()) falha('INSTAGRAM_SEM_CHROME', {});
  if (await temLoginSalvo()) return { ok: true, codigo: 'INSTAGRAM_JA_ENTROU', dados: { entrou: true } };
  if (opcoes.confirmar !== true) return { ok: true, codigo: 'INSTAGRAM_ANTES_DE_ENTRAR', dados: { entrou: false } };
  progresso('Abri a janela do Instagram. Esperando você entrar na sua conta...');
  const estado = await esperarEntrar();
  return { ok: estado === 'entrou', codigo: CODIGO_DA_ESPERA[estado], dados: { entrou: estado === 'entrou' } };
}

export default async function instagram({ posicionais, opcoes }) {
  const acao = posicionais[0];
  if (!acao) falha('ARGUMENTO_FALTANDO', { argumento: 'entrar ou sair' });
  if (!ACOES.includes(acao)) falha('ARGUMENTO_INVALIDO', { argumento: 'instagram', valor: acao, opcoes: ACOES });
  if (acao === 'sair') return { ok: true, codigo: 'INSTAGRAM_SAIU', dados: { tinha_login: sairDaConta() } };
  return entrar(opcoes);
}
