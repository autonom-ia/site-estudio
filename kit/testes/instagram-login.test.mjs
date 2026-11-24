// Instagram com login, sem navegador e sem Instagram de verdade: as 40 publicações e a maior foto
// saem do JSON de exemplo; a sessão é reconhecida pela lista de cookies; verificação e volta para a
// página de entrar são reconhecidas pelo endereço; "sair" apaga o perfil guardado; os textos novos
// não têm jargão (o texto de toda mensagem também passa pelo filtro de conversa.test.mjs).
// Sem expressão regular.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { postsDoJson, itensDoJson, bloqueioDoEndereco, respostaDaLeitura, MAXIMO_COM_LOGIN } from '../scripts/lib/ler-instagram-login.mjs';
import { temSessao, semJanela, pastaDoPerfil, perfilEmUso, sairDaConta } from '../scripts/lib/instagram-conta.mjs';
import { argumentosDoNavegador } from '../scripts/lib/cdp.mjs';
import { EH_MAC, EH_WINDOWS } from '../scripts/lib/caminhos.mjs';
import { respostaDaGrade, itemLogado, USUARIO_LOGADO, TOTAL_LOGADO, LARGURA_MAIOR, PROTECAO, codigoLogado } from './fixtures/instagram-logado.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MENSAGENS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'kit', 'mensagens.json'), 'utf8'));
const ORIGEM = 'https://www.instagram.com';
const AGORA = Date.UTC(2026, 10, 24);

test('com login: 40 publicações do JSON, da mais nova para a mais antiga, cada foto na maior largura', () => {
  // as 45 publicações em quatro respostas, uma delas com a proteção na frente
  const textos = [
    JSON.stringify({ require: [[respostaDaGrade(1, 12, ORIGEM)]] }),
    PROTECAO + JSON.stringify(respostaDaGrade(13, 12, ORIGEM)),
    JSON.stringify(respostaDaGrade(25, 12, ORIGEM)),
    JSON.stringify(respostaDaGrade(37, 12, ORIGEM)),
  ];
  assert.equal(itensDoJson(textos, USUARIO_LOGADO).size, TOTAL_LOGADO, 'a publicação de outro perfil não entra');
  const posts = postsDoJson(textos, USUARIO_LOGADO, { base: ORIGEM });
  assert.equal(posts.length, MAXIMO_COM_LOGIN);
  assert.deepEqual(posts.map((p) => p.codigo), Array.from({ length: 40 }, (_, i) => codigoLogado(i + 1)));
  for (const p of posts) {
    assert.ok(p.legenda.startsWith('Legenda logada '), p.codigo);
    assert.equal(p.data.length, 10, p.codigo);
    assert.equal(p.de, 'json');
    assert.equal(p.url, `${ORIGEM}/p/${p.codigo}/`);
    assert.ok(p.fotos.length >= 1, p.codigo);
    for (const f of p.fotos) {
      assert.equal(f.largura, LARGURA_MAIOR, `${p.codigo}: a maior das três, fora de ordem`);
      assert.ok(f.largura >= 1080);
      assert.ok(f.url.endsWith(`-${LARGURA_MAIOR}.jpg`), f.url);
    }
  }
  const carrossel = posts.find((p) => p.codigo === codigoLogado(3));
  assert.equal(carrossel.fotos.length, 2, 'carrossel: uma foto por parte, e a parte não vira publicação');
  assert.ok(!posts.some((p) => p.codigo === 'Outro99'));
});

test('com login: texto quebrado ou vazio não derruba, e sem dono no item a publicação entra', () => {
  assert.equal(postsDoJson(['', '{quebrado', PROTECAO, 'null'], USUARIO_LOGADO).length, 0);
  const semDono = { ...itemLogado(1, ORIGEM) };
  delete semDono.user;
  assert.equal(postsDoJson([JSON.stringify({ items: [semDono] })], USUARIO_LOGADO).length, 1);
  const outro = itemLogado(2, ORIGEM, { usuario: 'Outra.Casa' });
  assert.equal(postsDoJson([JSON.stringify({ items: [outro] })], USUARIO_LOGADO).length, 0);
  assert.equal(postsDoJson([JSON.stringify({ items: [outro] })], 'outra.casa').length, 1, 'o @ é comparado sem maiúscula');
});

