// A conta do Instagram da pessoa, sem a senha passar pelo estúdio:
// - entrar: abre um Chrome NORMAL, com janela, num perfil só do estúdio (lugar em
//   lib/instagram-lugar.mjs), na página de entrar do Instagram. A pessoa entra como sempre. O estúdio
//   só olha, pelo DevTools, se o cookie de sessão apareceu; aí fecha a janela com calma (o Chrome grava
//   o login no disco).
// - leitura com login: o mesmo perfil, no Chrome sem janela (abrirLeitorComLogin).
// O valor do cookie não sai da memória do processo: só se confere se ele existe e quando vence.
import fs from 'node:fs';
import { launch, conectarNavegador, esperar, TETO_FECHAR_COM_CALMA_MS } from './cdp.mjs';
import { acharNavegadorComJanela } from './chrome.mjs';
import { abrirLeitor } from './leitor.mjs';
import { falha } from './saida.mjs';
import { lugarPadrao, prepararLugar, criarPerfil, perfilEmUso, pausadoHoje } from './instagram-lugar.mjs';

export { perfilEmUso, sairDaConta, lugarPadrao, gravarPausa, pausadoHoje, registrarParada } from './instagram-lugar.mjs';

export const ENDERECO_DE_ENTRAR = 'https://www.instagram.com/accounts/login/';
export const DOMINIO_DO_INSTAGRAM = 'instagram.com';
const ENDERECOS_DOS_COOKIES = Object.freeze(['https://www.instagram.com/']);
const COOKIE_DE_SESSAO = 'sessionid';
// O assistente desiste de um comando em 10 minutos. "instagram entrar" inteiro (conferir o login
// guardado, a janela, fechar com calma e conferir de novo) cabe num orçamento só, menor que isso.
export const ORCAMENTO_PARA_ENTRAR_MS = 9.5 * 60 * 1000;
// A janela fica aberta até 7 minutos; o resto do orçamento é de quem vem antes e depois dela.
export const PRAZO_PARA_ENTRAR_MS = 7 * 60 * 1000;
// Depois da janela: fechar com calma e conferir o login num navegador novo (abrir, até 20 s; a aba,
// até 10 s; olhar os cookies e fechar de novo).
const RESERVA_PARA_CONFERIR_MS = 70 * 1000;
export const RESERVA_DEPOIS_DA_JANELA_MS = TETO_FECHAR_COM_CALMA_MS + RESERVA_PARA_CONFERIR_MS;
// Fechar à força leva pouco, mas não nada: o piso de qualquer fechamento.
const PISO_DO_FECHAR_MS = 5000;
const INTERVALO_MS = 1000;
// O Instagram ainda grava alguns cookies logo depois de entrar.
const PAUSA_DEPOIS_DE_ENTRAR_MS = 3000;
// Voltas seguidas sem nenhuma aba aberta = a pessoa fechou a janela.
const VOLTAS_SEM_JANELA = 3;
const JANELA = Object.freeze({ largura: 1100, altura: 900 });

// Há sessão quando existe o cookie "sessionid" do Instagram, com valor e ainda válido.
// expires em segundos; -1 (ou session) = vale até fechar o navegador.
export function temSessao(cookies, { dominio = DOMINIO_DO_INSTAGRAM, agora = Date.now() } = {}) {
  if (!Array.isArray(cookies)) return false;
  return cookies.some((c) => {
    if (!c || c.name !== COOKIE_DE_SESSAO || typeof c.value !== 'string' || !c.value) return false;
    const dom = String(c.domain || '');
    const doInstagram = dom === dominio || dom === `.${dominio}` || dom.endsWith(`.${dominio}`);
    if (!doInstagram) return false;
    const expira = Number(c.expires);
    return c.session === true || !Number.isFinite(expira) || expira <= 0 || expira * 1000 > agora;
  });
}

// Sem nenhuma aba de página aberta: a pessoa fechou a janela.
export function semJanela(alvos) {
  return !(Array.isArray(alvos) && alvos.some((a) => a && a.type === 'page'));
}

