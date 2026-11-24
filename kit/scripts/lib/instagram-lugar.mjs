// Onde mora o login do Instagram e o que se faz com a pasta dele, sem abrir navegador nenhum.
// O perfil fica fora da pasta do estúdio, na pasta de dados do usuário (longe de Documentos e da Área
// de Trabalho, que costumam ir para a nuvem e para cópias de segurança):
//   Mac      ~/Library/Application Support/site-estudio/instagram/<id>/perfil
//   Windows  %LOCALAPPDATA%\site-estudio\instagram\<id>\perfil
//   Linux    $XDG_DATA_HOME (ou ~/.local/share)/site-estudio/instagram/<id>/perfil
// <id> é curto e estável por pasta de estúdio (dois estúdios no mesmo computador, dois logins).
// Ao lado do perfil, pausa.json guarda o dia em que o Instagram pediu verificação: nesse dia, nada de
// login. Nenhum pedaço do caminho pode ser atalho: o estúdio nunca apaga o que está do outro lado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, EH_MAC, EH_WINDOWS, pastaFerramentas } from './caminhos.mjs';
import { falha } from './saida.mjs';
import { hoje } from './leitor.mjs';

const NOME_DO_ESTUDIO = 'site-estudio';
const TAMANHO_DO_ID = 12;
const ESPERA_PARA_APAGAR = Object.freeze({ maxRetries: 10, retryDelay: 500 });

// Pasta de dados do usuário (ESTUDIO_DADOS troca, nos testes).
export function pastaDeDados(env = process.env) {
  if (env.ESTUDIO_DADOS) return path.resolve(env.ESTUDIO_DADOS);
  const casa = env.HOME || os.homedir();
  if (EH_MAC) return path.join(casa, 'Library', 'Application Support', NOME_DO_ESTUDIO);
  if (EH_WINDOWS) return path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), NOME_DO_ESTUDIO);
  return path.join(env.XDG_DATA_HOME || path.join(casa, '.local', 'share'), NOME_DO_ESTUDIO);
}

// Identificador curto e estável da pasta do estúdio.
export function idDoEstudio(raiz = RAIZ) {
  let real = raiz;
  try {
    real = fs.realpathSync(raiz);
  } catch {
    /* fica o caminho como veio */
  }
  return crypto.createHash('sha256').update(real).digest('hex').slice(0, TAMANHO_DO_ID);
}

// { dados (a raiz conhecida), partes (de dados até a conta), conta, perfil, pausa, antigo (onde o
// perfil morava até a v1.2: .ferramentas/instagram/perfil) }.
export function lugarPadrao(env = process.env, raiz = RAIZ) {
  const dados = pastaDeDados(env);
  const partes = ['instagram', idDoEstudio(raiz)];
  return montarLugar(dados, partes, path.join(pastaFerramentas(raiz, env), 'instagram', 'perfil'));
}

export function montarLugar(dados, partes, antigo) {
  const conta = path.join(dados, ...partes);
  return { dados, partes, conta, perfil: path.join(conta, 'perfil'), pausa: path.join(conta, 'pausa.json'), antigo };
}

const ehAtalho = (caminho) => {
  try {
    return fs.lstatSync(caminho).isSymbolicLink();
  } catch {
    return false;
  }
};

// Recusa (INSTAGRAM_CAMINHO_ESTRANHO) se algum pedaço entre a pasta de dados e o perfil for atalho:
// o caminho real da pasta da conta tem que ser o esperado, e o próprio perfil não pode ser atalho.
export function conferirCaminho(lugar) {
  let dadosReal;
  try {
    dadosReal = fs.realpathSync(lugar.dados);
  } catch {
    return; // nada criado ainda
  }
  let atual = dadosReal;
  for (const parte of lugar.partes) {
    atual = path.join(atual, parte);
    if (ehAtalho(atual)) falha('INSTAGRAM_CAMINHO_ESTRANHO', {});
  }
  if (fs.existsSync(lugar.conta) && fs.realpathSync(lugar.conta) !== path.join(dadosReal, ...lugar.partes)) falha('INSTAGRAM_CAMINHO_ESTRANHO', {});
  if (ehAtalho(lugar.perfil)) falha('INSTAGRAM_CAMINHO_ESTRANHO', {});
}