test('sessão: só o cookie sessionid do Instagram, com valor e ainda válido', () => {
  const cookie = (extra) => ({ name: 'sessionid', value: 'abc', domain: '.instagram.com', expires: AGORA / 1000 + 3600, ...extra });
  assert.equal(temSessao([cookie()], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ domain: 'www.instagram.com' })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ domain: 'instagram.com' })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ expires: -1 })], { agora: AGORA }), true, 'vale até fechar o navegador');
  assert.equal(temSessao([cookie({ session: true, expires: 0 })], { agora: AGORA }), true);
  assert.equal(temSessao([cookie({ expires: AGORA / 1000 - 1 })], { agora: AGORA }), false, 'vencido');
  assert.equal(temSessao([cookie({ value: '' })], { agora: AGORA }), false, 'sem valor');
  assert.equal(temSessao([cookie({ name: 'csrftoken' })], { agora: AGORA }), false, 'outro cookie');
  assert.equal(temSessao([cookie({ domain: '.instagram.com.example' })], { agora: AGORA }), false, 'outro site');
  assert.equal(temSessao([cookie({ domain: '.notinstagram.com' })], { agora: AGORA }), false, 'outro site com o nome dentro');
  assert.equal(temSessao([], { agora: AGORA }), false);
  assert.equal(temSessao(null), false);
  assert.equal(temSessao([cookie({ domain: '127.0.0.1' })], { dominio: '127.0.0.1', agora: AGORA }), true);
});

test('verificação e página de entrar: reconhecidas pelo endereço, o resto é página normal', () => {
  const casos = [
    ['https://www.instagram.com/challenge/AbC/?next=/', 'verificacao'],
    ['https://www.instagram.com/challenge/', 'verificacao'],
    ['https://www.instagram.com/auth_platform/codeentry/?apc=x', 'verificacao'],
    ['https://www.instagram.com/checkpoint/123/', 'verificacao'],
    ['https://www.instagram.com/accounts/suspended/?next=/', 'verificacao'],
    ['https://www.instagram.com/accounts/disabled/', 'verificacao'],
    ['https://www.instagram.com/accounts/login/?next=%2Fcasa%2F', 'login'],
    ['https://www.instagram.com/Accounts/Login/', 'login'],
    ['https://www.instagram.com/accounts/emailsignup/', 'login'],
    ['https://www.instagram.com/casa.logada/', ''],
    ['https://www.instagram.com/casa.logada/p/Clg01/', ''],
    ['https://www.instagram.com/challenge.casa/', '', 'um perfil com a palavra no nome não é verificação'],
    ['https://www.instagram.com/casa/challenge/', '', 'só o começo do endereço conta'],
    ['https://www.instagram.com/accounts/onetap/?next=/', ''],
    ['não é endereço', ''],
  ];
  for (const [href, esperado, porque] of casos) assert.equal(bloqueioDoEndereco(href), esperado, porque || href);
});

test('respostas guardadas: só as de dados do próprio Instagram', () => {
  const aceita = respostaDaLeitura(ORIGEM);
  assert.equal(aceita('https://www.instagram.com/graphql/query', 'text/javascript'), true);
  assert.equal(aceita('https://www.instagram.com/api/graphql', 'application/json'), true);
  assert.equal(aceita('https://www.instagram.com/api/v1/feed/user/1/', 'application/json'), true);
  assert.equal(aceita('https://www.instagram.com/casa/', 'text/html'), false);
  assert.equal(aceita('https://scontent.cdninstagram.com/v/foto.jpg', 'image/jpeg'), false);
  assert.equal(aceita('https://outro.example/graphql/query', 'application/json'), false);
  assert.equal(aceita('não é endereço', 'application/json'), false);
});

