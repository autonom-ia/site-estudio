// A conta do Instagram da pessoa, sem a senha passar pelo estúdio:
// - entrar: abre um Chrome NORMAL, com janela, num perfil só do estúdio (.ferramentas/instagram/perfil),
//   na página de entrar do Instagram. A pessoa entra como sempre. O estúdio só olha, pelo DevTools,
//   se o cookie de sessão apareceu; aí fecha a janela com calma (o Chrome grava o login no disco).
// - leitura com login: o mesmo perfil, no Chrome sem janela (abrirLeitorComLogin).
// - sair: apaga o perfil inteiro.
// O valor do cookie nunca é lido para a saída, nem guardado fora do perfil do Chrome.
import fs from 'node:fs';
import path from 'node:path';
import { launch, conectarNavegador, esperar } from './cdp.mjs';
import { acharNavegadorComJanela } from './chrome.mjs';
import { abrirLeitor } from './leitor.mjs';
import { FERR } from './caminhos.mjs';
import { falha } from './saida.mjs';

export const ENDERECO_DE_ENTRAR = 'https://www.instagram.com/accounts/login/';
export const DOMINIO_DO_INSTAGRAM = 'instagram.com';
const ENDERECOS_DOS_COOKIES = Object.freeze(['https://www.instagram.com/']);
const COOKIE_DE_SESSAO = 'sessionid';
// Menor que os 10 minutos do assistente: a janela fecha antes de o assistente desistir do processo.
export const PRAZO_PARA_ENTRAR_MS = 9 * 60 * 1000;
const INTERVALO_MS = 1000;
// O Instagram ainda grava alguns cookies logo depois de entrar.
const PAUSA_DEPOIS_DE_ENTRAR_MS = 3000;
// Voltas seguidas sem nenhuma aba aberta = a pessoa fechou a janela.
const VOLTAS_SEM_JANELA = 3;
const JANELA = Object.freeze({ largura: 1100, altura: 900 });

export function pastaDoPerfil(ferr = FERR) {
  return path.join(ferr, 'instagram', 'perfil');
}

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

// O Chrome trava o perfil enquanto está aberto. No Mac e no Linux, a trava é um atalho
// "computador-número do processo": vale só se o processo ainda existe (uma trava velha, de um Chrome
// que caiu, não pode bloquear para sempre). No Windows, é um arquivo que não se apaga enquanto o
// Chrome usa o perfil.
export function perfilEmUso(perfil) {
  try {
    const alvo = fs.readlinkSync(path.join(perfil, 'SingletonLock'));
    const numero = Number(alvo.slice(alvo.lastIndexOf('-') + 1));
    if (!Number.isInteger(numero) || numero <= 0) return true;
    try {
      process.kill(numero, 0);
      return true;
    } catch (e) {
      return e.code === 'EPERM';
    }
  } catch {
    /* sem trava de Mac ou Linux */
  }
  const arquivo = path.join(perfil, 'lockfile');
  if (!fs.existsSync(arquivo)) return false;
  try {
    fs.rmSync(arquivo);
    return false;
  } catch {
    return true;
  }
}

function criarPerfil(perfil) {
  fs.mkdirSync(perfil, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(path.dirname(perfil), 0o700);
    fs.chmodSync(perfil, 0o700);
  } catch {
    /* Windows: a pasta já é só do usuário */
  }
}

function navegadorComJanela(navegador) {
  const achado = navegador || acharNavegadorComJanela();
  if (!achado) falha('INSTAGRAM_SEM_CHROME', {});
  return achado;
}

// Abre o Chrome do perfil; se não abriu e o perfil está travado, é a janela do estúdio ainda aberta.
async function abrirOuExplicar(perfil, opcoes) {
  try {
    return await launch({ ...opcoes, perfil });
  } catch (e) {
    if (perfilEmUso(perfil)) falha('INSTAGRAM_JANELA_AINDA_ABERTA', {});
    throw e;
  }
}

// O perfil guardado tem login? Abre sem janela, olha os cookies e fecha. Sem perfil: false.
export async function temLoginSalvo({ ferr = FERR, navegador, dominio = DOMINIO_DO_INSTAGRAM, enderecos = ENDERECOS_DOS_COOKIES } = {}) {
  const perfil = pastaDoPerfil(ferr);
  if (!fs.existsSync(perfil)) return false;
  const leitor = await abrirLeitorDoPerfil(perfil, navegadorComJanela(navegador));
  try {
    return temSessao(await leitor.cookies(enderecos), { dominio });
  } finally {
    await leitor.fecharComCalma();
  }
}