function navegadorComJanela(navegador) {
  const achado = navegador || acharNavegadorComJanela();
  if (!achado) falha('INSTAGRAM_SEM_CHROME', {});
  return achado;
}

// Abre o Chrome do perfil; se não abriu e o perfil está travado, outro Chrome do estúdio ainda o usa
// (a janela de entrar, ou uma leitura rodando escondida).
async function abrirOuExplicar(abrir, perfil) {
  try {
    return await abrir();
  } catch (e) {
    if (perfilEmUso(perfil)) falha('INSTAGRAM_LOGIN_EM_USO', {});
    throw e;
  }
}

// Quanto a janela pode ficar aberta: o prazo dela, sem passar do orçamento (fim) menos o que fica
// guardado para fechar e conferir depois. 0 = não há tempo.
export function prazoDaJanela({ fim, agora = Date.now(), prazoMs = PRAZO_PARA_ENTRAR_MS }) {
  return Math.max(0, Math.min(prazoMs, fim - agora - RESERVA_DEPOIS_DA_JANELA_MS));
}

// O prazo de um fechamento: o teto de sempre, sem passar do fim (mas nunca menos que o piso).
export function prazoDoFechar(fim, agora = Date.now()) {
  return Math.max(PISO_DO_FECHAR_MS, Math.min(TETO_FECHAR_COM_CALMA_MS, fim - agora));
}

// O perfil guardado tem login? Abre sem janela, olha os cookies e fecha. Sem perfil: false.
// fim: até quando o fechamento pode ir (o orçamento de quem chamou).
export async function temLoginSalvo({ lugar = lugarPadrao(), navegador, dominio = DOMINIO_DO_INSTAGRAM, enderecos = ENDERECOS_DOS_COOKIES, fim = Infinity } = {}) {
  prepararLugar(lugar);
  if (!fs.existsSync(lugar.perfil)) return false;
  const achado = navegadorComJanela(navegador);
  const leitor = await abrirOuExplicar(() => abrirLeitor(undefined, { perfil: lugar.perfil, navegador: achado }), lugar.perfil);
  try {
    return temSessao(await leitor.cookies(enderecos), { dominio });
  } finally {
    await leitor.fecharComCalma(prazoDoFechar(fim));
  }
}

// Leitor sem janela com o login guardado. Devolve { leitor } com sessão, { motivo } sem ela:
// 'sem-login' = nunca entrou; 'pausado' = o Instagram pediu verificação hoje; 'vencido' = o login
// acabou; 'nao-abriu' = o Chrome do login não abriu; 'em-uso' = outro Chrome do estúdio usa o perfil.
// Se o processo for interrompido, o Chrome escondido fecha junto (launch, perfil guardado).
export async function abrirLeitorComLogin({ lugar = lugarPadrao(), navegador, dominio = DOMINIO_DO_INSTAGRAM, enderecos = ENDERECOS_DOS_COOKIES, data } = {}) {
  prepararLugar(lugar);
  if (!fs.existsSync(lugar.perfil)) return { motivo: 'sem-login' };
  if (pausadoHoje(lugar, data)) return { motivo: 'pausado' };
  const achado = navegador || acharNavegadorComJanela();
  if (!achado) return { motivo: 'nao-abriu' };
  let leitor;
  try {
    leitor = await abrirLeitor(undefined, { perfil: lugar.perfil, navegador: achado });
  } catch {
    return { motivo: perfilEmUso(lugar.perfil) ? 'em-uso' : 'nao-abriu' };
  }
  let entrou = false;
  try {
    entrou = temSessao(await leitor.cookies(enderecos), { dominio });
  } catch {
    entrou = false;
  }
  if (entrou) return { leitor };
  await leitor.fecharComCalma();
  return { motivo: 'vencido' };
}