test('janela fechada: nenhuma aba de página aberta', () => {
  assert.equal(semJanela([{ type: 'browser' }, { type: 'service_worker' }]), true);
  assert.equal(semJanela([]), true);
  assert.equal(semJanela(undefined), true);
  assert.equal(semJanela([{ type: 'page', url: 'https://www.instagram.com/accounts/login/' }]), false);
});

test('navegador: a janela é um Chrome normal; o perfil guardado não usa o chaveiro do sistema', () => {
  const base = { caminho: '/x/Google Chrome', porta: 9222, perfil: '/p', largura: 1100, altura: 900 };
  const janela = argumentosDoNavegador({ ...base, comJanela: true, guardado: true });
  assert.ok(!janela.some((a) => a.startsWith('--headless')), 'com janela, nada de modo escondido');
  assert.ok(janela.includes('--user-data-dir=/p'));
  const escondido = argumentosDoNavegador({ ...base, guardado: true });
  assert.ok(escondido.includes('--headless=new'));
  // a janela e a leitura escondida precisam da mesma chave para o login de uma valer na outra
  const chave = (lista) => lista.filter((a) => a === '--use-mock-keychain' || a === '--password-store=basic');
  assert.deepEqual(chave(janela), chave(escondido));
  if (EH_MAC) assert.deepEqual(chave(janela), ['--use-mock-keychain']);
  else if (!EH_WINDOWS) assert.deepEqual(chave(janela), ['--password-store=basic']);
  const temporario = argumentosDoNavegador(base);
  assert.deepEqual(chave(temporario), [], 'o navegador de sempre continua igual');
});

function rodarEstudio(args, env) {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'kit', 'scripts', 'estudio.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const linhas = r.stdout.trim().split('\n');
  return { codigo: r.status, json: JSON.parse(linhas[linhas.length - 1]) };
}