// O Chrome trava o perfil enquanto está aberto. Só consulta, nunca apaga nada.
// Mac e Linux: a trava é um atalho "computador-número do processo", que vale só se o processo ainda
// existe (a trava velha de um Chrome que caiu não bloqueia). Windows: um arquivo que o Chrome mantém
// aberto sem deixar outro programa abrir.
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
  let fd;
  try {
    fd = fs.openSync(arquivo, 'r+');
    return false;
  } catch {
    return true;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function soDoDono(caminho) {
  try {
    fs.chmodSync(caminho, 0o700);
  } catch {
    /* Windows: a pasta de dados já é só do usuário */
  }
}

// O perfil que morava em .ferramentas/instagram/perfil muda para o lugar novo, uma vez, se o novo
// ainda não existe, o antigo não é atalho e nenhum Chrome está usando o antigo.
export function migrarPerfilAntigo(lugar) {
  const { antigo, perfil } = lugar;
  if (!antigo || !fs.existsSync(antigo) || ehAtalho(antigo) || fs.existsSync(perfil) || perfilEmUso(antigo)) return false;
  conferirCaminho(lugar);
  fs.mkdirSync(lugar.conta, { recursive: true, mode: 0o700 });
  conferirCaminho(lugar);
  try {
    fs.renameSync(antigo, perfil);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    // outro disco: copia e só depois apaga o antigo
    fs.cpSync(antigo, perfil, { recursive: true, verbatimSymlinks: true });
    fs.rmSync(antigo, { recursive: true, force: true, ...ESPERA_PARA_APAGAR });
  }
  soDoDono(lugar.conta);
  soDoDono(perfil);
  return true;
}

// Prepara o lugar: muda o perfil antigo, se houver, e confere que nada no caminho é atalho.
export function prepararLugar(lugar) {
  conferirCaminho(lugar);
  migrarPerfilAntigo(lugar);
  conferirCaminho(lugar);
  return lugar;
}

export function criarPerfil(lugar) {
  prepararLugar(lugar);
  fs.mkdirSync(lugar.perfil, { recursive: true, mode: 0o700 });
  conferirCaminho(lugar);
  soDoDono(path.join(lugar.dados, lugar.partes[0]));
  soDoDono(lugar.conta);
  soDoDono(lugar.perfil);
}

// Apaga o perfil (o login). Devolve true se havia um. Recusa caminho com atalho e perfil em uso;
// se o sistema não deixar apagar tudo (Windows segurando um arquivo), INSTAGRAM_SAIR_FALHOU.
export function sairDaConta(lugar) {
  prepararLugar(lugar);
  if (!fs.existsSync(lugar.perfil)) return false;
  if (perfilEmUso(lugar.perfil)) falha('INSTAGRAM_LOGIN_EM_USO', {});
  try {
    fs.rmSync(lugar.perfil, { recursive: true, force: true, ...ESPERA_PARA_APAGAR });
  } catch {
    /* conferido logo abaixo */
  }
  if (fs.existsSync(lugar.perfil)) falha('INSTAGRAM_SAIR_FALHOU', {});
  return true;
}

// Pausa depois de verificação: { motivo, data } ao lado do perfil. Vale só no dia gravado.
export function gravarPausa(lugar, motivo, data = hoje()) {
  prepararLugar(lugar);
  fs.mkdirSync(lugar.conta, { recursive: true, mode: 0o700 });
  conferirCaminho(lugar);
  fs.writeFileSync(lugar.pausa, `${JSON.stringify({ motivo, data })}\n`, { mode: 0o600 });
}

export function pausadoHoje(lugar, data = hoje()) {
  try {
    const p = JSON.parse(fs.readFileSync(lugar.pausa, 'utf8'));
    return Boolean(p) && p.data === data;
  } catch {
    return false;
  }
}

// Se a leitura parou por verificação, grava a pausa do dia. Devolve true se gravou.
export function registrarParada(avisos, lugar, data = hoje()) {
  const parada = (avisos || []).find((a) => a && a.codigo === 'LER_INSTAGRAM_PEDIU_VERIFICACAO');
  if (!parada) return false;
  gravarPausa(lugar, String((parada.dados && parada.dados.motivo) || 'verificacao'), data);
  return true;
}