// Uma volta da espera: 'entrou', 'fechou' (sem janela) ou 'esperando'.
async function olhar(conexao, dominio) {
  const { cookies } = await conexao.send('Storage.getCookies', {});
  if (temSessao(cookies, { dominio })) return 'entrou';
  const { targetInfos } = await conexao.send('Target.getTargets', {});
  return semJanela(targetInfos) ? 'fechou' : 'esperando';
}

// Voltas seguidas com erro do DevTools (com o Chrome vivo) antes de desistir.
const ERROS_SEGUIDOS = 3;

// A espera com a janela aberta: { estado, detalhe }.
async function esperarNaJanela(nav, { dominio, prazoMs, intervaloMs, pausaDepoisMs }) {
  const conexao = await conectarNavegador(nav.porta);
  try {
    const fim = Date.now() + prazoMs;
    let semJanelaSeguidas = 0;
    let errosSeguidos = 0;
    while (Date.now() < fim) {
      let estado;
      try {
        estado = await olhar(conexao, dominio);
        errosSeguidos = 0;
      } catch (e) {
        // Chrome fechado (no Windows, fechar a janela fecha o Chrome) ou conexão caída: a pessoa saiu.
        if (!nav.vivo() || !conexao.aberta()) return { estado: 'fechou' };
        errosSeguidos += 1;
        if (errosSeguidos >= ERROS_SEGUIDOS) return { estado: 'erro', detalhe: String((e && e.message) || e) };
        estado = 'esperando';
      }
      if (estado === 'entrou') {
        await esperar(pausaDepoisMs);
        return { estado: 'entrou' };
      }
      semJanelaSeguidas = estado === 'fechou' ? semJanelaSeguidas + 1 : 0;
      if (semJanelaSeguidas >= VOLTAS_SEM_JANELA || !nav.vivo()) return { estado: 'fechou' };
      await esperar(intervaloMs);
    }
    return { estado: 'prazo' };
  } finally {
    conexao.close();
  }
}

// Abre a janela e espera a pessoa entrar. Devolve { estado, detalhe }: estado 'entrou', 'fechou'
// (a pessoa fechou a janela ou o Chrome), 'prazo' ou 'erro' (o DevTools parou de responder com o
// Chrome aberto, ou o login não ficou guardado; detalhe diz o quê). "entrou" só depois de conferir,
// num navegador novo, que o login ficou gravado no disco. fim: o fim do orçamento do comando (a
// janela, o fechamento e a conferência saem do que resta dele). endereco, dominio e enderecos: os
// testes trocam por uma página local.
export async function esperarEntrar({ lugar = lugarPadrao(), navegador, endereco = ENDERECO_DE_ENTRAR, dominio = DOMINIO_DO_INSTAGRAM, enderecos = ENDERECOS_DOS_COOKIES, fim = Date.now() + ORCAMENTO_PARA_ENTRAR_MS, prazoMs = PRAZO_PARA_ENTRAR_MS, intervaloMs = INTERVALO_MS, pausaDepoisMs = PAUSA_DEPOIS_DE_ENTRAR_MS } = {}) {
  const achado = navegadorComJanela(navegador);
  criarPerfil(lugar);
  const nav = await abrirOuExplicar(() => launch({ perfil: lugar.perfil, comJanela: true, navegador: achado, endereco, ...JANELA }), lugar.perfil);
  let r;
  let calmo = false;
  try {
    r = await esperarNaJanela(nav, { dominio, prazoMs: prazoDaJanela({ fim, prazoMs }), intervaloMs, pausaDepoisMs });
  } finally {
    calmo = await nav.fecharComCalma(prazoDoFechar(fim - RESERVA_PARA_CONFERIR_MS));
  }
  if (r.estado !== 'entrou') return r;
  if (await temLoginSalvo({ lugar, navegador: achado, dominio, enderecos, fim })) return r;
  return { estado: 'erro', detalhe: calmo ? 'o login não ficou guardado ao fechar o navegador' : 'o navegador não fechou a tempo e o login não ficou guardado' };
}