test('sair apaga o perfil guardado inteiro e confirma; sem login guardado, diz que não havia', (t) => {
  const ferr = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-'));
  t.after(() => fs.rmSync(ferr, { recursive: true, force: true }));
  const perfil = pastaDoPerfil(ferr);
  fs.mkdirSync(path.join(perfil, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(perfil, 'Default', 'Cookies'), 'cookies do perfil');
  const r = rodarEstudio(['instagram', 'sair'], { ESTUDIO_FERRAMENTAS: ferr });
  assert.deepEqual([r.codigo, r.json.ok, r.json.codigo, r.json.dados.tinha_login], [0, true, 'INSTAGRAM_SAIU', true]);
  assert.equal(r.json.resumo, MENSAGENS.INSTAGRAM_SAIU.texto);
  assert.equal(fs.existsSync(perfil), false);
  assert.equal(fs.existsSync(path.join(ferr, 'instagram')), true, 'só o perfil sai');
  const deNovo = rodarEstudio(['instagram', 'sair'], { ESTUDIO_FERRAMENTAS: ferr });
  assert.deepEqual([deNovo.codigo, deNovo.json.codigo, deNovo.json.dados.tinha_login], [0, 'INSTAGRAM_SAIU', false]);
});

test('sair com um atalho no lugar do perfil apaga só o atalho', { skip: EH_WINDOWS ? 'atalho de pasta pede permissão no Windows' : false }, (t) => {
  const ferr = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-'));
  const fora = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-fora-'));
  t.after(() => {
    fs.rmSync(ferr, { recursive: true, force: true });
    fs.rmSync(fora, { recursive: true, force: true });
  });
  fs.writeFileSync(path.join(fora, 'importante.txt'), 'fica');
  fs.mkdirSync(path.join(ferr, 'instagram'), { recursive: true });
  fs.symlinkSync(fora, pastaDoPerfil(ferr), 'dir');
  assert.equal(sairDaConta(ferr), true);
  assert.equal(fs.existsSync(pastaDoPerfil(ferr)), false);
  assert.equal(fs.readFileSync(path.join(fora, 'importante.txt'), 'utf8'), 'fica');
});

test('perfil em uso: trava de um Chrome vivo vale; trava velha, de um Chrome que caiu, não', { skip: EH_WINDOWS ? 'no Windows a trava é outra' : false }, (t) => {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-trava-'));
  t.after(() => fs.rmSync(perfil, { recursive: true, force: true }));
  assert.equal(perfilEmUso(perfil), false, 'sem trava');
  const trava = path.join(perfil, 'SingletonLock');
  fs.symlinkSync(`computador-de-teste-${process.pid}`, trava);
  assert.equal(perfilEmUso(perfil), true, 'o processo existe');
  fs.unlinkSync(trava);
  fs.symlinkSync('computador-de-teste-2147483646', trava);
  assert.equal(perfilEmUso(perfil), false, 'processo que não existe mais');
});

test('instagram sem o que fazer, ou com uma ação que não existe, explica o que falta', () => {
  const ferr = fs.mkdtempSync(path.join(os.tmpdir(), 'estudio-ig-'));
  try {
    const sem = rodarEstudio(['instagram'], { ESTUDIO_FERRAMENTAS: ferr });
    assert.deepEqual([sem.codigo, sem.json.codigo], [1, 'ARGUMENTO_FALTANDO']);
    const ruim = rodarEstudio(['instagram', 'senha'], { ESTUDIO_FERRAMENTAS: ferr });
    assert.deepEqual([ruim.codigo, ruim.json.codigo, ruim.json.dados.opcoes], [1, 'ARGUMENTO_INVALIDO', ['entrar', 'sair']]);
  } finally {
    fs.rmSync(ferr, { recursive: true, force: true });
  }
});

const NOVOS = Object.freeze([
  'INSTAGRAM_ANTES_DE_ENTRAR', 'INSTAGRAM_JA_ENTROU', 'INSTAGRAM_ENTROU', 'INSTAGRAM_JANELA_FECHADA', 'INSTAGRAM_PRAZO_ACABOU',
  'INSTAGRAM_SEM_CHROME', 'INSTAGRAM_JANELA_AINDA_ABERTA', 'INSTAGRAM_SAIU', 'LER_INSTAGRAM_PEDIU_VERIFICACAO',
  'LER_INSTAGRAM_LOGIN_INDISPONIVEL', 'LER_INSTAGRAM_POUCOS', 'LER_INSTAGRAM_FALHOU',
]);

test('mensagens do login: existem, sem jargão, e o aviso antes de entrar diz o que a pessoa precisa saber', () => {
  const proibidas = ['pasta', 'comando', 'zip', 'json', 'nota', 'rodada', 'preflight', 'cookie', 'sessionid'];
  for (const codigo of NOVOS) {
    const m = MENSAGENS[codigo];
    assert.ok(m, `${codigo} falta em mensagens.json`);
    for (const campo of ['texto', 'acao']) {
      const texto = m[campo].toLowerCase();
      for (const p of proibidas) assert.ok(!texto.includes(p), `${codigo}.${campo} tem "${p}"`);
    }
  }
  const antes = MENSAGENS.INSTAGRAM_ANTES_DE_ENTRAR.texto;
  for (const trecho of ['alguém entrou na sua conta', 'estúdio', 'janela que você abriu', 'senha', 'direto no Instagram']) assert.ok(antes.includes(trecho), trecho);
  assert.ok(MENSAGENS.INSTAGRAM_ANTES_DE_ENTRAR.acao.includes('--confirmar'), 'a janela só abre com o sim');
  // toda saída da leitura sem conseguir oferece a reserva
  for (const codigo of ['LER_INSTAGRAM_PEDIU_VERIFICACAO', 'LER_INSTAGRAM_POUCOS', 'LER_INSTAGRAM_FALHOU', 'LER_INSTAGRAM_LOGIN_INDISPONIVEL']) {
    assert.ok(MENSAGENS[codigo].acao.includes('extensão do Claude no Chrome'), codigo);
  }
  assert.ok(MENSAGENS.LER_INSTAGRAM_PEDIU_VERIFICACAO.acao.includes('--sem-login'), 'depois da verificação, não insiste');
});