async function abrirLeitorDoPerfil(perfil, navegador) {
  try {
    return await abrirLeitor(undefined, { perfil, navegador });
  } catch (e) {
    if (perfilEmUso(perfil)) falha('INSTAGRAM_JANELA_AINDA_ABERTA', {});
    throw e;
  }
}

// Leitor sem janela com o login guardado. Devolve { leitor } com sessão, { motivo } sem ela
// ('sem-login' = nunca entrou; 'vencido' = o login acabou; 'nao-abriu' = o Chrome do login não abriu;
// 'janela-aberta' = a janela de entrar ainda está aberta).
export async function abrirLeitorComLogin({ ferr = FERR, navegador, dominio = DOMINIO_DO_INSTAGRAM, enderecos = ENDERECOS_DOS_COOKIES } = {}) {
  const perfil = pastaDoPerfil(ferr);
  if (!fs.existsSync(perfil)) return { motivo: 'sem-login' };
  const achado = navegador || acharNavegadorComJanela();
  if (!achado) return { motivo: 'nao-abriu' };
  let leitor;
  try {
    leitor = await abrirLeitor(undefined, { perfil, navegador: achado });
  } catch {
    return { motivo: perfilEmUso(perfil) ? 'janela-aberta' : 'nao-abriu' };
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

// Abre a janela e espera a pessoa entrar. Devolve 'entrou', 'fechou' ou 'prazo'.
// endereco e dominio: os testes trocam por uma página local.
export async function esperarEntrar({ ferr = FERR, navegador, endereco = ENDERECO_DE_ENTRAR, dominio = DOMINIO_DO_INSTAGRAM, prazoMs = PRAZO_PARA_ENTRAR_MS, intervaloMs = INTERVALO_MS, pausaDepoisMs = PAUSA_DEPOIS_DE_ENTRAR_MS } = {}) {
  const achado = navegadorComJanela(navegador);
  const perfil = pastaDoPerfil(ferr);
  criarPerfil(perfil);
  const nav = await abrirOuExplicar(perfil, { comJanela: true, navegador: achado, endereco, ...JANELA });
  // Se o assistente desistir do processo, a janela não fica aberta sozinha.
  const aoInterromper = () => {
    nav.close();
    process.exit(1);
  };
  process.once('SIGTERM', aoInterromper);
  process.once('SIGINT', aoInterromper);
  try {
    const conexao = await conectarNavegador(nav.porta);
    const fim = Date.now() + prazoMs;
    let semJanelaSeguidas = 0;
    while (Date.now() < fim) {
      let estado;
      try {
        estado = await olhar(conexao, dominio);
      } catch {
        // No Windows, fechar a janela fecha o Chrome e a conexão cai.
        estado = nav.vivo() && conexao.aberta() ? 'esperando' : 'fechou';
      }
      if (estado === 'entrou') {
        await esperar(pausaDepoisMs);
        return 'entrou';
      }
      semJanelaSeguidas = estado === 'fechou' ? semJanelaSeguidas + 1 : 0;
      if (semJanelaSeguidas >= VOLTAS_SEM_JANELA || !nav.vivo()) return 'fechou';
      await esperar(intervaloMs);
    }
    return 'prazo';
  } finally {
    process.off('SIGTERM', aoInterromper);
    process.off('SIGINT', aoInterromper);
    await nav.fecharComCalma();
  }
}

// Apaga o perfil guardado (o login). Devolve true se havia um.
export function sairDaConta(ferr = FERR) {
  const perfil = pastaDoPerfil(ferr);
  let info;
  try {
    info = fs.lstatSync(perfil);
  } catch {
    return false;
  }
  if (perfilEmUso(perfil)) falha('INSTAGRAM_JANELA_AINDA_ABERTA', {});
  // Um atalho no lugar do perfil: apaga só o atalho, nunca o que está do outro lado.
  if (info.isSymbolicLink()) fs.unlinkSync(perfil);
  else fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  return true;
}
